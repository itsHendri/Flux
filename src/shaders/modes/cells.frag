// CELLS — an audio-reactive Voronoi cellular field with glowing borders. Each
// cell's feature point orbits over time (and faster on bass), cells are tinted
// from a cosine palette by their id, and the distance-to-border lights up the
// edges — the organic, shifting "cellular" look that's everywhere in modern
// audio-reactive motion work.
//
// Two-pass Voronoi (nearest cell, then distance to the border between it and its
// neighbours) adapted from Inigo Quilez's Voronoi-edges article
// (https://iquilezles.org/articles/voronoilines/).
//
// Steering: uScale = cell density, uWarp = point orbit radius, uGain =
// brightness. Bass speeds the motion, mid drives edge glow, high adds core
// sparkle, level lifts brightness.

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

vec3 palette(float t) {
  return 0.5 + 0.5 * cos(TAU * (t + vec3(0.0, 0.33, 0.67)));
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv) * mix(2.5, 8.0, uScale);
  float t = uTime * (0.4 + uBass * 1.2);
  float orbit = mix(0.35, 0.5, uWarp);

  vec2 ip = floor(p);
  vec2 fp = fract(p);

  // Pass 1 — find the nearest cell.
  vec2 nearestRel = vec2(0.0); // vector from pixel to nearest point
  vec2 nearestCell = vec2(0.0); // which cell won
  float nearestId = 0.0;
  float md = 8.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 o = hash2(ip + g);
      vec2 pt = g + 0.5 + orbit * sin(t + TAU * o); // orbiting feature point
      vec2 r = pt - fp;
      float d = dot(r, r);
      if (d < md) {
        md = d;
        nearestRel = r;
        nearestCell = g;
        nearestId = hash2(ip + g).x;
      }
    }
  }

  // Pass 2 — distance to the border between the nearest cell and its neighbours.
  float border = 8.0;
  for (int j = -2; j <= 2; j++) {
    for (int i = -2; i <= 2; i++) {
      vec2 g = nearestCell + vec2(float(i), float(j));
      vec2 o = hash2(ip + g);
      vec2 pt = g + 0.5 + orbit * sin(t + TAU * o);
      vec2 r = pt - fp;
      if (dot(nearestRel - r, nearestRel - r) > 0.0001) {
        border = min(border, dot(0.5 * (nearestRel + r), normalize(r - nearestRel)));
      }
    }
  }

  // Cell fill — palette by id, darkened toward the centre for depth.
  vec3 cellCol = palette(nearestId + uMid * 0.25 + uTime * 0.02);
  float cellDist = sqrt(md);
  vec3 col = cellCol * (0.25 + 0.75 * cellDist);

  // Glowing borders — mid-driven.
  float edge = smoothstep(0.07, 0.0, border);
  col += vec3(0.8, 0.95, 1.0) * edge * (0.35 + uMid * 0.9);

  // Cell-core sparkle on high.
  float core = smoothstep(0.18, 0.0, cellDist);
  col += palette(nearestId + 0.4) * core * uHigh * 1.5;

  col *= (0.7 + uLevel * 0.9);
  col *= mix(0.7, 1.6, uGain);
  return col;
}
