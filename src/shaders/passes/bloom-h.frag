// BLOOM stage 1 of 2 — bright-pass + HORIZONTAL Gaussian blur.
// Isolates pixels above uBloomThreshold (soft knee), then blurs them along x
// with a 9-tap Gaussian. The vertical stage finishes the separable blur and
// composites. 9-tap weights from the standard GPU Gems separable kernel.
const float W[5] = float[5](0.2270270270, 0.1945945946, 0.1216216216, 0.0540540541, 0.0162162162);

vec3 brightPass(vec3 c) {
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Soft knee so the bloom ramps in rather than hard-clipping at the threshold.
  float k = smoothstep(uBloomThreshold, uBloomThreshold + 0.15, l);
  return c * k;
}

vec3 render(vec2 uv) {
  // Step a couple of texels per tap so a 9-tap reaches a visible radius.
  vec2 step = vec2(2.0 / uResolution.x, 0.0);
  vec3 sum = brightPass(texture(uSource, uv).rgb) * W[0];
  for (int i = 1; i < 5; i++) {
    vec2 o = step * float(i);
    sum += brightPass(texture(uSource, uv + o).rgb) * W[i];
    sum += brightPass(texture(uSource, uv - o).rgb) * W[i];
  }
  return sum;
}
