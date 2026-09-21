#version 300 es
// FORGE sprites — each particle is a small sphere of chrome, drawn as a point
// sprite sized to its true projected radius so the depth test and the
// perspective agree.
precision highp float;

uniform sampler2D uPositions;
uniform mat4 uProj;
uniform mat4 uView;
uniform int uTexSize;
uniform vec2 uResolution;
uniform float uForgeSize;

out vec3 vViewPos;
out float vBand;


void main() {
  ivec2 tc = ivec2(gl_VertexID % uTexSize, gl_VertexID / uTexSize);
  vec4 p = texelFetch(uPositions, tc, 0);
  vBand = p.w;
  vec4 vp = uView * vec4(p.xyz, 1.0);
  vViewPos = vp.xyz;
  // Fewer particles get bigger beads, so the shape stays a surface.
  float vRadius = uForgeSize * 0.026 * sqrt(16384.0 / float(uTexSize * uTexSize));
  gl_Position = uProj * vp;
  gl_PointSize = clamp(2.0 * vRadius * uProj[1][1] * uResolution.y * 0.5 / max(0.05, -vp.z), 1.0, 40.0);
}
