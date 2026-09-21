// FORGE position — integrate. Debris stops at a shell well inside the camera's
// orbit: a bead flying past the lens fills the screen with one grey disc.
out vec4 outPos;

uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform float uStep;

void main() {
  ivec2 tc = ivec2(gl_FragCoord.xy);
  vec4 pos = texelFetch(uPosTex, tc, 0);
  vec3 v = texelFetch(uVelTex, tc, 0).xyz;
  vec3 p = pos.xyz + v * uStep;
  if (length(p) > 2.6) p = normalize(p) * 2.6;
  outPos = vec4(p, pos.w);
}
