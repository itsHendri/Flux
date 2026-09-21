// FORGE velocity — a spring home, a shatter, and the music on the surface.
//
// Every particle is pulled toward its home on the current shape by an
// underdamped spring (so it overshoots and settles, which reads as material
// rather than as a tween). A shatter is one frame of outward impulse; the
// spring's strength then ramps back up from zero, so there's a moment of
// free-flying debris before the next shape pulls it together.
out vec4 outVel;

uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform float uStep;
uniform float uShape;     // index into shapeHome
uniform float uPull;      // 0..1, the rebuild ramp
uniform float uShatter;   // impulse this frame, 0 otherwise
uniform float uSpin;      // shape rotation angle

mat3 spinY(float a) {
  float c = cos(a), s = sin(a);
  return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c);
}

void main() {
  ivec2 tc = ivec2(gl_FragCoord.xy);
  vec4 pos = texelFetch(uPosTex, tc, 0);
  vec3 v = texelFetch(uVelTex, tc, 0).xyz;
  vec3 p = pos.xyz;
  float u = pos.w;
  float r = hash(vec2(tc) + 31.7);

  // The particle's own band, as in magneto: it shimmers with its frequency.
  float energy = spectrumLog(u);
  float index = float(tc.y) * float(textureSize(uPosTex, 0).x) + float(tc.x);
  vec3 home = spinY(uSpin) * shapeHome(int(uShape), u, r, index);
  home *= 1.0 + uBass * 0.12 * uForgeReact + energy * 0.1 * uForgeReact;

  float k = 22.0;
  vec3 acc = (home - p) * k * uPull;
  // Damping stronger while assembled, looser as debris.
  acc -= v * mix(2.2, 6.5, uPull);
  // Debris drifts in a slow swirl rather than stopping dead.
  acc += cross(p, vec3(0.0, 1.0, 0.0)) * (1.0 - uPull) * 0.6;

  v += acc * uStep;

  if (uShatter > 0.0) {
    vec3 dir = normalize(p + (vec3(hash(vec2(tc) + 2.0), hash(vec2(tc) + 5.0), hash(vec2(tc) + 7.0)) - 0.5) * 0.9);
    v += dir * uShatter * (1.4 + 2.6 * hash(vec2(tc) + 13.0));
  }
  outVel = vec4(v, 0.0);
}
