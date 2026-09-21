// FORGE backdrop — the studio itself, dimmed, seen through the same camera
// as the beads, so what they reflect is the room they're standing in.
in vec2 vUv;
out vec4 outColor;

uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanHalfFov;

void main() {
  vec2 p = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0) * uTanHalfFov;
  vec3 rd = normalize(uCamFwd + uCamRight * p.x + uCamUp * p.y);
  vec3 col = studio(rd) * 0.22;
  // Vignette keeps the eye on the swarm.
  col *= 1.0 - 0.55 * dot(vUv - 0.5, vUv - 0.5) * 2.0;
  outColor = vec4(col, 1.0);
}
