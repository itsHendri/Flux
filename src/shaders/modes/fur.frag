// FUR — a field of hair the music brushes.
//
// Shell rendering, done in screen space. Real fur is drawn as a stack of
// concentric shells, each holding a cross-section of the strands; the same
// idea works flat: sample a strand mask repeatedly, stepping the sample point
// backwards along the direction the hair is lying, and each step is one slice
// further up the strand. Stack the slices and the eye reads them as hairs
// standing up out of the surface.
//
// The strand mask is a cell hash — one hair per cell, its own thickness and
// its own length — so the hairs are individuals rather than a texture.
//
// Lighting is Kajiya-Kay: a hair is a cylinder, so its highlight is a band
// *across* the strand, not a dot, and it depends on the angle to the strand's
// direction rather than to a surface normal. That band is what separates fur
// from noise.
//
// Steering: uFurLength, uFurDensity, uFurBrush (how hard the music combs it),
// uGain. Bass sweeps the parting, highs make the tips shiver, a kick lays the
// whole coat over.

// The direction each hair lies in: a slow flow field, pushed by the music.
vec2 combDirection(vec2 p) {
  float t = uTime * 0.13;
  // Two out-of-phase noise fields make a field with partings and crowns in it,
  // rather than one that all leans the same way.
  float a = noise(p * 1.1 + vec2(t, -t)) * TAU;
  float b = noise(p * 0.6 + vec2(-t * 0.7, t * 0.5)) * TAU;
  vec2 dir = vec2(cos(a), sin(a)) + 0.6 * vec2(cos(b), sin(b));
  // The music combs it: bass swings the parting, a kick lays the coat flat in
  // one direction.
  float sweep = uBass * 2.2 + uBeat * 1.6;
  dir += vec2(cos(sweep), sin(sweep * 0.8)) * uFurBrush * 1.4;
  return normalize(dir + 1e-5);
}

// One slice of the coat: which hairs this point is inside, at height `h`.
// Returns coverage, and writes the hair's own random shade.
float strand(vec2 p, float h, float density, out float tone) {
  vec2 cell = floor(p * density);
  vec2 f = fract(p * density);
  float id = hash(cell);
  tone = hash(cell + 3.7);
  // Each hair sits at its own offset in its cell and has its own thickness;
  // hairs thin toward the tip, which is what makes the coat look soft at the
  // top rather than chopped off.
  vec2 seat = vec2(id, hash(cell + 1.3));
  float thickness = (0.42 - 0.3 * h) * (0.6 + 0.8 * hash(cell + 9.1));
  float d = length(f - seat);
  // Short hairs stop early, so the coat has depth instead of a flat ceiling.
  float len = 0.45 + 0.55 * hash(cell + 5.5);
  return smoothstep(thickness, thickness * 0.35, d) * step(h, len);
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv) * 1.2;
  vec2 dir = combDirection(p);

  float density = mix(14.0, 46.0, uFurDensity);
  float length_ = mix(0.05, 0.16, uFurLength) * (1.0 + uHigh * 0.25);

  const int SHELLS = 14;
  vec3 col = vec3(0.0);
  float cover = 0.0;

  // Walk from the roots up. Later shells are nearer the tips: brighter,
  // because light reaches the top of a coat and not the bottom.
  for (int i = 0; i < SHELLS; i++) {
    float h = float(i) / float(SHELLS - 1);
    // Step back along the comb direction: this is the hair leaning over.
    vec2 q = p - dir * h * length_;
    float tone;
    float a = strand(q, h, density, tone);
    if (a <= 0.0) continue;

    // Kajiya-Kay: the highlight is a band across the strand, strongest where
    // the light is perpendicular to the hair's direction.
    vec2 lig = normalize(vec2(0.55, 0.8));
    float along = abs(dot(dir, lig));
    float sheen = pow(1.0 - along * along, 8.0);

    float depth = 0.25 + 0.75 * h;              // roots are in shadow
    vec3 hairCol = themeRamp(0.08 + tone * 0.5 + h * 0.18);
    vec3 lit = hairCol * depth * (0.7 + 0.5 * tone);
    lit += themeRamp(0.75) * sheen * h * h * (0.35 + uMid * 0.8);
    // Tips catch the light on transients.
    lit += vec3(1.0) * sheen * smoothstep(0.75, 1.0, h) * uHigh * 0.5;

    // Over-compositing from root to tip: nearer shells cover further ones.
    col = mix(col, lit, a * (1.0 - cover * 0.55));
    cover = max(cover, a);
  }

  // The skin under the coat, where it parts.
  col = mix(themeRamp(0.02) * 0.06, col, cover);
  col *= mix(0.7, 2.0, uGain) * (0.8 + uLevel * 0.5);
  return themed(col, 0.1 + cover * 0.4);
}
