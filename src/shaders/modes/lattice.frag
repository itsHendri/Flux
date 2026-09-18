// LATTICE — the Mandelbox, flown through.
//
// Where the Mandelbulb is an object you orbit, the Mandelbox is a place: two
// folds and a scale, iterated, which build an endless architecture of boxes,
// arches and shafts. Each iteration does three things — fold the point back
// inside the box (reflect anything past ±1), fold it out of the inner sphere
// (invert anything closer than the minimum radius), then scale and add the
// original point. The running derivative gives the distance estimate that
// makes it traceable, exactly as with the bulb.
// Reference: Tom Lowe's Mandelbox, and iq on distance estimators
// (https://iquilezles.org/articles/distancefractals/).
//
// Steering: uBoxScale is the shape — the single number the whole structure
// hangs on — uBoxFold moves the inner fold, uLatticeQuality sets the cost,
// uWarp turns the flight, uGain brightness. Bass leans on the scale and a kick
// shoves it, so the architecture rebuilds around you as you fly.

mat2 rotL(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float boxDE(vec3 p, float scale, float minR2, int iters, out float trap) {
  vec3 z = p;
  float dr = 1.0;
  trap = 1e9;
  for (int i = 0; i < 14; i++) {
    if (i >= iters) break;
    // Box fold: reflect back inside the unit box.
    z = clamp(z, -1.0, 1.0) * 2.0 - z;
    // Sphere fold: push points out of the inner sphere, invert the middle band.
    float r2 = dot(z, z);
    if (r2 < minR2) {
      float t = 1.0 / minR2;
      z *= t;
      dr *= t;
    } else if (r2 < 1.0) {
      float t = 1.0 / r2;
      z *= t;
      dr *= t;
    }
    z = scale * z + p;
    dr = dr * abs(scale) + 1.0;
    trap = min(trap, length(z));
  }
  return length(z) / abs(dr);
}

vec3 boxNormal(vec3 p, float scale, float minR2, int iters) {
  vec2 e = vec2(0.0012, -0.0012);
  float t;
  return normalize(
    e.xyy * boxDE(p + e.xyy, scale, minR2, iters, t) +
    e.yyx * boxDE(p + e.yyx, scale, minR2, iters, t) +
    e.yxy * boxDE(p + e.yxy, scale, minR2, iters, t) +
    e.xxx * boxDE(p + e.xxx, scale, minR2, iters, t)
  );
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);

  int quality = int(uLatticeQuality + 0.5);
  int iters = quality >= 2 ? 12 : (quality >= 1 ? 9 : 7);
  int steps = quality >= 2 ? 128 : (quality >= 1 ? 104 : 64);

  // The scale is the building. Negative scales give the cathedral-like
  // interiors this mode is after; bass and the kick move it, so corridors
  // open and close as you fly.
  float scale = uBoxScale - uBass * 0.25 * uBoxDrive - uBeat * 0.5 * uBoxDrive;
  float minR2 = mix(0.12, 0.6, uBoxFold);

  // The camera circles the structure and drifts in and out, rather than
  // sitting inside it: from within, a Mandelbox is a crust with no readable
  // scale, and the arches and shafts only become architecture from outside.
  float orbit = uTime * 0.08 + uWarp * 2.0;
  // A Mandelbox at scale 2 fills a ball roughly six units across, so a camera
  // any closer than this is inside the crust rather than looking at the
  // building.
  float dolly = mix(15.0, 7.5, uScale) + sin(uTime * 0.05) * 1.2;
  vec3 ro = vec3(sin(orbit) * dolly, sin(uTime * 0.037) * 4.0, cos(orbit) * dolly);
  // Look at the middle, with a slow wander so the framing keeps changing.
  vec3 target = vec3(sin(uTime * 0.043) * 1.5, cos(uTime * 0.031) * 1.2, 0.0);
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(fwd * 1.5 + right * p.x + up * p.y);

  float t = 0.0;
  float trap = 1e9;
  float glow = 0.0;
  bool hit = false;
  int used = 0;
  for (int i = 0; i < 128; i++) {
    if (i >= steps) break;
    used = i;
    vec3 pos = ro + rd * t;
    float tr;
    float d = boxDE(pos, scale, minR2, iters, tr);
    glow += 0.01 / (1.0 + d * d * 700.0);
    if (d < 0.0016 + t * 0.0004) { // tolerance grows with distance
      hit = true;
      trap = tr;
      break;
    }
    t += d * 0.9;
    if (t > 34.0) break;
  }

  vec3 col = vec3(0.01, 0.012, 0.018);
  float rampT = 0.58;

  if (hit) {
    vec3 pos = ro + rd * t;
    vec3 nor = boxNormal(pos, scale, minR2, iters);
    vec3 lig = normalize(vec3(0.5, 0.8, -0.35));
    float dif = clamp(dot(nor, lig), 0.0, 1.0);
    float fre = pow(1.0 - clamp(dot(nor, -rd), 0.0, 1.0), 4.0);
    float spe = pow(clamp(dot(reflect(-lig, nor), -rd), 0.0, 1.0), 40.0);
    // Gentler than the bulb's: this structure is nearly all crevice, and a
    // harsh occlusion term leaves the whole building in shadow.
    float ao = clamp(1.0 - float(used) / float(steps) * 0.8, 0.25, 1.0);

    rampT = 0.06 + trap * 0.5 + uMid * 0.1;
    col = themeRamp(rampT) * (0.34 + dif * 0.85) * ao;
    col += themeRamp(rampT + 0.35) * fre * 0.55;
    col += vec3(1.0) * spe * (0.2 + uHigh * 0.5);
    // Deep fog: it's what turns a lump of geometry into a place with distance.
    col = mix(col, vec3(0.01, 0.012, 0.018), clamp((t - 8.0) / 26.0, 0.0, 1.0) * 0.85);
  }

  col += themeRamp(0.4 + uLevel * 0.25) * glow * (0.45 + uLevel * 1.3) * uBoxGlow;
  col *= mix(0.7, 1.9, uGain);
  return themed(col, rampT);
}
