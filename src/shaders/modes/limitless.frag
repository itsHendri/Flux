// LIMITLESS — your image, containing itself forever, zooming with the music.
//
// The Droste effect. In log-polar space, log z = (log r, θ), scaling is a
// shift along x and rotation a shift along y — so a picture that contains a
// copy of itself scaled by S is simply a picture that repeats every
// P = log S along x. Tile the uploaded image into that strip and every
// annulus from 1/S to 1 holds a whole copy, nested without end.
//
// The spiral is Escher's (Print Gallery; Lenstra & de Smit's analysis in
// "The Mathematical Structure of Escher's Print Gallery"): multiply log z by
// β = 1 − i·n·P/2π before tiling, so going once round the screen also goes
// down n levels. That is what keeps the spiral seamless — any other twist
// tears where the tiles meet — which is why Arms is a choice, not a slider.
//
// Zoom runs on uDrive, the music's clock, so the fall inward surges with the
// track; the mids turn it. Until an image is uploaded, a generated frame with
// the spectrum inside it stands in.
//
// Steering: uLimitArms (spiral arms: rings, 1, 2, reversed), uLimitRatio
// (the nesting scale S), uLimitZoom (zoom speed), uScale (crop into the image).

vec2 cmul(vec2 a, vec2 b) {
  return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x);
}

// The picture that gets nested: the uploaded image, or a stand-in.
// q is in -1..1 across the picture's own square.
vec4 picture(vec2 q) {
  if (uLogoAspect > 0.0) {
    // Cover, not contain: the shorter side spans the unit circle, so every
    // level's annulus is all picture. Contained, a wide image leaves dark
    // crescents above and below each level where the ring runs past its edge.
    vec2 ext = vec2(uLogoAspect, 1.0) / min(uLogoAspect, 1.0);
    vec2 luv = q / ext * 0.5 + 0.5;
    float inBox = step(0.0, luv.x) * step(luv.x, 1.0) * step(0.0, luv.y) * step(luv.y, 1.0);
    vec4 t = texture(uLogo, luv);
    return vec4(t.rgb, t.a * inBox);
  }
  // Stand-in: a square frame, and inside it the spectrum as a ring of bars —
  // so even with no image the recursion is visibly the music.
  vec2 a = abs(q);
  float box = max(a.x, a.y);
  float frame = smoothstep(0.93, 0.95, box) * smoothstep(1.0, 0.98, box);
  float ang = fract(atan(q.y, q.x) / TAU + 0.5);
  float bar = spectrumLog(abs(ang * 2.0 - 1.0));
  float r = length(q);
  float ring = smoothstep(0.02, 0.0, abs(r - (0.55 + bar * 0.3)) - 0.01)
             * step(0.5, fract(ang * 48.0));
  vec3 col = themeRamp(0.1) * frame + themeRamp(0.3 + ang * 0.5) * ring * (0.6 + bar);
  return vec4(col, max(frame, ring));
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);
  float S = mix(2.0, 6.0, uLimitRatio);
  float P = log(S);

  // Log-polar, then Escher's twist so one turn = n levels down.
  vec2 w = vec2(log(max(length(p), 1e-5)), atan(p.y, p.x));
  vec2 beta = vec2(1.0, -uLimitArms * P / TAU);
  vec2 s = cmul(w, beta);

  // The fall inward, on the music's clock; the mids turn it.
  s.x -= (uTime * 0.04 + uDrive * 0.3) * uLimitZoom;
  s.y += uTime * 0.03 + uMid * 0.4;

  // Tile x into one period: every copy lives in the annulus [1/S, 1).
  float lr = mod(s.x, P) - P;
  // Scale only ever zooms *into* the picture (a factor ≤ 1), so each level
  // stays covered; zooming out would push the ring past the picture's edge.
  float crop = mix(1.0, 0.55, uScale);
  vec2 q = exp(lr) * vec2(cos(s.y), sin(s.y)) * crop;

  vec4 pic = picture(q);
  // Behind the picture: a glow that deepens toward the centre. Keyed on the
  // untiled radius — keying it on the tiled one would jump at every level.
  vec3 bg = themeRamp(0.55 - w.x * 0.08) * 0.05 * (1.0 + uLevel);
  vec3 col = mix(bg, pic.rgb * (0.85 + uLevel * 0.4 + uBeat * 0.4), clamp(pic.a, 0.0, 1.0));
  // Depth cue: the far copies (toward the centre) dim a little.
  col *= 0.6 + 0.4 * smoothstep(-6.0, 0.5, w.x);
  return col * mix(0.7, 1.6, uGain);
}
