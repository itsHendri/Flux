// RAYMARCH — an audio-reactive metaball blob built from signed distance fields
// and sphere-traced. A pulsing core is smooth-unioned with three orbiting
// spheres, with audio-driven high-frequency surface displacement, then lit
// (diffuse + rim + specular) and coloured with a cosine palette, plus an
// additive proximity glow.
//
// Adapted from Inigo Quilez: raymarching distance fields
// (https://iquilezles.org/articles/raymarchingdf/), distance functions
// (https://iquilezles.org/articles/distfunctions/), and smooth-min
// (https://iquilezles.org/articles/smin/).
//
// Steering: uScale = zoom, uWarp = extra spin, uGain = brightness. Bands drive
// the pulse (bass), surface wobble (mid), shimmer/specular (high), glow (level).

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// Polynomial smooth minimum (iq) — blends two SDFs without a hard crease.
float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

vec3 palette(float t) {
  return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67)));
}

// Scene SDF.
float map(vec3 p) {
  p.xz *= rot(uTime * 0.25 + uWarp * 3.0);
  p.xy *= rot(uTime * 0.18);

  // Pulsing core.
  float d = length(p) - (0.75 + uBass * 0.45);

  // Three orbiting spheres, smooth-unioned into the core (metaballs).
  for (int i = 0; i < 3; i++) {
    float a = uTime * 0.8 + float(i) * TAU / 3.0;
    vec3 c = vec3(cos(a), sin(a * 1.3), sin(a)) * (1.1 + uLevel * 0.3);
    float s = length(p - c) - (0.35 + uMid * 0.2);
    d = smin(d, s, 0.5);
  }

  // High-frequency surface displacement (mid-driven, high adds shimmer).
  float disp = sin(6.0 * p.x + uTime) * sin(6.0 * p.y) * sin(6.0 * p.z + uTime) *
               (0.04 + uMid * 0.18 + uHigh * 0.1);
  return d + disp;
}

vec3 calcNormal(vec3 p) {
  vec2 e = vec2(0.0012, 0.0);
  return normalize(vec3(
    map(p + e.xyy) - map(p - e.xyy),
    map(p + e.yxy) - map(p - e.yxy),
    map(p + e.yyx) - map(p - e.yyx)
  ));
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);

  // Camera — uScale zooms by changing the focal length.
  vec3 ro = vec3(0.0, 0.0, 3.2);
  vec3 rd = normalize(vec3(p, -mix(1.2, 2.4, uScale)));

  // Sphere-trace. Displacement breaks the strict SDF, so under-step a little.
  float t = 0.0;
  float glow = 0.0;
  bool hit = false;
  for (int i = 0; i < 90; i++) {
    vec3 pos = ro + rd * t;
    float d = map(pos);
    glow += 0.016 / (1.0 + d * d * 22.0); // accumulate proximity glow
    if (d < 0.001) {
      hit = true;
      break;
    }
    t += d * 0.6;
    if (t > 8.0) break;
  }

  // Background — dark vertical gradient.
  vec3 col = mix(vec3(0.02, 0.025, 0.04), vec3(0.05, 0.02, 0.07), uv.y);

  if (hit) {
    vec3 pos = ro + rd * t;
    vec3 nor = calcNormal(pos);
    vec3 lig = normalize(vec3(0.7, 0.8, 0.4));
    float dif = clamp(dot(nor, lig), 0.0, 1.0);
    float amb = 0.4 + 0.6 * nor.y;
    float fre = pow(1.0 - clamp(dot(nor, -rd), 0.0, 1.0), 3.0); // rim
    float spe = pow(clamp(dot(reflect(-lig, nor), -rd), 0.0, 1.0), 24.0);

    vec3 base = palette(0.55 + length(pos) * 0.15 + uBass * 0.2 + uTime * 0.03);
    col = base * (amb * 0.35 + dif * 0.85);
    col += vec3(1.0) * spe * (0.4 + uHigh);
    col += palette(0.1 + uHigh * 0.4) * fre * 0.6;
  }

  // Additive proximity glow, coloured and level-driven (steerable amount).
  col += palette(0.6 + uLevel * 0.3) * glow * (0.6 + uLevel * 1.2) * uRayGlow;

  // Overall brightness control.
  col *= mix(0.7, 1.6, uGain);
  return themed(col, 0.15 + luma(col) * 0.6);
}
