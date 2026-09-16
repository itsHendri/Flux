// BARS — a spectrum analyser that actually reads the spectrum.
//
// Each column takes its height from the FFT (uAudio row 0) over its own slice
// of a log frequency axis, so an octave gets the same width wherever it sits —
// bass doesn't crush into two columns and the top end isn't a dead zone. The
// per-bin envelope follower lives in the AudioEngine, so bars snap up on a hit
// and settle smoothly without any wobble faked in here.
//
// Steering: uBarCount = columns, uBarGlow = halo, uGain = brightness.

// Height for the bar covering [t0, t1] of the log frequency axis. Averaging a
// few samples across the slice reads the band rather than one arbitrary bin,
// which is what stops tall thin columns flickering as a note drifts.
float barHeight(float t0, float t1) {
  float v = 0.0;
  for (int i = 0; i < 4; i++) {
    v += spectrumLog(mix(t0, t1, (float(i) + 0.5) / 4.0));
  }
  return v * 0.25;
}

vec3 render(vec2 uv) {
  vec3 col = vec3(0.02, 0.024, 0.03);
  float gain = mix(0.8, 3.0, uGain);

  float N = floor(uBarCount); // bar count (live-steerable)
  float fb = uv.x * N;
  float idx = floor(fb);
  float local = fract(fb);
  float t = (idx + 0.5) / N;

  // Gap between bars.
  float bar = smoothstep(0.06, 0.18, local) * smoothstep(0.94, 0.82, local);

  float h = clamp(barHeight(idx / N, (idx + 1.0) / N) * gain, 0.0, 1.3);
  vec3 tint = hsv(mix(0.02, 0.55, t) + uHigh * 0.04, 0.78, 1.0);

  // Bar body, growing from the bottom with a vertical gradient.
  float body = smoothstep(h, h - 0.02, uv.y) * bar;
  float grad = mix(0.30, 1.15, clamp(uv.y / max(h, 0.001), 0.0, 1.0));
  col = mix(col, tint * grad, body);

  // Bright cap riding the top of each bar.
  col += vec3(1.0) * smoothstep(0.016, 0.0, abs(uv.y - h)) * bar * 0.95;

  // Soft glow halo around the cap (live-steerable amount).
  col += tint * smoothstep(0.12, 0.0, abs(uv.y - h)) * bar * uBarGlow;

  // Dim mirrored reflection in the bottom strip.
  float refl = smoothstep(h * 0.45, 0.0, uv.y) * bar * (1.0 - body);
  col += tint * refl * 0.12;

  // Vignette.
  col *= 1.0 - 0.32 * length(uv - 0.5);
  return themed(col, t);
}
