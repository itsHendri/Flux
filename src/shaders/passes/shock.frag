// SHOCK — a shockwave ring on every kick. The ring front displaces pixels
// radially, bending the image as it passes, with the colour channels split
// across the front the way refraction splits light — the chromatic fringe the
// old `chroma` pass drew everywhere, now only where something is happening.
//
// It needs no state. uBeat is 1 at a kick and decays exponentially, so
// (1 - uBeat) climbs fast and then eases out: used as the radius, that is
// already the shape of a blast wave slowing as it spreads, and uBeat itself is
// the ring's fading strength. Onsets (any transient, not just the kick) throw
// a smaller, fainter second ring the same way.
// (Technique after the Geeks3D 2D shockwave filter — see REFERENCES.md.)
//
// Steering: uShockStrength = displacement, uShockWidth = ring thickness.

// Radial displacement of a ring at `radius`, `width` wide, `strength` deep.
float ring(float r, float radius, float width, float strength) {
  float x = (r - radius) / max(width, 1e-3);
  // A single smooth hump: the front pushes out, the back pulls in.
  return -x * exp(-x * x * 2.0) * strength;
}

vec3 render(vec2 uv) {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float r = length(p);
  vec2 dir = p / max(r, 1e-4);

  float width = mix(0.03, 0.14, uShockWidth);
  float amount = uShockStrength * 0.24;
  float d = ring(r, (1.0 - uBeat) * 1.15, width, uBeat * amount)
          + ring(r, (1.0 - uOnset) * 0.7, width * 0.6, uOnset * amount * 0.45);

  vec2 off = dir * d / vec2(aspect, 1.0);
  // Red bends a little further than green, blue a little less.
  float cr = texture(uSource, uv + off * 1.6).r;
  float cg = texture(uSource, uv + off).g;
  float cb = texture(uSource, uv + off * 0.4).b;
  vec3 col = vec3(cr, cg, cb);

  // The ring front catches a little light, so the blast reads even over a dark
  // frame.
  col += abs(d) * 4.0 * uShockStrength;
  return col;
}
