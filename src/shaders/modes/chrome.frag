// CHROME — a slug of molten metal.
//
// The shape is an SDF blob, but the shape is not the point: a mirror has no
// colour of its own, so what you see is entirely **what it reflects**. This
// builds a procedural environment — a bright overhead bar, a dim floor, a few
// horizon bands — and reflects it off the surface. That's why the blob reads
// as metal rather than as a coloured ball with a shiny highlight: the bands
// bend as the surface bends, and the bending is the whole cue.
//
// Fresnel does the rest: metal reflects nearly everything at grazing angles,
// so the rim is a hard bright edge while the face shows the darker reflection.
//
// Steering: uChromeMelt = how far it deforms, uChromeRough = polished to
// brushed, uScale = zoom, uGain = brightness. Bass swells the body, kicks
// punch dents into it, highs ripple the surface.

mat2 rotC(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float sminC(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// The slug: a core with a few blobs welded on, deformed by travelling waves.
float chromeDE(vec3 p) {
  p.xz *= rotC(uTime * 0.2);
  p.xy *= rotC(sin(uTime * 0.13) * 0.4);

  float d = length(p) - (0.85 + uBass * 0.25);
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    vec3 c = vec3(
      sin(uTime * (0.4 + fi * 0.2) + fi),
      cos(uTime * (0.3 + fi * 0.25) + fi * 2.1),
      sin(uTime * 0.35 + fi * 3.7)
    ) * (0.55 + uLevel * 0.2);
    d = sminC(d, length(p - c) - (0.33 + uMid * 0.12), 0.45);
  }

  // Travelling surface waves — the "molten" part. A kick punches a dent in.
  float melt = uChromeMelt * (0.05 + uHigh * 0.05);
  d += sin(p.x * 5.0 + uTime * 1.7) * sin(p.y * 4.3 - uTime * 1.3) *
       sin(p.z * 5.7 + uTime * 0.9) * melt;
  d -= uBeat * 0.12 * uChromeMelt * exp(-dot(p, p) * 0.7);
  return d;
}

vec3 chromeNormal(vec3 p) {
  vec2 e = vec2(0.0015, -0.0015);
  return normalize(
    e.xyy * chromeDE(p + e.xyy) +
    e.yyx * chromeDE(p + e.yyx) +
    e.yxy * chromeDE(p + e.yxy) +
    e.xxx * chromeDE(p + e.xxx)
  );
}

// The room the metal lives in. Never drawn directly — only ever seen in the
// reflection, which is why it can be this crude and still convince.
vec3 environment(vec3 dir) {
  // A studio: one big softbox overhead, a dark floor, and a hard horizon
  // between them. Metal reads as metal because of *contrast* in what it
  // reflects — a gently shaded room reflects as gently shaded plastic.
  float bar = smoothstep(0.35, 0.8, dir.y);
  float box = smoothstep(0.86, 0.995, dir.y) * 6.0;     // the softbox itself
  // A second, narrower strip light off to one side gives a second streak.
  float strip = smoothstep(0.55, 0.85, dir.x) * smoothstep(-0.1, 0.35, dir.y) * 1.4;
  // Horizon bands: the thing that bends visibly as the surface curves, and the
  // clearest signal that a surface is a mirror rather than shiny.
  float bands = smoothstep(0.75, 1.0, sin(dir.y * 30.0 + uTime * 0.25));
  bands *= smoothstep(0.45, 0.0, abs(dir.y));

  vec3 col = vec3(0.012, 0.014, 0.02);                   // the dark room
  col += vec3(0.85, 0.9, 1.0) * (bar * 0.35 + box);      // neutral white light
  col += vec3(0.8, 0.85, 1.0) * strip;
  col += themeRamp(0.75) * bands * (0.5 + uMid * 0.9);   // coloured bands
  col += themeRamp(0.15) * smoothstep(0.0, -0.8, dir.y) * 0.25; // floor bounce
  return col;
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);
  vec3 ro = vec3(0.0, 0.0, -mix(3.4, 2.2, uScale));
  vec3 rd = normalize(vec3(p, 1.7));

  float t = 0.0;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    vec3 pos = ro + rd * t;
    float d = chromeDE(pos);
    if (d < 0.0012) { hit = true; break; }
    t += d * 0.85;
    if (t > 8.0) break;
  }

  // Off the metal you see the room itself, dimmed — it's the backdrop.
  vec3 col = environment(rd) * 0.35;
  float rampT = 0.5;

  if (hit) {
    vec3 pos = ro + rd * t;
    vec3 nor = chromeNormal(pos);
    vec3 ref = reflect(rd, nor);

    // Roughness: blur the reflection by bending the ray with the surface
    // normal, which turns polished chrome into brushed steel without a
    // second trace.
    vec3 jitter = nor * (hash(pos.xy * 90.0 + uTime) - 0.5) * uChromeRough * 0.55;
    vec3 env = environment(normalize(ref + jitter));

    // Metal has no diffuse term worth speaking of; fresnel decides how much
    // of the reflection survives, and at grazing angles that's nearly all.
    // Metal reflects nearly everything even head-on — that's what separates
    // it from a dielectric, where the face goes dark and only the rim lights.
    float fres = 0.65 + 0.35 * pow(1.0 - clamp(dot(nor, -rd), 0.0, 1.0), 4.0);
    col = env * fres;
    col += vec3(1.0) * pow(clamp(dot(ref, normalize(vec3(0.3, 1.0, -0.4))), 0.0, 1.0), 70.0)
         * (0.6 + uHigh);
    // A trace of the theme in the body, so a Mono theme still reads as steel
    // and an Ember one as hot metal — kept light, because a strong tint turns
    // the mirror back into coloured plastic.
    col = mix(col, col * themeRamp(0.2 + uLevel * 0.2) * 1.5, 0.12);
    rampT = 0.15 + clamp(luma(col), 0.0, 1.0) * 0.5;
  }

  col *= mix(0.7, 1.8, uGain);
  return themed(col, rampT);
}
