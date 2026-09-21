#version 300 es
// ANEMONE — one quad per ring, instanced: arm = instance / rings, ring =
// instance % rings. Each arm leaves the centre along its own direction and
// curls on slow noise; each ring sits on the arm, in the plane across it, so
// seen along the arm it's a circle and side-on a thin ellipse — which is what
// makes a chain of flat rings read as a 3D tentacle.
precision highp float;

uniform mat4 uProj;
uniform mat4 uView;
uniform int uRings;
uniform int uArms;
uniform float uTime;
uniform float uBass;
uniform float uBeat;
uniform sampler2D uAudio; // precision must match the fragment preamble (default)
uniform float uAnemoneReach;
uniform float uAnemoneSway;
uniform float uAnemoneRing;

out vec2 vLocal;     // position in the ring's plane, in ring radii
out float vBand;     // where along the arm (= which band), 0..1
out float vEnergy;   // that band's energy
out float vThick;    // line half-width, in ring radii

// Arm directions: a Fibonacci spread over the sphere, so any count is even.
vec3 armDir(int i, int n) {
  float fi = float(i) + 0.5;
  float z = 1.0 - 2.0 * fi / float(n);
  float r = sqrt(max(0.0, 1.0 - z * z));
  float a = fi * 2.39996323;
  return vec3(r * cos(a), z, r * sin(a));
}

// The arm's centreline at s (0 = centre, 1 = tip). Bends grow toward the tip
// (s²), so the root holds still and the tip swims.
vec3 centre(int arm, float s) {
  vec3 d = armDir(arm, uArms);
  vec3 side = normalize(cross(d, abs(d.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 up = cross(d, side);
  float fa = float(arm) * 1.7;
  float sway = (0.25 + uBass * 0.9) * uAnemoneSway;
  float bend = s * s;
  vec3 p = d * s * 1.6 * uAnemoneReach;
  p += side * sin(s * 3.1 + uTime * 0.9 + fa) * bend * sway;
  p += up * cos(s * 2.3 + uTime * 0.7 + fa * 1.3) * bend * sway;
  return p;
}

void main() {
  int arm = gl_InstanceID / uRings;
  int ring = gl_InstanceID - arm * uRings;
  float s = (float(ring) + 0.5) / float(uRings);
  vBand = s;
  // Ring n answers to band n: the spectrum runs from the root out to the tip.
  vEnergy = texture(uAudio, vec2(pow(2.0, mix(-9.5, -0.5, s)), 0.25)).r;

  vec3 c = centre(arm, s);
  vec3 t = normalize(centre(arm, s + 0.01) - c);
  vec3 n = normalize(cross(t, abs(t.y) < 0.9 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
  vec3 b = cross(t, n);

  // A kick sends a swell out along every arm: as uBeat decays 1 → 0 the swell
  // travels root → tip.
  float wave = exp(-pow((s - (1.0 - uBeat)) * 7.0, 2.0)) * uBeat;
  float radius = (0.05 + 0.13 * vEnergy + 0.08 * wave) * (1.0 - 0.55 * s) * uAnemoneReach;
  vThick = clamp(0.06 * uAnemoneRing / max(radius * 8.0, 0.2), 0.02, 0.4);

  vec2 corner = vec2((gl_VertexID & 2) == 0 ? -1.0 : 1.0, (gl_VertexID & 1) == 0 ? -1.0 : 1.0);
  float pad = 1.0 + vThick * 3.0;
  vLocal = corner * pad;
  vec3 world = c + (n * corner.x + b * corner.y) * radius * pad;
  gl_Position = uProj * uView * vec4(world, 1.0);
}
