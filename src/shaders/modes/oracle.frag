// ORACLE — a dark chamber drawn in light at its edges.
//
// A room of pillars around an altar, and above the altar a turning octahedron —
// the oracle. Nothing is lit the usual way. Faces stay near-black; what shows
// is the *edges*, found from the distance field itself: on a flat face an SDF
// is linear, so its Laplacian (six taps around the hit, minus six times the
// centre) is exactly zero, and it's only non-zero where two faces meet. That
// makes a line drawing of the room for six extra evaluations per pixel, with
// line width set by the tap spacing — scaled with distance so lines stay a
// constant width on screen.
//
// The spectrum runs around the room: an edge's brightness is the band at its
// angle around the altar, so the chamber lights up in a ring as the music
// moves through the frequencies. The oracle's own edges burn with the kick,
// and its glow is the only light that falls on the faces.
//
// Steering: uOracleEdge = line weight, uOracleGlow = brightness,
// uOracleSpin = how fast the oracle turns, uOracleRoom = how many pillars.

mat2 rotO(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float boxO(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float octaO(vec3 p, float s) {
  p = abs(p);
  return (p.x + p.y + p.z - s) * 0.57735027;
}

vec3 oraclePos() {
  return vec3(0.0, 0.55 + sin(uTime * 0.9) * 0.08, 0.0);
}

// Distance to the room; `part` = 0 room, 1 pillars, 2 altar, 3 oracle.
float chamberDE(vec3 p, out float part) {
  // The room: the inside of a box, floor to ceiling.
  float room = -boxO(p - vec3(0.0, 0.5, 0.0), vec3(4.2, 2.0, 7.0));
  part = 0.0;
  float d = room;

  // Pillars along both walls, repeated down the length.
  float spacing = mix(3.2, 1.6, uOracleRoom);
  vec3 q = p;
  q.x = abs(q.x) - 3.0;
  q.z = q.z - spacing * clamp(floor(q.z / spacing + 0.5), -3.0, 3.0);
  float pillar = boxO(q - vec3(0.0, 0.5, 0.0), vec3(0.28, 2.0, 0.28));
  // A capital on each: a wider slab near the ceiling, for more edges.
  pillar = min(pillar, boxO(q - vec3(0.0, 2.2, 0.0), vec3(0.42, 0.08, 0.42)));
  if (pillar < d) { d = pillar; part = 1.0; }

  // The altar: two stacked slabs.
  float altar = min(boxO(p - vec3(0.0, -1.3, 0.0), vec3(0.9, 0.2, 0.9)),
                    boxO(p - vec3(0.0, -0.9, 0.0), vec3(0.55, 0.2, 0.55)));
  if (altar < d) { d = altar; part = 2.0; }

  // The oracle.
  vec3 o = p - oraclePos();
  o.xz = rotO(uTime * (0.2 + uOracleSpin)) * o.xz;
  o.xy = rotO(uTime * 0.37 * uOracleSpin) * o.xy;
  float oracle = octaO(o, 0.42 + uBass * 0.12 + uBeat * 0.08);
  if (oracle < d) { d = oracle; part = 3.0; }
  return d;
}

float chamberD(vec3 p) {
  float part;
  return chamberDE(p, part);
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);

  // Walk slowly around the altar at eye height, looking at the oracle.
  float orbit = uTime * 0.07;
  vec3 ro = vec3(sin(orbit) * 3.3, 0.35 + sin(uTime * 0.05) * 0.3, cos(orbit) * 4.6);
  vec3 target = oraclePos() * 0.6;
  vec3 fwd = normalize(target - ro);
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), fwd));
  vec3 up = cross(fwd, right);
  vec3 rd = normalize(fwd * 1.2 + right * p.x + up * p.y);

  float t = 0.0;
  float part = 0.0;
  bool hit = false;
  for (int i = 0; i < 96; i++) {
    vec3 pos = ro + rd * t;
    float d = chamberDE(pos, part);
    if (d < 0.0008 * t + 0.0005) { hit = true; break; }
    t += d;
    if (t > 30.0) break;
  }
  if (!hit) return vec3(0.0);

  vec3 pos = ro + rd * t;
  // The Laplacian of the SDF: zero on faces, non-zero on creases. Tap spacing
  // grows with distance, so the lines keep a steady width on screen.
  float e = (0.0035 + 0.0025 * uOracleEdge) * max(t, 0.5);
  float c = chamberD(pos);
  float lap = chamberD(pos + vec3(e, 0.0, 0.0)) + chamberD(pos - vec3(e, 0.0, 0.0))
            + chamberD(pos + vec3(0.0, e, 0.0)) + chamberD(pos - vec3(0.0, e, 0.0))
            + chamberD(pos + vec3(0.0, 0.0, e)) + chamberD(pos - vec3(0.0, 0.0, e))
            - 6.0 * c;
  float edge = clamp(abs(lap) / e * 1.6, 0.0, 1.0);

  // The spectrum around the room: an edge's band is its angle about the altar.
  float around = fract(atan(pos.z, pos.x) / TAU + 0.5);
  float band = spectrumLog(around);
  vec3 tint = themeRamp(around * 0.8 + 0.1);
  float lum = 0.12 + band * 1.6;
  if (part > 2.5) {
    // The oracle: its own edges burn, hot on the kick.
    tint = mix(themeRamp(0.05), vec3(1.0), 0.4);
    lum = 1.4 + uBeat * 2.5 + uLevel;
  }
  vec3 col = tint * edge * lum;

  // The only light on the faces is the oracle's, by inverse square.
  vec3 toO = oraclePos() - pos;
  float glow = (0.35 + uLevel * 0.6 + uBeat * 0.8) / (1.0 + dot(toO, toO) * 1.8);
  col += themeRamp(0.05) * glow * 0.06 * (1.0 - edge);

  // Distance fog into black.
  col *= exp(-t * 0.08);
  return col * uOracleGlow * mix(0.6, 1.6, uGain);
}
