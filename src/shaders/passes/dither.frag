// ORDERED DITHER — quantises each channel to uDitherLevels steps against a
// threshold pattern selected by uDitherMode:
//   0 Bayer (2/4/8 via uDitherSize) — cross-hatched retro look, the most
//     temporally stable in motion (why engines keep it);
//   1 Interleaved Gradient Noise (Jimenez, SIGGRAPH 2014) — procedural,
//     diagonal-gradient character, much less structured in static frames;
//   2 Blue noise (uBlueNoise: 128×128 tileable, Christoph Peters CC0,
//     momentsingraphics.de) — structureless grain, best static quality.
// uDitherTemporal re-seeds the pattern per frame (Jimenez's golden-ratio-ish
// frame offset), trading static cleanliness for temporal averaging.
//
// Bayer matrices adapted from hughsk/glsl-dither (MIT) and the ordered-
// dithering technique described by Maxime Heckel and the Codrops dithering
// guide. IGN constants from Jimenez via demofox's write-up.

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

// Interleaved Gradient Noise — Jimenez 2014.
float ign(vec2 px) {
  return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715))));
}

vec3 render(vec2 uv) {
  vec3 c = texture(uSource, uv).rgb;

  // Optional temporal re-seed: shift the pattern each frame (64-frame cycle).
  float frame = uDitherTemporal > 0.5 ? mod(floor(uTime * 60.0), 64.0) : 0.0;
  vec2 px = gl_FragCoord.xy + 5.588238 * frame;

  float t;
  int mode = int(uDitherMode + 0.5);
  if (mode == 1) {
    t = ign(px);
  } else if (mode == 2) {
    // REPEAT wrap tiles the noise; NEAREST keeps thresholds exact.
    t = texture(uBlueNoise, px / vec2(textureSize(uBlueNoise, 0))).r;
  } else {
    // Snap the matrix-size control to one of {2, 4, 8}.
    int n = uDitherSize < 3.0 ? 2 : (uDitherSize < 6.0 ? 4 : 8);
    t = bayerThreshold(n, ivec2(px));
  }

  // Quantise each channel to L levels, dithering between adjacent levels.
  float L = max(2.0, floor(uDitherLevels + 0.5));
  vec3 scaled = clamp(c, 0.0, 1.0) * (L - 1.0);
  vec3 lower = floor(scaled);
  vec3 frac = scaled - lower;
  return (lower + step(t, frac)) / (L - 1.0);
}
