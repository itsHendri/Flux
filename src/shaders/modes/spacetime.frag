// SPACETIME — neon rays rushing past.
//
// Hyperspace in polar coordinates. The screen is cut into thin angular cells;
// some cells hold a ray, and each ray has a depth that runs from far to near
// and wraps. Perspective does the rest: a ray at depth z sits at radius R/z,
// so far rays bunch at the centre, near ones race to the edges and stretch —
// the streak's length is the distance it covers in one step of depth, which is
// exactly how motion blur would draw it.
//
// Depth advances by uTime (a drift) plus uDrive, the music's own clock, so the
// flight surges with the track and eases off in quiet passages without ever
// running backwards. Each ray's hue is its own, and its brightness is the band
// its hue stands for, so the colours that light up are the frequencies that
// are playing.
//
// Unlike the `tunnel` effect, which bends whatever mode is showing, this is a
// scene of its own.
//
// Steering: uSpaceSpeed, uSpaceDensity (how many rays), uSpaceLength (streak
// length), uSpaceTwist (the flight corkscrews).

float rayHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);
  float a = atan(p.y, p.x);
  // Corkscrew: angle turns with distance from the centre and with the flight.
  a += uSpaceTwist * (0.35 / (r + 0.25) + uDrive * 0.05);

  float travel = uTime * 0.12 + uDrive * 0.45;
  vec3 col = vec3(0.0);

  for (int L = 0; L < 3; L++) {
    float fl = float(L);
    float cells = 70.0 + fl * 55.0;
    float ca = a / TAU * cells;
    float id = floor(ca);
    vec2 key = vec2(id, fl);
    float h = rayHash(key);
    if (h > mix(0.25, 0.95, uSpaceDensity)) continue;

    float hue = rayHash(key + 3.7);
    float rate = (0.6 + 0.8 * rayHash(key + 9.1)) * uSpaceSpeed;
    // Depth 1 = far, 0 = at the camera; wraps back to the far end.
    float z = 1.0 - fract(h * 7.0 + travel * rate);
    float zTail = min(z + (0.04 + 0.1 * uSpaceLength) * (0.4 + rate), 1.2);
    float rHead = 0.12 / max(z, 0.02);
    float rTail = 0.12 / zTail;

    // Across the ray: arc distance from the cell's centre line.
    float across = (fract(ca) - 0.5) / cells * TAU * r;
    float width = (0.0012 + 0.0025 * (1.0 - z)) * (1.0 + uBeat * 0.8);
    float line = exp(-across * across / (width * width));
    // Along it: inside the span, brightest at the head.
    float along = smoothstep(rTail, rTail + 0.02, r) * smoothstep(rHead + 0.004, rHead - 0.004, r);
    float head = mix(0.35, 1.0, smoothstep(rTail, rHead, r));

    float energy = spectrumLog(hue);
    float lum = line * along * head * (0.15 + energy * 1.6) * (1.0 - z * 0.6);
    col += mix(themeRamp(hue), vec3(1.0), line * 0.25) * lum;
  }

  // The destination: a soft glare at the centre that flares on the kick.
  col += themeRamp(0.5) * exp(-r * r * 60.0) * (0.25 + uLevel * 0.6 + uBeat * 1.2);
  return col * mix(0.6, 1.8, uGain);
}
