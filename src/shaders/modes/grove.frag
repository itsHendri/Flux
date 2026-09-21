// GROVE — a fractal forest the music re-grows.
//
// Each tree is a 2D KIFS: draw the trunk, move to its top, fold x (so one
// branch becomes both), rotate, shrink, repeat. Nine iterations draw 2^9
// branch tips for the price of nine segment tests per pixel — the folding does
// the multiplying. (The fold-and-rotate tree is a Shadertoy staple; the
// distance-estimate form follows iq's notes on 2D SDFs,
// iquilezles.org/articles/distfunctions2d.)
//
// Level n's branch angle answers to band n of the spectrum, so the canopy's
// shape *is* the music: bass opens the low limbs, hats splay the twigs. Wind
// comes from the bass too. Three layers at different distances give the
// forest depth, the far ones fogged into the sky.
//
// Steering: uGroveSpread = base branch angle, uGroveReact = how far the music
// bends it, uGroveWind = sway, uGroveDensity = trees per layer, uGain.

mat2 rotV(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

float segDist(vec2 p, float len) {
  p.y -= clamp(p.y, 0.0, len);
  return length(p);
}

float treeHash(vec2 p) {
  return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453);
}

// Distance to one tree rooted at the origin, growing up +y. `tipGlow` collects
// how close the point is to the outermost twigs, for the blossom light.
float treeDE(vec2 p, float seed, out float tipGlow) {
  float d = 1e9;
  float s = 1.0;
  float len = 0.34;
  tipGlow = 0.0;
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    float w = 0.022 * (1.0 - fi / 11.0);
    d = min(d, (segDist(p, len) - w) * s);

    // Wind: every level leans a little, more toward the tips, with the bass.
    float gust = sin(uTime * 0.8 + seed * 6.0 + fi * 0.5) * (0.02 + uBass * 0.12) * uGroveWind;
    p.y -= len;
    p = rotV(gust * (0.4 + fi * 0.15)) * p;

    // Branch angle: the base spread, opened by this level's band.
    float band = spectrumLog((fi + 0.5) / 9.0);
    float ang = mix(0.25, 0.8, uGroveSpread) + band * 0.55 * uGroveReact + (seed - 0.5) * 0.15;
    // Fold, then turn the folded half back upright. The sign matters: rotV
    // turns clockwise, and turning the other way would leave the new branch in
    // the half-plane the fold just emptied — trunks with no branches.
    p.x = abs(p.x);
    p = rotV(-ang) * p;

    float r = 0.74 + 0.04 * sin(seed * 11.0 + fi);
    p /= r;
    s *= r;
  }
  // Blossoms: a soft light where the last twigs end, swelling with the highs.
  float tip = length(p - vec2(0.0, len * 0.5)) * s;
  tipGlow = exp(-tip * tip * 4000.0) * 0.6 + exp(-tip * 90.0) * 0.2;
  return d;
}

// One layer of forest: trees on a row, each its own size and lean.
// Returns coverage (0..1) and adds blossom light into `glow`.
float forestLayer(vec2 p, float layer, float px, inout float glow) {
  float cell = mix(0.95, 0.55, uGroveDensity);
  float id0 = floor(p.x / cell + 0.5);
  float d = 1e9;
  float g = 0.0;
  for (int k = -1; k <= 1; k++) {
    float id = id0 + float(k);
    float h = treeHash(vec2(id, layer));
    if (h < 0.18) continue; // gaps between trees
    float size = 0.75 + 0.55 * treeHash(vec2(id + 7.1, layer));
    vec2 q = vec2(p.x - id * cell - (h - 0.5) * cell * 0.5, p.y);
    float tg;
    float td = treeDE(q / size, h, tg) * size;
    d = min(d, td);
    g += tg;
  }
  glow += g;
  return smoothstep(px, -px, d);
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);
  float px = 1.5 / uResolution.y;

  // Sky: dusk from the theme, a low moon that swells with the bass.
  vec3 sky = mix(themeRamp(0.55) * 0.05, themeRamp(0.35) * 0.18, smoothstep(-0.6, 1.0, p.y));
  vec2 moon = p - vec2(0.55, 0.35);
  sky += themeRamp(0.1) * (exp(-dot(moon, moon) * 30.0) * 0.9 + exp(-dot(moon, moon) * 3.0) * 0.12) * (0.7 + uBass * 0.6);
  vec3 col = sky;

  // Far to near. Each layer is further scaled (smaller trees), rooted a little
  // higher, drifts slower, and is fogged toward the sky.
  float drift = uTime * 0.04;
  for (int L = 2; L >= 0; L--) {
    float fl = float(L);
    float k = 1.0 + fl * 0.85;
    float ground = -0.95 + fl * 0.14;
    vec2 q = vec2((p.x + drift / (1.0 + fl)) * k + fl * 3.7, (p.y - ground) * k);
    float glow = 0.0;
    float cover = forestLayer(q, fl, px * k, glow);
    vec3 body = mix(vec3(0.004, 0.005, 0.008), sky * 0.9, fl * 0.33);
    vec3 bloom = themeRamp(0.15 + fl * 0.2) * glow * (0.35 + uHigh * 1.4 + uBeat * 0.5) / k;
    col = mix(col, body, cover) + bloom;
    // Ground below each layer's roots.
    col = mix(col, body, smoothstep(px * k, -px * k, q.y));
  }
  return col * mix(0.6, 1.8, uGain);
}
