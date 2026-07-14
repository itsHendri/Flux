// TRAILS3D sim pass — advects every particle one step through the curl-noise
// flow (position ping-pong; xyz = position, w = age). Audio steering:
//   uBass    → flow speed deepens with the low end,
//   uBeat    → a radial impulse bursts the swarm outward on the kick,
//   uFlowSpeed / uTrailTurb / uScale (controls) → speed, noise scale, host size.

// Mode-private uniforms (fetched by Trails3DMode, not the standard map).
uniform sampler2D uPositions; // previous positions
uniform float uDt3d; // frame delta seconds

out vec4 outPos;

const float LIFE = 6.0;

void main() {
  ivec2 tc = ivec2(gl_FragCoord.xy);
  vec4 p = texelFetch(uPositions, tc, 0);
  vec3 pos = p.xyz;
  float age = p.w + uDt3d;

  float host = mix(0.55, 1.15, uScale);
  float turb = mix(0.9, 2.6, uTrailTurb);

  // Curl flow over a slowly drifting domain; bass deepens the advection.
  vec3 v = curl(pos * (turb / host) + vec3(0.0, uTime * 0.06, 0.0));
  v *= mix(0.35, 1.6, uFlowSpeed) * (0.55 + uBass * 1.3);

  // Soft spring toward the host sphere keeps the swarm a recognisable form.
  vec3 dir = normalize(pos + 1e-5);
  v += dir * (host - length(pos)) * 1.4;

  // Kick impulse: uBeat is a decaying pulse, squared for a sharp attack.
  v += dir * uBeat * uBeat * 1.6;

  pos += v * 0.22 * uDt3d * 60.0 * 0.016; // stable across frame rates

  if (age > LIFE) {
    pos = spherePoint(vec2(tc) + fract(uTime) * 61.7) * host;
    age = 0.0;
  }
  outPos = vec4(pos, age);
}
