#version 300 es
// MAGNETO vertex stage — fetch this particle's position and band by
// gl_VertexID, project through the orbiting camera, and size it by how loud
// its own band is, so the parts of the swarm listening to what's playing are
// the parts that stand out.
precision highp float;

uniform sampler2D uPositions;
uniform sampler2D uVelocities;
uniform sampler2D uAudio;
uniform mat4 uProj;
uniform mat4 uView;
uniform int uTexSize;
uniform float uBeat;

out float vBand;
out float vCharge;
out float vSpeed;

void main() {
  ivec2 tc = ivec2(gl_VertexID % uTexSize, gl_VertexID / uTexSize);
  vec4 p = texelFetch(uPositions, tc, 0);
  vec4 v = texelFetch(uVelocities, tc, 0);
  vBand = p.w;
  vCharge = v.w;
  vSpeed = length(v.xyz);

  // The band's own energy, read straight from the spectrum row.
  float energy = texture(uAudio, vec2(pow(2.0, mix(-9.5, -0.5, p.w)), 0.25)).r;

  vec4 vp = uView * vec4(p.xyz, 1.0);
  gl_Position = uProj * vp;
  gl_PointSize = clamp((3.0 + energy * 7.0 + uBeat * 2.5) / max(0.1, -vp.z), 0.75, 6.0);
}
