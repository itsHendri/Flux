#version 300 es
// SYNAPSE edges — one screen-space quad per edge, instanced, no buffers.
// Both endpoints are projected, and the quad is built around the segment in
// pixels (padded by the line's glow), so a line is the same width wherever it
// sits in depth and the fragment shader can work in pixel units.
precision highp float;

uniform highp sampler2D uNodes;  // maxNodes × 2, see packNodes
uniform highp sampler2D uEdges;  // maxEdges × 2, see packEdges
uniform mat4 uProj;
uniform mat4 uView;
uniform vec2 uResolution;
uniform float uSynGlow;

out vec2 vLocal;       // x along the edge from A (px), y across (px)
out float vLen;        // edge length (px)
out float vWidth;      // core half-width (px)
out vec4 vEdge;        // born, fired, fromA, presence
out float vBand;

vec2 toPx(vec4 clip) {
  return (clip.xy / clip.w * 0.5 + 0.5) * uResolution;
}

void main() {
  int i = gl_InstanceID;
  vec4 e0 = texelFetch(uEdges, ivec2(i, 0), 0);
  vec4 e1 = texelFetch(uEdges, ivec2(i, 1), 0);
  vec4 a = texelFetch(uNodes, ivec2(int(e0.x), 0), 0);
  vec4 b = texelFetch(uNodes, ivec2(int(e0.y), 0), 0);
  vBand = 0.5 * (texelFetch(uNodes, ivec2(int(e0.x), 1), 0).x + texelFetch(uNodes, ivec2(int(e0.y), 1), 0).x);
  vEdge = vec4(e0.z, e0.w, e1.x, e1.y);

  vec4 ca = uProj * uView * vec4(a.xyz, 1.0);
  vec4 cb = uProj * uView * vec4(b.xyz, 1.0);
  // No edge here, or an endpoint behind the camera: collapse to nothing.
  if (e1.y <= 0.0 || ca.w < 0.05 || cb.w < 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }

  vec2 pa = toPx(ca);
  vec2 pb = toPx(cb);
  vec2 d = pb - pa;
  vLen = max(length(d), 1e-3);
  vec2 dir = d / vLen;
  vec2 nrm = vec2(-dir.y, dir.x);
  vWidth = max(0.7, uSynGlow * uResolution.y * 0.0012);
  float pad = vWidth * 7.0;

  float along = (gl_VertexID & 2) == 0 ? -pad : vLen + pad;
  float across = (gl_VertexID & 1) == 0 ? -pad : pad;
  vLocal = vec2(along, across);
  vec2 px = pa + dir * along + nrm * across;
  gl_Position = vec4(px / uResolution * 2.0 - 1.0, 0.0, 1.0);
}
