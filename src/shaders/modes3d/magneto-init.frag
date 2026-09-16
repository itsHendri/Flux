// MAGNETO seed — scatter the swarm on a shell and hand every particle two
// things it keeps for life: a charge, and a frequency to listen to.
out vec4 outState;

uniform vec2 uStateSize;
uniform float uIsVelocity;

void main() {
  vec2 tc = gl_FragCoord.xy;
  float id = (tc.y * uStateSize.x + tc.x);
  float total = uStateSize.x * uStateSize.y;

  if (uIsVelocity > 0.5) {
    // Velocity starts near zero; w carries the particle's charge, half the
    // swarm positive and half negative — the opposing forces are the whole
    // idea (Hodgin: "some elements have an attractive force, others repulsive").
    float charge = hash(tc + 11.3) < 0.5 ? -1.0 : 1.0;
    outState = vec4(vec3(0.0), charge);
  } else {
    // A rough shell, so the swarm starts as a body rather than a cloud.
    float a = hash(tc + 1.7) * TAU;
    float z = hash(tc + 5.1) * 2.0 - 1.0;
    float r = sqrt(max(0.0, 1.0 - z * z));
    vec3 p = vec3(r * cos(a), r * sin(a), z) * (0.7 + 0.35 * hash(tc + 8.9));
    // w is this particle's place in the spectrum: 0 = bass, 1 = air. Fixed for
    // life, so a particle always answers to its own band.
    outState = vec4(p, id / max(total - 1.0, 1.0));
  }
}
