// TUNNEL — the polar remap. Each screen pixel is re-expressed as (angle,
// 1/radius) and the source image is sampled there: angle wraps around the
// walls, and 1/radius runs to infinity at the centre, so any mode becomes the
// lining of an endless tube with the vanishing point in the middle. Scrolling
// the depth coordinate flies you down it; offsetting the angle by depth twists
// it. The classic 2D tunnel of the demoscene and every visualizer since (see
// the Shadertoy tunnel references in REFERENCES.md).
//
// Steering: uTunnelSpeed = flight speed (kicks surge it), uTunnelTwist = spiral,
// uTunnelRepeat = how many times the image wraps around the walls.

// Mirror-repeat: the source texture clamps at its edges, and plain fract()
// would put a hard seam where the image's left edge meets its right.
vec2 mirrorRepeat(vec2 x) {
  return abs(fract(x * 0.5) * 2.0 - 1.0);
}

vec3 render(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float r = max(length(p), 1e-4);
  float angle = atan(p.y, p.x) / TAU + 0.5;

  float speed = uTunnelSpeed * (1.0 + uBeat * 1.5);
  float depth = 0.3 / r + uTime * speed * 0.9;
  float around = angle * floor(uTunnelRepeat + 0.5) + depth * uTunnelTwist * 0.25;

  vec3 col = texture(uSource, mirrorRepeat(vec2(around, depth))).rgb;

  // Fog toward the vanishing point, so depth reads as depth instead of a
  // singularity of stretched pixels in the middle of the screen.
  col *= smoothstep(0.0, 0.35, r);
  return col;
}
