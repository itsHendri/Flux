// BLOOM stage 3 of 3 — full-res composite. uScene is the pass input (the
// untouched chain texture); uSource is the finished pyramid top (half-res —
// LINEAR sampling performs the final upsample). The pyramid accumulates one
// tent contribution per level, so the 0.3 scale renormalises the sum into the
// existing 0–3 uBloomIntensity control range.

vec3 render(vec2 uv) {
  vec3 base = texture(uScene, uv).rgb;
  vec3 glow = texture(uSource, uv).rgb;
  return base + glow * uBloomIntensity * 0.3;
}
