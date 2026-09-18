// BULB — the Mandelbulb, sphere-traced.
//
// The 3D analogue of the Mandelbrot set (White/Nylander): the same
// z -> z^n + c, but with z cubed the "spherical" way — raise the radius to the
// power, multiply the two angles by it. There's no closed-form distance to
// that surface, so the ray is advanced by a *distance estimate* built from the
// running derivative: 0.5 * log(r) * r / dr, which is guaranteed not to
// overshoot the surface. That's what makes an infinitely detailed object
// renderable at all.
// References: Inigo Quilez on distance estimators
// (https://iquilezles.org/articles/distancefractals/), Daniel White and Paul
// Nylander's original power-8 formulation.
//
// The music is in the exponent. Holding the power near 8 gives the familiar
// bulb; pushing it re-grows the whole object — different lobes, different
// spires — so a kick doesn't light the fractal, it rebuilds it.
//
// Steering: uScale = how close the camera flies, uBulbPower = base exponent,
// uBulbGrow = how far accents move it, uBulbQuality = iterations/steps,
// uBulbGlow = the halo, uGain = brightness.

mat2 rot2(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Distance estimate to the bulb, plus an orbit trap for colour: how close the
// iteration came to the origin, which is the standard way to get bands of
// colour that follow the fractal's structure rather than its position.
float bulbDE(vec3 p, float power, int iters, out float trap) {
  vec3 z = p;
  float dr = 1.0;
  float r = 0.0;
  trap = 1e9;
  for (int i = 0; i < 12; i++) {
    if (i >= iters) break;
    r = length(z);
    if (r > 2.2) break;
    trap = min(trap, r);

    // Spherical coordinates, angles scaled by the power.
    float theta = acos(clamp(z.z / r, -1.0, 1.0));
    float phi = atan(z.y, z.x);
    dr = pow(r, power - 1.0) * power * dr + 1.0;

    float zr = pow(r, power);
    theta *= power;
    phi *= power;
    z = zr * vec3(sin(theta) * cos(phi), sin(theta) * sin(phi), cos(theta)) + p;
  }
  // Green's distance estimate for an escape-time fractal.
  return 0.5 * log(max(r, 1e-6)) * r / max(dr, 1e-6);
}

vec3 bulbNormal(vec3 p, float power, int iters) {
  // Tetrahedral sampling: four distance evaluations instead of six.
  vec2 e = vec2(0.0015, -0.0015);
  float t;
  return normalize(
    e.xyy * bulbDE(p + e.xyy, power, iters, t) +
    e.yyx * bulbDE(p + e.yyx, power, iters, t) +
    e.yxy * bulbDE(p + e.yxy, power, iters, t) +
    e.xxx * bulbDE(p + e.xxx, power, iters, t)
  );
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);

  int quality = int(uBulbQuality + 0.5);
  int iters = quality >= 2 ? 10 : (quality >= 1 ? 8 : 6);
  int steps = quality >= 2 ? 110 : (quality >= 1 ? 80 : 56);

  // The exponent is the shape. Bass leans on it and a kick shoves it, so the
  // object re-grows rather than just brightening.
  float power = uBulbPower + (uBass * 0.5 + uBeat * 1.6) * uBulbGrow
              + sin(uTime * 0.07) * 0.25;

  // Camera: a slow orbit that also breathes in and out, so the flight never
  // settles into a loop.
  float dist = mix(2.6, 1.55, uScale) - uLevel * 0.08 + sin(uTime * 0.11) * 0.12;
  vec3 ro = vec3(0.0, 0.0, -dist);
  vec3 rd = normalize(vec3(p, 1.6));
  float yaw = uTime * 0.09 + uWarp * 2.0;
  float pitch = sin(uTime * 0.05) * 0.5;
  ro.yz *= rot2(pitch); rd.yz *= rot2(pitch);
  ro.xz *= rot2(yaw);   rd.xz *= rot2(yaw);

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
    float d = bulbDE(pos, power, iters, tr);
    // Proximity glow: light the near-misses, which is what gives a fractal its
    // haze of detail beyond the surface the ray actually reaches.
    glow += 0.012 / (1.0 + d * d * 900.0);
    if (d < 0.0009) {
      hit = true;
      trap = tr;
      break;
    }
    t += d * 0.85; // under-relaxed: the estimate is a bound, not a distance
    if (t > 6.0) break;
  }

  vec3 col = vec3(0.012, 0.014, 0.022) * (1.0 - 0.4 * length(p));
  float rampT = 0.6;

  if (hit) {
    vec3 pos = ro + rd * t;
    vec3 nor = bulbNormal(pos, power, iters);
    vec3 lig = normalize(vec3(0.6, 0.75, -0.5));
    float dif = clamp(dot(nor, lig), 0.0, 1.0);
    float fre = pow(1.0 - clamp(dot(nor, -rd), 0.0, 1.0), 3.0);
    float spe = pow(clamp(dot(reflect(-lig, nor), -rd), 0.0, 1.0), 28.0);
    // Ambient occlusion for free: a ray that needed many steps to arrive was
    // grinding through a crevice, and crevices are dark.
    float ao = 1.0 - float(used) / float(steps);
    ao = clamp(ao * 1.25, 0.15, 1.0);

    // Orbit trap picks the colour, so bands follow the fractal's own structure.
    rampT = 0.1 + trap * 1.1 + uHigh * 0.15;
    col = themeRamp(rampT) * (0.18 + dif * 0.85) * ao;
    col += themeRamp(rampT + 0.3) * fre * 0.5;
    col += vec3(1.0) * spe * (0.25 + uHigh * 0.6);
    // Distance fog, so the flight has depth.
    col = mix(col, vec3(0.012, 0.014, 0.022), clamp(t / 6.0, 0.0, 1.0) * 0.6);
  }

  col += themeRamp(0.45 + uLevel * 0.2) * glow * (0.5 + uLevel * 1.4) * uBulbGlow;
  col *= mix(0.7, 1.9, uGain);
  return themed(col, rampT);
}
