// VIDEO ECHO — MilkDrop's second graphics layer. A copy of the frame, zoomed
// about the centre and optionally flipped, laid back over the original. Geiss
// documents it as echo_zoom (the layer's size), echo_alpha (0 off, 0.5
// half-mix, 1 opaque) and echo_orient (four fixed orientations)
// (https://www.geisswerks.com/milkdrop/milkdrop_preset_authoring.html).
//
// A flipped echo turns any mode symmetric in a way the kaleidoscope doesn't —
// two overlapping scales of the same image rather than wedges — and zoom above
// 1 gives the "picture inside itself" depth. To keep it from sitting still,
// the echo turns slowly and bass pushes its zoom, so the two layers drift
// against each other in time with the music.
//
// Steering: uEchoZoom, uEchoMix, uEchoFlip (0 none / 1 horizontal /
// 2 vertical / 3 both).

vec3 render(vec2 uv) {
  vec3 base = texture(uSource, uv).rgb;

  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  float flip = floor(uEchoFlip + 0.5);
  if (flip == 1.0 || flip == 3.0) p.x = -p.x;
  if (flip == 2.0 || flip == 3.0) p.y = -p.y;

  float zoom = uEchoZoom * (1.0 + uBass * 0.12);
  float a = sin(uTime * 0.11) * 0.25 + uMid * 0.1;
  float c = cos(a);
  float s = sin(a);
  p = mat2(c, -s, s, c) * p / max(zoom, 0.05);

  vec2 q = p / vec2(aspect, 1.0) + 0.5;
  // Outside the frame the echo is simply absent, rather than a smeared edge.
  vec2 e = step(vec2(0.0), q) * step(q, vec2(1.0));
  vec3 echo = texture(uSource, q).rgb * e.x * e.y;

  // Screen-style: the echo adds light where the base is dark and saturates
  // gently where both are bright, so it layers rather than washing over.
  vec3 layered = base + echo * (1.0 - clamp(base, 0.0, 1.0));
  return mix(base, layered, clamp(uEchoMix, 0.0, 1.0));
}
