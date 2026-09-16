// FLOW — domain-warped flow field. Recursive domain warping: fbm of fbm of fbm,
// where each level displaces the sampling position of the next. The intermediate
// warp vectors (q, r) drive the colour, and advecting them over time makes the
// whole field churn like a slow fluid. Audio adds turbulence and colour.
//
// Adapted from Inigo Quilez's domain-warping article
// (https://iquilezles.org/articles/warp/) — including his fbm-of-fbm structure
// and q/r-based colouring — with time advection, audio reactivity, and steering.
//
// Steering: uScale = zoom, uWarp = warp strength, uGain = brightness. Bass adds
// turbulence, mid shifts hue, high sharpens detail, level drives brightness.

// Fractional Brownian motion: stacked octaves of value noise (from common.glsl).
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p *= 2.0;
    a *= 0.5;
  }
  return v;
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv) * mix(1.4, 4.0, uScale);
  float t = uTime * 0.12;

  // Warp strength — uWarp plus a bass-driven turbulence boost.
  float w = mix(2.5, 6.0, uWarp) * (0.7 + uBass * 0.8);

  // Level 1 warp — drift the field over time so it flows.
  vec2 q = vec2(fbm(p + vec2(0.0, 0.0) + t), fbm(p + vec2(5.2, 1.3) - t));

  // Level 2 warp — sample displaced by level 1; detail from high + Turbulence.
  float detail = 1.0 + uHigh * 1.5 + uFlowTurb * 2.0;
  vec2 r = vec2(
    fbm((p + w * q) * detail + vec2(1.7, 9.2) + t * 1.3),
    fbm((p + w * q) * detail + vec2(8.3, 2.8) - t * 0.9)
  );

  // Final field, warped by level 2.
  float f = fbm(p + w * r);

  // Colouring driven by f, q, r (iq) — deep violets to warm embers, with a
  // mid-driven hue tint layered in for audio colour.
  vec3 col = mix(vec3(0.10, 0.06, 0.30), vec3(0.42, 0.10, 0.10), clamp(f * f * 2.2, 0.0, 1.0));
  col = mix(col, vec3(0.03, 0.05, 0.28), clamp(length(q), 0.0, 1.0));
  col = mix(col, vec3(0.05, 0.32, 0.45), clamp(r.y * r.y, 0.0, 1.0));
  col = mix(col, hsv(0.05 + uMid * 0.6 + f * 0.2, 0.7, 1.0), uMid * 0.5);

  // iq's brightness shaping from the field, lifted by overall level.
  col *= (f * f * f + 0.6 * f * f + 0.55 * f) * (1.4 + uLevel * 1.6);

  // Bright filaments along level-2 ridges, sharpened by high.
  float fil = smoothstep(0.55, 0.95, r.x);
  col += vec3(0.7, 0.85, 1.0) * fil * (0.15 + uHigh * 0.5);

  col *= mix(0.7, 1.7, uGain);
  return themed(col, f);
}
