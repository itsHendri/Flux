// MANDALA — a kaliset fractal folded through a kaleidoscope.
//
// The kaliset (Kali, fractalforums) is three operations in a loop:
// `p = abs(p) / dot(p, p) - c`. The abs() folds the plane, the divide by the
// squared length inverts it through the unit circle, and c shifts the whole
// thing before the next fold. Iterated, that produces the dense filigree this
// mode is made of; c is the only thing deciding which filigree, which is why a
// kick nudging it opens and closes the whole pattern at once.
// References: https://www.shadertoy.com/view/MsBGDK (Basic KaliSet),
// https://softologyblog.wordpress.com/2011/05/04/kalisets-and-hybrid-ducks/
//
// The radial fold in front of it is the same angular mirror the kaleidoscope
// pass uses — done here rather than after, so the fractal is generated in
// wedge space and meets itself exactly at the seams.
//
// Steering: uScale = zoom, uMandalaSegs = wedges, uMandalaFold = how far c
// travels, uWarp = twist, uGain = brightness. Bass and the kick move c (the
// pattern breathes), mid rotates, high sharpens the filaments.

vec3 render(vec2 uv) {
  vec2 p = centered(uv) * mix(2.2, 0.7, uScale);

  // Radial fold into mirrored wedges.
  float segs = max(2.0, floor(uMandalaSegs + 0.5));
  float seg = TAU / segs;
  float r = length(p);
  float a = atan(p.y, p.x);
  a = abs(mod(a, seg) - seg * 0.5);
  // Mids turn the rosette; uWarp twists it with radius so the arms curl.
  a += uTime * 0.07 + uMid * 0.5 + r * uWarp * 0.8;
  p = vec2(cos(a), sin(a)) * r;

  // The kaliset. c is the shape parameter: the kick pushes it, so every hit
  // re-cuts the filigree rather than just brightening it.
  vec2 c = vec2(0.86, 0.61)
         + vec2(sin(uTime * 0.11), cos(uTime * 0.13)) * 0.035
         + (uBass * 0.06 + uBeat * 0.09) * uMandalaFold;

  float trap = 1e9;   // closest approach to the unit circle — the filaments
  float glow = 0.0;   // how much time the orbit spends near the origin
  for (int i = 0; i < 14; i++) {
    p = abs(p) / max(dot(p, p), 1e-4) - c;
    float l = length(p);
    trap = min(trap, abs(l - 1.0));
    glow += exp(-l * 2.2);
  }
  glow /= 14.0;

  // Filaments are where the orbit grazed the unit circle; sharpen with highs.
  float line = exp(-trap * mix(26.0, 60.0, uHigh));
  vec3 col = themeRamp(0.12 + glow * 1.4 + uTime * 0.01) * glow * 0.8;
  col += themeRamp(0.5 + trap * 2.0) * line * (0.35 + uLevel * 0.7 + uBeat * 0.45);

  // Centre bloom, so the rosette has a heart.
  col += themeRamp(0.25) * exp(-r * 6.0) * (0.15 + uLevel * 0.35);

  col *= mix(0.45, 1.3, uGain);
  return themed(col, 0.1 + glow * 1.2);
}
