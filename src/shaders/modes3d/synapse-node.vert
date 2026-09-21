#version 300 es
// SYNAPSE nodes — one glowing sprite per slot, instanced. Sized in world
// units so near stars are bigger, with a floor so far ones never vanish.
precision highp float;

uniform highp sampler2D uNodes;
uniform mat4 uProj;
uniform mat4 uView;
uniform vec2 uResolution;
uniform float uSynGlow;

out vec2 vQuad;       // -1..1 across the sprite
out vec4 vInfo;       // born, band, fired, presence
out float vSize;

void main() {
  int i = gl_InstanceID;
  vec4 n0 = texelFetch(uNodes, ivec2(i, 0), 0);
  vec4 n1 = texelFetch(uNodes, ivec2(i, 1), 0);
  vInfo = vec4(n0.w, n1.x, n1.z, n1.w);
  vSize = n1.y;
  vec4 clip = uProj * uView * vec4(n0.xyz, 1.0);
  if (n1.w <= 0.0 || clip.w < 0.05) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    return;
  }
  vec2 corner = vec2((gl_VertexID & 2) == 0 ? -1.0 : 1.0, (gl_VertexID & 1) == 0 ? -1.0 : 1.0);
  vQuad = corner;
  // Halo radius in pixels: world size through the projection, floored.
  float px = max(6.0, uSynGlow * n1.y * 0.12 * uProj[1][1] * uResolution.y * 0.5 / clip.w);
  gl_Position = clip + vec4(corner * px / uResolution * 2.0 * clip.w, 0.0, 0.0);
}
