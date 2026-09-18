// FLUID advect — carry a field along the velocity field.
//
// Semi-Lagrangian, the move that makes Stam's solver "stable": instead of
// pushing each cell's contents forward (which blows up when anything moves
// more than one cell per step), look *backwards* down the velocity to find
// where this cell's contents came from, and sample there. It can never
// produce a value outside the range already present, so it cannot diverge.
// (Stam, "Stable Fluids", 1999.)
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexel;
uniform float uDtSim;
uniform float uDissipation;

void main() {
  vec2 vel = texture(uVelocity, vUv).xy;
  vec2 from = vUv - vel * uDtSim * uTexel;
  // Dissipation as a decay per unit time, not per frame, so the look doesn't
  // change with the frame rate.
  outColor = texture(uSource, from) / (1.0 + uDissipation * uDtSim);
}
