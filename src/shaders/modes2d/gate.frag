// GATE — falling through a corridor of gates.
//
// Domain repetition along the flight path: space is cut into slabs GATE
// apart, and each slab holds one frame — square, round or hexagonal, picked
// and turned by the slab's own index — so the corridor never repeats in a way
// the eye catches. The path curves (the corridor bends on slow sines), the
// camera rides it, and the gates are lit the neon way: every march step adds
// glow by how close the ray passed to a frame, so edges shine without any
// lights in the scene. (The glow-accumulation trick is the one lattice.frag
// uses; repetition per iq, iquilezles.org/articles/sdfrepetition.)
//
// The distance flown, uTravel, is integrated on the CPU (GateMode.ts) because
// speed follows the bass and a shader can't integrate. uLitGate is the index
// of the gate a kick lit, uLitAge how long ago.
in vec2 vUv;
out vec4 outColor;

uniform float uTravel;
uniform float uLitGate;
uniform float uLitAge;

mat2 rotG(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

// The corridor's centreline, offset in x/y as it goes.
vec2 path(float z) {
  return vec2(sin(z * 0.11) * 1.6 + sin(z * 0.047) * 1.1, cos(z * 0.083) * 0.9);
}

float gateHash(float i) {
  return fract(sin(i * 127.1) * 43758.5453);
}

// Distance to the gate in slab `idx`, local coordinates q (x/y across, z along).
float gateDE(vec3 q, float idx) {
  float h = gateHash(idx);
  q.xy = rotG(idx * uGateTwist * 0.6 + h * 6.283) * q.xy;
  float size = 1.35 + 0.25 * gateHash(idx + 3.1);
  float thick = 0.045;
  float d2;
  if (h < 0.4) {
    vec2 a = abs(q.xy);
    d2 = abs(max(a.x, a.y) - size) - thick;               // square
  } else if (h < 0.7) {
    d2 = abs(length(q.xy) - size) - thick;                // ring
  } else {
    vec2 a = abs(q.xy);
    float hex = max(a.x * 0.866025 + a.y * 0.5, a.y);
    d2 = abs(hex - size) - thick;                         // hexagon
  }
  return max(d2, abs(q.z) - 0.05);
}

// Distance to the nearest gate: this slab's and the next one's, since a ray
// near a slab boundary can be closer to its neighbour.
float sceneDE(vec3 p, out float idx) {
  float z = p.z;
  float cell = floor(z / uGateSpacing + 0.5);
  float best = 1e9;
  idx = cell;
  for (int k = -1; k <= 1; k++) {
    float c = cell + float(k);
    float zc = c * uGateSpacing;
    vec3 q = vec3(p.xy - path(zc), z - zc);
    float d = gateDE(q, c);
    if (d < best) {
      best = d;
      idx = c;
    }
  }
  return best;
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);
  float z0 = uTravel;
  vec3 ro = vec3(path(z0), z0);
  vec3 ahead = vec3(path(z0 + 3.0), z0 + 3.0);
  vec3 fwd = normalize(ahead - ro);
  // Bank into the bends a little, the way a fall through a curve would.
  vec2 bend = path(z0 + 1.5) - path(z0);
  vec3 upHint = normalize(vec3(-bend.x * 0.35, 1.0, 0.0));
  vec3 right = normalize(cross(upHint, fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(fwd * 1.25 + right * p.x + up * p.y);

  vec3 glow = vec3(0.0);
  float t = 0.05;
  for (int i = 0; i < 90; i++) {
    vec3 pos = ro + rd * t;
    float idx;
    float d = sceneDE(pos, idx);
    // Each gate glows in its own colour, a step along the theme.
    vec3 c = themeRamp(idx * 0.13);
    float lit = idx == uLitGate ? exp(-uLitAge * 2.2) * 5.0 : 0.0;
    float fade = exp(-t * 0.09);
    glow += c * (0.0035 + lit * 0.004) / (0.0006 + d * d) * fade * (0.6 + uLevel * 0.6);
    t += max(d * 0.8, 0.02);
    if (t > 40.0) break;
  }
  vec3 col = glow * 0.012 * uGateGlow;
  // A faint haze toward the vanishing point: depth, even between gates.
  col += themeRamp(z0 * 0.01 + 0.5) * 0.015 * exp(-dot(p, p) * 1.5);
  return col * mix(0.6, 1.6, uGain);
}

void main() {
  outColor = vec4(render(vUv), 1.0);
}
