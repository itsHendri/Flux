// MAGNETO position step — integrate, and respawn anything that escapes.
out vec4 outPos;

uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform float uStep;

void main() {
  ivec2 tc = ivec2(gl_FragCoord.xy);
  vec4 pos = texelFetch(uPosTex, tc, 0);
  vec3 v = texelFetch(uVelTex, tc, 0).xyz;
  vec3 p = pos.xyz + v * uStep;

  // Anything thrown clear of the scene comes back on the shell rather than
  // being lost: the swarm should not thin out over a long set.
  if (length(p) > 4.0) {
    float a = hash(vec2(tc) + uTime) * TAU;
    float z = hash(vec2(tc) + uTime + 3.3) * 2.0 - 1.0;
    float r = sqrt(max(0.0, 1.0 - z * z));
    p = vec3(r * cos(a), r * sin(a), z) * 0.9;
  }
  outPos = vec4(p, pos.w); // band assignment is kept for life
}
