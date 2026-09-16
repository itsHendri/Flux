// WARP FEEDBACK — MilkDrop's signature move, and the reason its presets look
// like nothing else: each frame samples the *previous* frame through a
// displaced coordinate field, so the image is continually pulled through
// itself. Zoom alone gives tunnels; rotation gives spirals; the sine warp
// gives the liquid churn.
//
// The vocabulary is Geiss's, from the MilkDrop preset authoring guide
// (https://www.geisswerks.com/milkdrop/milkdrop_preset_authoring.html):
// zoom (1 = still, <1 out, >1 in), rot, warp (0 none / 1 normal / 2 major),
// and decay. MilkDrop evaluated these on a coarse vertex mesh and interpolated
// between; a fragment shader can do it per pixel, which is strictly better and
// costs nothing extra. Geiss's decay default (0.98) does not carry over: he
// draws sparse geometry into the feedback buffer, while FLUX feeds it a
// full-screen mode, so ours sits lower (see controls.ts).
//
// Steering: uWarpZoom, uWarpRot, uWarpAmount, uWarpDecay, uWarpAudio (how much
// bass pushes the zoom and uBeat kicks the warp).

vec3 render(vec2 uv) {
  vec3 cur = texture(uSource, uv).rgb;

  // Every step below compounds frame over frame, so it's scaled to a 60fps
  // frame: the motion looks the same on a 144 Hz display as on a 60 Hz one.
  float f = clamp(uDt * 60.0, 0.0, 3.0);

  // Audio: bass leans on the zoom, a kick snaps the warp.
  float drive = uWarpAudio;
  float zoom = 1.0 + (uWarpZoom - 1.0 + uBass * 0.06 * drive) * f;
  float rot = uWarpRot * (1.0 + uMid * 0.8 * drive) * 0.06 * f;
  float amount = uWarpAmount * (1.0 + uBeat * 1.2 * drive);

  // Centred, aspect-corrected so a zoom is round rather than oval.
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);

  // Zoom about the centre, then rotate about it.
  p /= max(zoom, 0.01);
  float c = cos(rot);
  float s = sin(rot);
  p = mat2(c, -s, s, c) * p;

  // The warp itself: a few out-of-phase sines whose periods don't divide each
  // other, so the field never settles into a repeating pattern.
  float t = uTime * 0.31;
  vec2 w = vec2(
    sin(p.y * 4.3 + t * 1.7) + 0.6 * sin(p.y * 9.1 - t * 1.1),
    cos(p.x * 3.7 - t * 1.3) + 0.6 * cos(p.x * 8.3 + t * 0.9)
  );
  p += w * amount * 0.006 * f;

  vec2 src = p / vec2(aspect, 1.0) + 0.5;

  // Sampling outside the frame would drag the edge pixel inward and smear the
  // border; fading to black there keeps the feedback clean.
  vec2 edge = smoothstep(vec2(0.0), vec2(0.02), src)
            * smoothstep(vec2(1.0), vec2(0.98), src);
  float inside = edge.x * edge.y;

  // decay is per 60fps frame, like MilkDrop's.
  float decay = pow(clamp(uWarpDecay, 0.0, 0.999), f);
  vec3 prev = texture(uPrevFrame, src).rgb * decay * inside;

  // Brightest-of, not additive. Adding the new frame on top of an undimmed
  // copy of the old one converges on cur/(1-decay) — about 66x at decay 0.97 —
  // which is fine in MilkDrop, where the source is sparse geometry drawn into
  // the buffer, and a white-out here, where the source is a full-screen mode.
  // max() is bounded by the brightest thing on screen, so Warp Decay can go to
  // 0.999 for long tunnels without the image burning out.
  return max(cur, prev);
}
