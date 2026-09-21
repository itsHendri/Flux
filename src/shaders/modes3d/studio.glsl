// The studio forge's metal reflects — the same room chrome.frag builds (see
// the notes there): one softbox overhead, a side strip, a dark floor and
// horizon bands. Contrast in what a mirror reflects is what reads as metal.
// Prepended to forge's programs by ForgeMode.ts.
vec3 studio(vec3 dir) {
  float bar = smoothstep(0.35, 0.8, dir.y);
  float box = smoothstep(0.86, 0.995, dir.y) * 6.0;
  float strip = smoothstep(0.55, 0.85, dir.x) * smoothstep(-0.1, 0.35, dir.y) * 1.4;
  float bands = smoothstep(0.75, 1.0, sin(dir.y * 30.0 + uTime * 0.25));
  bands *= smoothstep(0.45, 0.0, abs(dir.y));

  vec3 col = vec3(0.012, 0.014, 0.02);
  col += vec3(0.85, 0.9, 1.0) * (bar * 0.35 + box);
  col += vec3(0.8, 0.85, 1.0) * strip;
  col += themeRamp(0.75) * bands * (0.5 + uMid * 0.9);
  col += themeRamp(0.15) * smoothstep(0.0, -0.8, dir.y) * 0.25;
  return col;
}
