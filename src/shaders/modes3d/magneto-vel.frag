// MAGNETO velocity step — the physics. Every particle is pushed and pulled by
// a handful of moving poles; whether a pole attracts or repels it depends on
// the product of the two charges, so the same pole grabs half the swarm and
// throws the other half away. That opposition is what makes the shapes:
// nothing here choreographs a form.
//
// The audio enters per particle, not globally: each one reads its own slice of
// the spectrum (w, assigned at seed) and is moved in proportion to what that
// band is doing right now, which is Magnetosphere's actual trick —
// "assign each particle a specific frequency to pay attention to. This audio
// data can then influence the particles' charge and strength of the forces".
out vec4 outVel;

uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform vec4 uPoles[4]; // xyz = position, w = charge
uniform float uStep;

void main() {
  ivec2 tc = ivec2(gl_FragCoord.xy);
  vec4 pos = texelFetch(uPosTex, tc, 0);
  vec4 vel = texelFetch(uVelTex, tc, 0);
  vec3 p = pos.xyz;
  float band = pos.w;
  float charge = vel.w;

  // This particle's own band, with a floor so a silent band still drifts.
  float energy = 0.25 + spectrumLog(band) * 2.2;

  vec3 force = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    vec3 d = uPoles[i].xyz - p;
    // Heavily softened. A true 1/r^2 goes to infinity at the pole, and one
    // close pass is then enough to fling a particle clear of the scene for
    // good — which looks like the swarm slowly boiling away into noise.
    float r2 = dot(d, d) + 0.35;
    vec3 dir = d * inversesqrt(r2);
    force += dir * (charge * uPoles[i].w) / r2;
  }
  force *= mix(0.2, 1.4, uMagCharge) * energy;

  // The containing spring. This is what makes the swarm a body that the poles
  // deform, rather than four independent clouds: it has to be able to win
  // against a pole at range, so it's stiff and grows with distance.
  float host = mix(0.6, 1.4, uScale);
  float d = length(p);
  vec3 outward = p * inversesqrt(dot(p, p) + 1e-6);
  force -= outward * (d - host) * 6.0;

  // A kick throws everything outward — the supernova beat of the original,
  // sized to be felt without breaking containment.
  force += outward * uBeat * 1.6 * energy;

  vec3 v = vel.xyz + force * uStep;
  // Damping is the difference between a swarm and an explosion.
  v *= mix(0.88, 0.985, uMagDamp);
  // Nothing moves faster than the spring can answer for.
  float speed = length(v);
  if (speed > 3.0) v *= 3.0 / speed;

  outVel = vec4(v, charge);
}
