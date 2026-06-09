// BARS — a lively multi-bar spectrum. The three bands are spread across many
// columns with smooth weighting, and each bar carries its own animated noise
// so neighbours dance independently rather than moving as three blocks.

const float N = 28.0;

// Height for a bar at normalised position t (0 = left/bass, 1 = right/high).
float barHeight(float t) {
  float wb = exp(-pow((t - 0.12) / 0.20, 2.0));
  float wm = exp(-pow((t - 0.50) / 0.24, 2.0));
  float wh = exp(-pow((t - 0.86) / 0.22, 2.0));
  float v = (wb * uBass + wm * uMid + wh * uHigh) / (wb + wm + wh);
  // Per-bar animated wobble keeps the spectrum alive.
  v *= 0.5 + 0.75 * noise(vec2(t * 11.0, uTime * 1.3));
  return v;
}

vec3 render(vec2 uv) {
  vec3 col = vec3(0.02, 0.024, 0.03);
  float gain = mix(0.6, 2.4, uGain);

  float fb = uv.x * N;
  float idx = floor(fb);
  float local = fract(fb);
  float t = (idx + 0.5) / N;

  // Gap between bars.
  float bar = smoothstep(0.06, 0.18, local) * smoothstep(0.94, 0.82, local);

  float h = clamp(barHeight(t) * gain, 0.0, 1.3);
  vec3 tint = hsv(mix(0.02, 0.55, t) + uHigh * 0.04, 0.78, 1.0);

  // Bar body, growing from the bottom with a vertical gradient.
  float body = smoothstep(h, h - 0.02, uv.y) * bar;
  float grad = mix(0.30, 1.15, clamp(uv.y / max(h, 0.001), 0.0, 1.0));
  col = mix(col, tint * grad, body);

  // Bright cap riding the top of each bar.
  col += vec3(1.0) * smoothstep(0.016, 0.0, abs(uv.y - h)) * bar * 0.95;

  // Soft glow halo around the cap.
  col += tint * smoothstep(0.12, 0.0, abs(uv.y - h)) * bar * 0.45;

  // Dim mirrored reflection in the bottom strip.
  float refl = smoothstep(h * 0.45, 0.0, uv.y) * bar * (1.0 - body);
  col += tint * refl * 0.12;

  // Vignette.
  col *= 1.0 - 0.32 * length(uv - 0.5);
  return col;
}
