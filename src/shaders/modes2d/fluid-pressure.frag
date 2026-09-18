// FLUID pressure — one Jacobi iteration of the Poisson solve.
//
// Solving ∇²p = divergence for the pressure that cancels the outflow. Jacobi
// is the simplest way to do it on a GPU: each cell averages its four
// neighbours and subtracts the divergence, and running that many times
// converges. Each pass is a full-screen draw, which is why the iteration count
// is the expensive control in this mode.
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexel;

void main() {
  float l = texture(uPressure, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uPressure, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uPressure, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uPressure, vUv + vec2(0.0, uTexel.y)).x;
  float div = texture(uDivergence, vUv).x;
  outColor = vec4((l + r + b + t - div) * 0.25, 0.0, 0.0, 1.0);
}
