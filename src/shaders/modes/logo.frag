// LOGO — the uploaded image (Logo section in the panel), audio-displaced.
// The image rides a bass-driven radial ripple, pops in scale on uBeat (the
// spectral-flux kick pulse), shimmers per-channel on highs, and floats over a
// slow hue-drifting glow field. Until an image is uploaded (uLogoAspect == 0)
// a pulsing placeholder ring shows where it will appear.
//
// Steering: uScale = logo size, uLogoRipple = ripple depth, uGain = brightness.

vec3 render(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);

  // Slow ambient glow field behind everything; level lifts it.
  vec3 bg = themed(hsv(0.6 + uTime * 0.015, 0.55, 0.05 + uLevel * 0.08), 0.15) * (1.2 - r * 0.5);

  // Placeholder before any upload: a soft breathing ring.
  if (uLogoAspect <= 0.0) {
    float ring = abs(r - (0.45 + 0.04 * sin(uTime * 2.0) + uBass * 0.08));
    vec3 col = bg + themed(hsv(uTime * 0.05, 0.4, 1.0), 0.5) * smoothstep(0.05, 0.0, ring) * 0.35;
    return col * mix(0.7, 1.6, uGain);
  }

  // Bass-driven radial ripple displaces the sampling position.
  float depth = uLogoRipple * (0.004 + uBass * 0.018);
  vec2 dir = p / max(r, 1e-3);
  vec2 dp = p + dir * sin(r * 24.0 - uTime * 5.0) * depth;

  // Aspect-fit box, half-height `size`; beat pops the scale.
  float size = mix(0.35, 1.1, uScale) * (1.0 + uBeat * 0.1);
  vec2 luv = dp / (size * vec2(uLogoAspect, 1.0));
  luv = luv * 0.5 + 0.5;
  float inBox =
    step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0);

  // High-band chromatic shimmer: split R/B samples slightly.
  vec2 split = vec2(0.004 * uHigh, 0.0);
  vec4 tex = texture(uLogo, luv);
  float cr = texture(uLogo, luv + split).r;
  float cb = texture(uLogo, luv - split).b;
  vec3 logoCol = vec3(cr, tex.g, cb);
  float alpha = tex.a * inBox;

  vec3 col = mix(bg, logoCol * (0.85 + uLevel * 0.5 + uBeat * 0.45), alpha);
  return col * mix(0.7, 1.6, uGain);
}
