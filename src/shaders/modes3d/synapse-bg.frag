// SYNAPSE backdrop — deep space: near-black with a faint glow of the theme
// toward the centre and a sparse field of fixed dust, so the constellation
// grows against a sky rather than a void.
in vec2 vUv;
out vec4 outColor;

void main() {
  vec2 p = centered(vUv);
  vec3 col = themeRamp(0.55) * 0.025 * exp(-dot(p, p) * 0.8);
  // Offset the cell ids off the integer lattice: the shared hash shows faint
  // rows on whole-number inputs, which read as a grid of dust.
  vec2 cell = floor(vUv * uResolution / 3.0);
  float h = hash(cell * 0.7131 + vec2(17.13, 4.77));
  col += vec3(0.6, 0.65, 0.8) * step(0.999, h) * (0.1 + 0.25 * hash(cell * 0.391 + 7.3));
  outColor = vec4(col, 1.0);
}
