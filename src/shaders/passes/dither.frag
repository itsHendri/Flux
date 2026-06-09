// BAYER ORDERED DITHER — quantises each channel to uDitherLevels steps using an
// ordered Bayer threshold matrix, giving the classic cross-hatched retro look.
// Matrix size (2 / 4 / 8) is selectable via uDitherSize; larger = finer pattern.
//
// Canonical Bayer matrices; per-channel quantisation between adjacent levels via
// step(threshold, frac). Adapted from hughsk/glsl-dither (MIT) and the ordered-
// dithering technique described by Maxime Heckel and the Codrops dithering guide.

const int BAYER2[4] = int[4](0, 2, 3, 1);

const int BAYER4[16] = int[16](
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5
);

const int BAYER8[64] = int[64](
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
);

// Ordered threshold in [0,1) for the pixel at integer coord p, matrix size n.
float bayerThreshold(int n, ivec2 p) {
  if (n <= 2) {
    int i = (p.y & 1) * 2 + (p.x & 1);
    return (float(BAYER2[i]) + 0.5) / 4.0;
  } else if (n <= 4) {
    int i = (p.y & 3) * 4 + (p.x & 3);
    return (float(BAYER4[i]) + 0.5) / 16.0;
  }
  int i = (p.y & 7) * 8 + (p.x & 7);
  return (float(BAYER8[i]) + 0.5) / 64.0;
}

vec3 render(vec2 uv) {
  vec3 c = texture(uSource, uv).rgb;

  // Snap the matrix-size control to one of {2, 4, 8}.
  int n = uDitherSize < 3.0 ? 2 : (uDitherSize < 6.0 ? 4 : 8);
  float t = bayerThreshold(n, ivec2(gl_FragCoord.xy));

  // Quantise each channel to L levels, dithering between adjacent levels.
  float L = max(2.0, floor(uDitherLevels + 0.5));
  vec3 scaled = clamp(c, 0.0, 1.0) * (L - 1.0);
  vec3 lower = floor(scaled);
  vec3 frac = scaled - lower;
  return (lower + step(t, frac)) / (L - 1.0);
}
