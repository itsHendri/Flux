// FEEDBACK / TRAILS — blends the current scene with the previous frame's output
// (uPrevFrame, kept in the renderer's history FBO), decayed by uTrailDecay. A
// max-blend keeps the brightest of {now, faded-past}, so motion smears into
// glowing decaying trails that accumulate frame over frame. Higher decay = the
// trails persist longer. Toggleable.
vec3 render(vec2 uv) {
  vec3 cur = texture(uSource, uv).rgb;
  vec3 prev = texture(uPrevFrame, uv).rgb;

  // Decay 0..1 → fade factor; bias toward long trails at the top of the range.
  float decay = clamp(uTrailDecay, 0.0, 0.99);
  return max(cur, prev * decay);
}
