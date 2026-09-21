// CROSSFADE — the dissolve between two modes (not a toggleable pass; the
// Renderer runs it during a mode transition, before the effect chain, so the
// effects see one picture). uSource = the incoming mode, uScene = the
// outgoing one, uFade = 0..1 progress.
//
// Not a plain mix: halfway through a linear mix both pictures are at half
// strength, and two dark-background modes dip visibly dark in the middle. The
// max of the two weighted pictures keeps each one's light up through the
// middle of the fade, which reads as one dissolving into the other rather
// than both dimming.

uniform float uFade;

vec3 render(vec2 uv) {
  vec3 a = texture(uScene, uv).rgb;
  vec3 b = texture(uSource, uv).rgb;
  float t = smoothstep(0.0, 1.0, uFade);
  vec3 lin = mix(a, b, t);
  vec3 held = max(a * (1.0 - t) * 1.4, b * t * 1.4);
  return max(lin, min(held, max(a, b)));
}
