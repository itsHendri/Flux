// SAND — a Chladni plate. Sand on a vibrating plate is thrown off the moving
// parts and settles on the nodal lines, where the surface isn't moving at all,
// which is why a driven plate draws a figure in sand instead of a mess.
//
// For a square plate the standing wave is
//   cos(n·pi·x) · cos(m·pi·y) − cos(m·pi·x) · cos(n·pi·y)
// and the figure is its zero set; the integers n and m are the mode numbers
// (https://paulbourke.net/geometry/chladni/, and the Processing tutorial at
// barbegenerativediary.com).
//
// FLUX picks n and m from the two loudest parts of the spectrum, so what the
// plate is "driven" by is the music: while a chord holds, the figure holds,
// and when the dominant frequencies move to another band the integers step and
// the figure redraws itself. That stability is free — integers only change
// when the peak crosses a band edge, so ordinary spectral jitter doesn't shake
// the picture.
//
// Steering: uScale = plate size, uSandGrain = grain size, uSandSpread = how
// loosely the sand sits on the line, uGain = brightness.

// Which two plate modes the music is driving.
//
// Not the two loudest bins: a single sustained note leaks across neighbouring
// bins and the analyser has a noise floor, so an argmax over the spectrum
// jitters between bands that differ by a hair, and the plate twitches. The
// **centroid** — the energy-weighted average position — is the frequency the
// spectrum balances around. It moves smoothly with the music and, quantised to
// an integer mode number, it holds still while a chord holds and steps when
// the music moves, which is exactly the behaviour a plate has.
//
// n comes from the whole spectrum, m from its upper half, so the two modes
// track the body of the sound and its brightness separately.
void dominantModes(out float n, out float m) {
  const int BANDS = 16;
  const float MODES = 10.0; // usable mode numbers: 2 .. 11

  float sum = 0.0, weighted = 0.0;
  float hiSum = 0.0, hiWeighted = 0.0;
  for (int i = 0; i < BANDS; i++) {
    float x = (float(i) + 0.5) / float(BANDS);
    // Tilted the way a spectrum analyser is: music carries far more energy low
    // down, and on a flat reading the kick decides everything.
    float v = spectrumLog(x) * (0.55 + x * 0.6);
    sum += v;
    weighted += v * x;
    if (x > 0.45) {
      hiSum += v;
      hiWeighted += v * x;
    }
  }

  // Silence: a fixed, pleasant figure rather than a divide by zero.
  // (Not named `centroid` — that's a reserved interpolation qualifier in GLSL
  // ES 3.0, and using it is a syntax error the compiler reports on the line
  // after the declaration.)
  float balance = sum > 0.02 ? weighted / sum : 0.3;
  float hiBalance = hiSum > 0.02 ? hiWeighted / hiSum : 0.72;

  // Real music's centroid lives in a narrow middle band of the log axis, so
  // it's stretched across the mode range — otherwise the plate only ever uses
  // the middle mode numbers and every track looks alike.
  n = 2.0 + floor(clamp((balance - 0.18) / 0.5, 0.0, 0.999) * MODES);
  m = 2.0 + floor(clamp((hiBalance - 0.45) / 0.55, 0.0, 0.999) * MODES);
  // Equal mode numbers cancel the expression to zero everywhere — no figure at
  // all — and adjacent ones give one or two lazy bands.
  if (abs(n - m) < 2.0) m = 2.0 + mod(n + 1.0, MODES);
}

vec3 render(vec2 uv) {
  // Framed so the whole square plate is on screen at the default Scale: the
  // figure is a property of the plate, and cropping into it loses the symmetry
  // that makes it read as one.
  vec2 p = centered(uv) / mix(1.25, 0.5, uScale);

  float n, m;
  dominantModes(n, m);

  // The plate, in 0..1 on both axes.
  vec2 q = p * 0.5 + 0.5;
  float w = cos(n * PI * q.x) * cos(m * PI * q.y)
          - cos(m * PI * q.x) * cos(n * PI * q.y);

  // Sand settles where the plate is still. Loud music shakes it off the line,
  // so the figure tightens as the level drops — the real plate's behaviour.
  float spread = mix(0.008, 0.07, uSandSpread) * (0.6 + uLevel * 0.8);
  float onLine = exp(-abs(w) * abs(w) / (spread * spread));

  // Grains: a static speckle field, not noise per frame, so the sand looks
  // like grains sitting still rather than television static. They jostle
  // slightly on each hit.
  float cell = mix(700.0, 220.0, uSandGrain);
  vec2 g = q * cell;
  vec2 jitter = vec2(uBeat * 0.35 * (hash(floor(g)) - 0.5),
                     uBeat * 0.35 * (hash(floor(g) + 7.1) - 0.5));
  float grain = hash(floor(g + jitter));
  float sand = onLine * step(0.35, grain) * (0.55 + 0.45 * grain);

  // Inside the plate only; beyond its edge the sand has fallen off.
  vec2 edge = smoothstep(vec2(0.0), vec2(0.02), q) * smoothstep(vec2(1.0), vec2(0.98), q);
  float inside = edge.x * edge.y;

  vec3 col = vec3(0.015, 0.016, 0.022) * inside;
  col += themeRamp(0.08 + 0.35 * fract((n + m) * 0.17)) * sand * inside
       * (0.8 + uLevel * 1.2 + uBeat * 0.6);
  // A faint sheen of the standing wave itself, so the plate reads as a surface.
  col += themeRamp(0.6) * (0.5 + 0.5 * w) * 0.035 * inside;

  col *= mix(0.7, 2.0, uGain);
  return themed(col, 0.1 + sand * 0.5);
}
