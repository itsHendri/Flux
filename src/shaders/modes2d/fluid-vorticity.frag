// FLUID vorticity confinement — put back the swirl the grid ate.
//
// Advecting on a grid smears small eddies away within a few steps, and a fluid
// without eddies looks like syrup. This finds where spin is concentrated (the
// gradient of |curl|) and pushes energy back toward it, restoring the curls
// the solver lost. (Fedkiw/Stam/Jensen 2001; standard in every GPU fluid since
// GPU Gems.)
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexel;
uniform float uDtSim;
uniform float uVorticityAmount;

void main() {
  float l = texture(uCurl, vUv - vec2(uTexel.x, 0.0)).x;
  float r = texture(uCurl, vUv + vec2(uTexel.x, 0.0)).x;
  float b = texture(uCurl, vUv - vec2(0.0, uTexel.y)).x;
  float t = texture(uCurl, vUv + vec2(0.0, uTexel.y)).x;
  float c = texture(uCurl, vUv).x;

  // Direction of increasing spin, normalised so the push is a direction and
  // the strength comes from the curl itself.
  vec2 grad = 0.5 * vec2(abs(t) - abs(b), abs(r) - abs(l));
  grad /= max(length(grad), 1e-4);
  vec2 force = vec2(grad.y, -grad.x) * c * uVorticityAmount;

  vec2 vel = texture(uVelocity, vUv).xy + force * uDtSim;
  outColor = vec4(clamp(vel, -1000.0, 1000.0), 0.0, 1.0);
}
