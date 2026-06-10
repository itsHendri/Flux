// PRESENT — the final draw to the default framebuffer (not a toggleable pass;
// the Renderer compiles and runs it directly). Resolves the possibly-HDR chain
// output for display: optional tonemap, then clamp to the displayable range.
// A shader draw rather than blitFramebuffer because ES 3.0 forbids blitting a
// float read buffer to the fixed-point default framebuffer.
//
// Tonemap select: 0 = none (clamp only), 1 = Reinhard, 2 = ACES filmic
// approximation (Krzysztof Narkowicz 2015, "ACES Filmic Tone Mapping Curve").

vec3 acesApprox(vec3 c) {
  c *= 0.6;
  return clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
}

vec3 render(vec2 uv) {
  vec3 c = texture(uSource, uv).rgb;
  int mode = int(uTonemap + 0.5);
  if (mode == 1) c = c / (1.0 + c);
  else if (mode == 2) c = acesApprox(c);
  return clamp(c, 0.0, 1.0);
}
