// BLOOM stage 2 of 2 — VERTICAL Gaussian blur + additive composite.
// Blurs the horizontally-blurred bright-pass (uSource) along y to complete the
// separable Gaussian, then adds it onto the pass input (uScene) scaled by
// uBloomIntensity. Highlights gain a soft additive glow.
const float W[5] = float[5](0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);

vec3 render(vec2 uv) {
  vec2 step = vec2(0.0, 2.0 / uResolution.y);
  vec3 sum = texture(uSource, uv).rgb * W[0];
  for (int i = 1; i < 5; i++) {
    vec2 o = step * float(i);
    sum += texture(uSource, uv + o).rgb * W[i];
    sum += texture(uSource, uv - o).rgb * W[i];
  }
  vec3 base = texture(uScene, uv).rgb;
  return base + sum * uBloomIntensity;
}
