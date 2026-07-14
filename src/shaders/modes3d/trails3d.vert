#version 300 es
// TRAILS3D vertex stage — each point fetches its simulated position (xyz +
// age) from the GPGPU texture by gl_VertexID, then projects through the
// orbiting camera. Builtin/control uniforms are program-wide, so declaring
// them here gets the Renderer's standard per-frame upload.
precision highp float;

uniform sampler2D uPositions;
uniform mat4 uProj;
uniform mat4 uView;
uniform int uTexSize;
uniform float uBeat;

out float vAge;

void main() {
  ivec2 tc = ivec2(gl_VertexID % uTexSize, gl_VertexID / uTexSize);
  vec4 p = texelFetch(uPositions, tc, 0);
  vAge = p.w;

  vec4 vp = uView * vec4(p.xyz, 1.0);
  gl_Position = uProj * vp;
  gl_PointSize = clamp((4.5 + uBeat * 2.0) / max(0.1, -vp.z), 0.75, 4.0);
}
