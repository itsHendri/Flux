#version 300 es
// WISP dust — every mote placed from its own index, no simulation: a hashed
// spot in a wide slab of air, drifting on slow per-mote sines. Near the
// wanderer the air is pushed aside (a wake), and a mote's light is the
// wanderer's by inverse-square distance — so the dust is dark everywhere
// except where the light passes, which is the whole picture.
precision highp float;

uniform mat4 uProj;
uniform mat4 uView;
uniform vec3 uWanderer;
uniform vec2 uResolution;
uniform float uTime;
uniform float uBass;
uniform float uWispLight;
uniform float uWispWake;

out float vLight;
out float vNear;
out float vHue;

// Integer hash (PCG-style) on the mote's id. The usual fract(sin(x)·43758)
// loses its precision at arguments this large (ids up to 200k) on mobile
// GPUs, and the dust falls onto visible lattices.
float h1(uint n) {
  uint s = n * 747796405u + 2891336453u;
  uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u;
  return float((w >> 22u) ^ w) / 4294967295.0;
}

void main() {
  uint id = uint(gl_VertexID) * 4u;
  vec3 base = vec3(h1(id), h1(id + 1u), h1(id + 2u)) * 2.0 - 1.0;
  // A slab wider than tall: a world of air rather than a ball of it.
  vec3 p = base * vec3(4.5, 2.0, 4.5);
  float ph = h1(id + 3u) * 6.2831;
  p += vec3(sin(uTime * 0.13 + ph), sin(uTime * 0.11 + ph * 1.7) * 0.6, cos(uTime * 0.12 + ph)) * 0.35;

  vec3 away = p - uWanderer;
  float d2 = dot(away, away);
  // The wake: motes near the light are pushed out of its way, harder on bass.
  p += normalize(away + 1e-4) * exp(-d2 * 1.5) * 0.45 * uWispWake * (0.6 + uBass);
  away = p - uWanderer;
  d2 = dot(away, away);

  vLight = uWispLight / (0.12 + d2 * 0.7);
  vNear = exp(-d2 * 0.8);
  vHue = h1(id ^ 0x9e3779b9u);

  vec4 vp = uView * vec4(p, 1.0);
  gl_Position = uProj * vp;
  gl_PointSize = clamp((1.5 + vNear * 3.0) * uResolution.y / 900.0 * 4.0 / max(0.3, -vp.z), 1.5, 10.0);
}
