// KALEIDOSCOPE — radial mirror symmetry. Converts the pixel to polar coords
// around centre, folds the angle into uKaleidoSegments wedges with a mirror
// inside each wedge, then samples the source at the folded position. Produces
// the classic kaleidoscope rosette; segment count is live-controllable, and
// with the beat tracker locked it turns a step on every bar.
vec3 render(vec2 uv) {
  float aspect = uResolution.x / uResolution.y;
  vec2 p = uv - 0.5;
  p.x *= aspect;

  float r = length(p);
  float a = atan(p.y, p.x);

  // Fold the angle into N equal wedges, mirroring within each for seamless edges.
  float segs = max(1.0, floor(uKaleidoSegments + 0.5));
  float seg = TAU / segs;
  // Locked to the beat, the rosette turns half a wedge on each bar, easing
  // into the downbeat. uDownbeats only counts while locked, so without a lock
  // it simply holds where it was.
  a += (uDownbeats + uLock * smoothstep(0.75, 1.0, uBarPhase)) * seg * 0.5;
  a = mod(a, seg);
  a = abs(a - seg * 0.5);

  // Back to UV space (clamped by the source's CLAMP_TO_EDGE sampler).
  vec2 q = vec2(cos(a), sin(a)) * r;
  q.x /= aspect;
  return texture(uSource, q + 0.5).rgb;
}
