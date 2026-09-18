// FLUID divergence — how much fluid is flowing out of each cell.
//
// A real fluid is incompressible: this should be zero everywhere. It isn't
// after advection, and the pressure solve that follows exists purely to fix
// it. Free-slip walls: a velocity sampled past an edge is mirrored, so flow
// slides along the boundary instead of pouring through it.
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVelocity;
uniform vec2 uTexel;

void main() {
  float l = texture(uVelocity, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uVelocity, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uVelocity, vUv - vec2(0.0, uTexel.y)).y;
  float t = texture(uVelocity, vUv + vec2(0.0, uTexel.y)).y;
  vec2 c = texture(uVelocity, vUv).xy;
  if (vUv.x - uTexel.x < 0.0) l = -c.x;
  if (vUv.x + uTexel.x > 1.0) r = -c.x;
  if (vUv.y - uTexel.y < 0.0) b = -c.y;
  if (vUv.y + uTexel.y > 1.0) t = -c.y;
  outColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}
