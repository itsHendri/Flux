// RAYMARCH — an audio-reactive metaball blob built from signed distance fields
// and sphere-traced. A breathing core is smooth-unioned with six satellites on
// Lissajous orbits, with a travelling surface ripple, then lit (diffuse + rim +
// specular) and coloured with thin-film iridescence, plus an additive proximity
// glow.
//
// Adapted from Inigo Quilez: raymarching distance fields
// (https://iquilezles.org/articles/raymarchingdf/), distance functions
// (https://iquilezles.org/articles/distfunctions/), and smooth-min
// (https://iquilezles.org/articles/smin/).
//
// Steering: uScale = zoom, uWarp = extra spin, uRayIris = iridescence,
// uGain = brightness. Bass breathes the core, mid ripples the surface and swells
// the satellites, highs shimmer, level lifts the glow, and a kick throws the
// satellites outward.

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
  // The whole system tumbles slowly on two axes, so the blob is never seen
  // from the same side for long.
  p.xz *= rot(uTime * 0.23 + uWarp * 3.0);
  p.xy *= rot(sin(uTime * 0.17) * 0.6);

  // A breathing core.
  float d = length(p) - (0.6 + uBass * 0.38);

  // Six satellites on Lissajous orbits. Every one has its own speed and phase
  // on each axis, and none of the ratios are simple, so the cluster keeps
  // re-forming instead of settling into a loop you can see repeat. A kick
  // throws them all outward; the smooth-union pulls them back into the body.
  for (int i = 0; i < 6; i++) {
    float fi = float(i);
    float sp = 0.42 + 0.17 * fi;
    vec3 c = vec3(
      sin(uTime * sp + fi * 1.7),
      sin(uTime * sp * 1.31 + fi * 2.9),
      cos(uTime * sp * 0.87 + fi * 0.6)
    );
    c *= 1.0 + 0.25 * sin(uTime * 0.31 + fi) + uBeat * 0.45 + uLevel * 0.15;
    float r = 0.22 + 0.08 * sin(uTime * 1.3 + fi * 2.1) + uMid * 0.12;
    d = smin(d, length(p - c) - r, 0.42);
  }

  // A surface ripple that travels (all three terms move) rather than one that
  // just breathes in place; mid drives its depth, highs add shimmer.
  float disp = sin(3.1 * p.x + uTime * 1.3) * sin(2.7 * p.y - uTime * 1.1) *
               sin(3.4 * p.z + uTime * 0.9) * (0.03 + uMid * 0.16 + uHigh * 0.08);
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
  // Where each pixel sits on the theme ramp. Indexing by brightness (as this
  // mode used to) pulls every lit patch of the blob to the same stop; indexing
  // by the iridescence phase below spreads the theme across the surface.
  float rampT = 0.62 + uv.y * 0.2;

  if (hit) {
    vec3 pos = ro + rd * t;
    vec3 nor = calcNormal(pos);
    vec3 lig = normalize(vec3(0.7, 0.8, 0.4));
    float dif = clamp(dot(nor, lig), 0.0, 1.0);
    float amb = 0.4 + 0.6 * nor.y;
    float ndv = clamp(dot(nor, -rd), 0.0, 1.0);
    float fre = pow(1.0 - ndv, 3.0); // rim
    float spe = pow(clamp(dot(reflect(-lig, nor), -rd), 0.0, 1.0), 24.0);

    // Thin-film iridescence — the oil-slick sheen of the iTunes nebula clouds.
    // Real thin-film colour depends on the film's thickness and the viewing
    // angle; approximating the phase with the grazing angle, the surface
    // orientation and position gives bands that slide across the blob as it
    // turns, which is the whole effect. Highs push the phase for shimmer.
    float film = (1.0 - ndv) * 1.7 + dot(nor, vec3(0.3, 0.6, 0.2)) * 0.55 +
                 length(pos) * 0.45 + uTime * 0.05 + uHigh * 0.3;
    vec3 iri = palette(film);
    vec3 base = mix(palette(0.55 + length(pos) * 0.15 + uTime * 0.03), iri, uRayIris);

    col = base * (amb * 0.35 + dif * 0.85);
    col += vec3(1.0) * spe * (0.4 + uHigh);
    col += palette(film + 0.33) * fre * (0.5 + uRayIris * 0.5);
    rampT = mix(0.55 + length(pos) * 0.15, film, uRayIris);
  }

  // Additive proximity glow, coloured and level-driven (steerable amount).
  col += palette(0.6 + uLevel * 0.3 + uTime * 0.02) * glow * (0.6 + uLevel * 1.2) * uRayGlow;

  // Overall brightness control.
  col *= mix(0.7, 1.6, uGain);
  return themed(col, rampT);
}
