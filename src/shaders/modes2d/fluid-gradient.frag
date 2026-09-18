// FLUID gradient subtract — the projection step.
//
// Subtracting the pressure gradient from the velocity is what actually makes
// the field incompressible; everything before this was working out what to
// subtract. After it the fluid conserves volume, which is why the ink swirls
// and folds instead of piling up.
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexel;

void main() {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  vec2 vel = texture(uVelocity, vUv).xy - vec2(r - l, t - b) * 0.5;
  outColor = vec4(vel, 0.0, 1.0);
}
