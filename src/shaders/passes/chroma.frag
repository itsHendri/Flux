// CHROMATIC ABERRATION — splits the R and B channels along the radial direction
// from screen centre, leaving G fixed, for a lens-fringe / glitch look. The
// split grows toward the edges and is scaled by uChromaAmount and the audio
// level, so it pulses with the sound. Toggleable.
vec3 render(vec2 uv) {
  vec2 dir = uv - 0.5;                       // radial direction from centre
  float amt = uChromaAmount * (0.4 + uLevel); // audio-reactive magnitude
  vec2 off = dir * amt * 0.06;

  float r = texture(uSource, uv + off).r;
  float g = texture(uSource, uv).g;
  float b = texture(uSource, uv - off).b;
  return vec3(r, g, b);
}
