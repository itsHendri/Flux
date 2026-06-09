// PALETTE QUANTIZE — reduce the scene to N colours by mapping luminance onto a
// cosine palette sampled at N quantised steps. Bass rotates the palette phase,
// so the colour scheme shifts on the beat. Toggleable; N via uPaletteColors.
//
// Cosine palette: a + b*cos(2π(c*t + d)) — Inigo Quilez's palette technique
// (https://iquilezles.org/articles/palettes/). The d offsets give a vivid ramp.
vec3 palette(float t) {
  return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67)));
}

vec3 render(vec2 uv) {
  vec3 src = texture(uSource, uv).rgb;
  float lum = dot(clamp(src, 0.0, 1.0), vec3(0.299, 0.587, 0.114));

  // Quantise the palette index into N discrete steps over [0,1].
  float N = max(2.0, floor(uPaletteColors + 0.5));
  float idx = floor(lum * (N - 1.0) + 0.5) / (N - 1.0);

  // Manual phase offset plus a bass-driven hue rotation.
  float shift = uPaletteShift + uBass * 0.4;
  return palette(idx + shift);
}
