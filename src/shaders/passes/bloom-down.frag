// BLOOM stage 1 of 3 — progressive 13-tap downsample (Jimenez, SIGGRAPH 2014,
// "Next Generation Post Processing in Call of Duty: Advanced Warfare"; cf. the
// LearnOpenGL "Phys. Based Bloom" guest article). Five overlapping 4-tap boxes
// (centre weight 0.5, corners 0.125 each) — the kernel that keeps the pyramid
// temporally stable where a plain box pulsates.
//
// On the first mip only (uFirstMip, drawn once per level by BloomPipeline):
//  - soft-knee bright-pass on uBloomThreshold; at 0 everything passes —
//    the fully energy-conserving mode (no hard threshold).
//  - Karis luma-weighted box average (w = 1/(1+luma)) to suppress fireflies.

uniform float uFirstMip;

// luma() is the same Rec. 709 weighting the theme uses, so it lives in
// common.glsl now rather than being defined twice.

vec3 knee(vec3 c) {
  float l = luma(c);
  float k = uBloomThreshold <= 0.0 ? 1.0 : smoothstep(uBloomThreshold, uBloomThreshold + 0.15, l);
  return c * k;
}

vec3 render(vec2 uv) {
  vec2 t = 1.0 / vec2(textureSize(uSource, 0));

  // 3×3 outer grid at ±2 texels (a..i) + inner 2×2 at ±1 (j..m).
  vec3 a = texture(uSource, uv + t * vec2(-2.0,  2.0)).rgb;
  vec3 b = texture(uSource, uv + t * vec2( 0.0,  2.0)).rgb;
  vec3 c = texture(uSource, uv + t * vec2( 2.0,  2.0)).rgb;
  vec3 d = texture(uSource, uv + t * vec2(-2.0,  0.0)).rgb;
  vec3 e = texture(uSource, uv).rgb;
  vec3 f = texture(uSource, uv + t * vec2( 2.0,  0.0)).rgb;
  vec3 g = texture(uSource, uv + t * vec2(-2.0, -2.0)).rgb;
  vec3 h = texture(uSource, uv + t * vec2( 0.0, -2.0)).rgb;
  vec3 i = texture(uSource, uv + t * vec2( 2.0, -2.0)).rgb;
  vec3 j = texture(uSource, uv + t * vec2(-1.0,  1.0)).rgb;
  vec3 k = texture(uSource, uv + t * vec2( 1.0,  1.0)).rgb;
  vec3 l = texture(uSource, uv + t * vec2(-1.0, -1.0)).rgb;
  vec3 m = texture(uSource, uv + t * vec2( 1.0, -1.0)).rgb;

  if (uFirstMip > 0.5) {
    // Per-box averages, bright-passed, then Karis-weighted so a single hot
    // pixel can't dominate (and flicker) at lower mips.
    vec3 b0 = knee((j + k + l + m) * 0.25); // centre box, weight 0.5
    vec3 b1 = knee((a + b + d + e) * 0.25); // corner boxes, weight 0.125
    vec3 b2 = knee((b + c + e + f) * 0.25);
    vec3 b3 = knee((d + e + g + h) * 0.25);
    vec3 b4 = knee((e + f + h + i) * 0.25);
    float w0 = 0.5 / (1.0 + luma(b0));
    float w1 = 0.125 / (1.0 + luma(b1));
    float w2 = 0.125 / (1.0 + luma(b2));
    float w3 = 0.125 / (1.0 + luma(b3));
    float w4 = 0.125 / (1.0 + luma(b4));
    return (b0 * w0 + b1 * w1 + b2 * w2 + b3 * w3 + b4 * w4) / (w0 + w1 + w2 + w3 + w4);
  }

  // Plain weighted 13-tap (weights sum to 1).
  return e * 0.125 + (a + c + g + i) * 0.03125 + (b + d + f + h) * 0.0625 + (j + k + l + m) * 0.125;
}
