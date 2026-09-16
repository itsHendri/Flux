// WAVEFORM — the oldest read in the genre, and the one FLUX couldn't do until
// the audio texture landed: the actual time-domain signal, drawn as a glowing
// line. iTunes inherited it from SoundJam, SoundJam from Winamp, and every one
// of them mirrored it into symmetry.
//
// The trace holds still because the sampling window starts at a rising zero
// crossing (see audio/audioTexture.ts) — the same trigger a hardware
// oscilloscope uses. Without it the line slides sideways every frame.
//
// Steering: uWaveStyle = line / mirror / radial, uWaveAmp = height,
// uWaveGlow = halo, uWaveLayers = echo count (the ribbon), uGain = brightness.

// Distance from `uv` to the curve y = f(x), where f is the waveform scaled by
// `amp` and offset in phase by `shift`. Dividing the vertical distance by the
// slope is what keeps the line an even thickness: without it a steep section
// of the trace looks several times fatter than a flat one.
float traceDist(vec2 uv, float amp, float shift, float squash) {
  float e = 1.0 / 512.0; // one texel of the waveform row
  float y = wave(fract(uv.x + shift)) * amp;
  float dy = (wave(fract(uv.x + shift + e)) - wave(fract(uv.x + shift - e))) * amp;
  float slope = dy / (2.0 * e);
  float d = abs((uv.y - 0.5) * squash - y);
  return d / sqrt(1.0 + slope * slope);
}

// Same idea in polar: the trace rides a circle, angle standing in for time.
// The angle is *folded* (0 at the right, 1 at the left, mirrored top to
// bottom) rather than wrapped: wrapping puts the start and end of the window
// next to each other, and since they're unrelated samples the ring gets a
// visible seam. Folding puts them on opposite sides, and the symmetry is what
// this family of visualizers has always done anyway.
float ringDist(vec2 p, float amp, float shift) {
  float a = abs(atan(p.y, p.x)) / PI;
  float r = mix(0.22, 0.42, uScale) + wave(clamp(a + shift, 0.0, 1.0)) * amp * 0.45;
  return abs(length(p) - r);
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);
  float style = floor(uWaveStyle + 0.5);
  float amp = mix(0.05, 0.42, uWaveAmp) * (0.6 + uLevel * 0.8);
  float gain = mix(0.7, 1.8, uGain);

  // A dim bass-driven wash so the frame isn't dead between transients.
  vec3 col = themed(vec3(0.05, 0.06, 0.09), 0.1) * (0.35 + uBass * 0.9)
           * (1.0 - 0.55 * length(p));

  // Layers are the same trace at growing phase offsets: the older the echo,
  // the dimmer and the further along the theme ramp, so the line drags a
  // coloured ribbon behind it instead of sitting flat.
  float layers = floor(uWaveLayers + 0.5);
  for (float i = 0.0; i < 6.0; i += 1.0) {
    if (i >= layers) break;
    float k = i / max(layers, 1.0);
    float shift = i * 0.012 * (1.0 + uHigh);
    float fade = (1.0 - k * 0.72);

    float d;
    if (style < 0.5) {
      d = traceDist(uv, amp, shift, 1.0);
    } else if (style < 1.5) {
      // Mirror: fold the frame about the centre line and draw once, so the
      // trace and its reflection are one shape rather than two.
      d = traceDist(vec2(uv.x, 0.5 + abs(uv.y - 0.5)), amp, shift, 1.0);
    } else {
      d = ringDist(p, amp, shift);
    }

    float core = smoothstep(0.006, 0.0, d);
    float halo = smoothstep(mix(0.02, 0.16, uWaveGlow), 0.0, d);
    vec3 tint = themeRamp(0.15 + k * 0.5 + uTime * 0.02);
    col += tint * (core * 1.25 + halo * 0.5 * (0.4 + uWaveGlow)) * fade * gain;
  }

  // A kick flashes the whole trace — the one place the beat detector shows up
  // in a mode that is otherwise reading the raw signal.
  col *= 1.0 + uBeat * 0.5;
  return col;
}
