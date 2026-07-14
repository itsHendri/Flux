#version 300 es
// TRAILS3D vertex stage — attribute-less: each point derives its home
// position on a sphere from gl_VertexID (task 4-2 seam demo; task 4-3
// replaces the static sphere with GPGPU curl-noise advected positions).
// Builtin/control uniforms (uTime, uBass, uBeat, uScale…) are program-wide,
// so declaring them here gets the Renderer's standard per-frame upload.
precision highp float;

uniform mat4 uProj;
uniform mat4 uView;
uniform float uTime;
uniform float uBass;
uniform float uBeat;
uniform float uScale;

out float vSeed;

float hash1(float n) {
  return fract(sin(n) * 43758.5453123);
}

vec3 spherePoint(float id) {
  float u = hash1(id * 12.9898) * 2.0 - 1.0;
  float a = hash1(id * 78.233) * 6.28318530718;
  float r = sqrt(max(0.0, 1.0 - u * u));
  return vec3(r * cos(a), u, r * sin(a));
}

void main() {
  float id = float(gl_VertexID);
  vec3 pos = spherePoint(id);

  // Gentle organic breathing: per-point phase, bass-deepened, beat pop.
  float wobble = sin(uTime * 0.9 + id * 0.37) * (0.03 + uBass * 0.12);
  pos *= mix(0.55, 1.15, uScale) * (1.0 + wobble) * (1.0 + uBeat * 0.08);

  vec4 vp = uView * vec4(pos, 1.0);
  gl_Position = uProj * vp;
  gl_PointSize = clamp(6.0 / max(0.1, -vp.z), 1.0, 5.0);
  vSeed = fract(id * 0.6180339887);
}
