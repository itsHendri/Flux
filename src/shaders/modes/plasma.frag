// PLASMA — domain-warped fractal noise with two layered, band-driven colour
// fields mixed against each other, plus glowing mid-driven veins.

// Fractional Brownian motion: stacked octaves of value noise.
float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.6;
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p *= 2.0;
    amp *= 0.5;
  }
  return v;
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv) * mix(1.0, 3.2, uScale);
  float t = uTime * 0.22;
  float warp = mix(0.2, 2.0, uWarp) * (0.4 + uLevel);

  // Layer 1 — domain-warped fbm, nudged by bass + high.
  vec2 q = vec2(fbm(p + t), fbm(p - t + 4.7));
  float n1 = fbm(p + warp * q + vec2(uBass, uHigh) * 0.7);

  // Layer 2 — finer scale, opposite drift, for colour contrast.
  vec2 r = vec2(fbm(p * 1.8 - t * 0.6 + 9.1), fbm(p * 1.8 + t * 0.7));
  float n2 = fbm(p * 1.8 + warp * 0.7 * r - t);

  // Two hue fields, band-shifted, blended by the layers themselves.
  vec3 cA = hsv(0.58 + n1 * 0.25 + uBass * 0.15 + t * 0.05, 0.80, 1.0);
  vec3 cB = hsv(0.02 + n2 * 0.30 + uHigh * 0.22, 0.85, 1.0);
  vec3 col = mix(cA, cB, smoothstep(0.30, 0.80, n2));

  // Brightness shaped by layer 1 and overall level.
  col *= smoothstep(0.15, 0.95, n1) * (0.45 + uLevel * 0.9);

  // Mid-driven glowing veins along an iso-contour of layer 1.
  float veins = smoothstep(0.045, 0.0, abs(n1 - 0.5));
  col += hsv(0.12 + uMid * 0.25, 0.7, 1.0) * veins * uMid * 0.8;

  col += vec3(0.015, 0.02, 0.03);
  return col;
}
