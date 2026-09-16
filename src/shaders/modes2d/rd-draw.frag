// REACTION draw — colour the chemical field.
//
// B's concentration picks the colour along the theme ramp; its *gradient*
// lights the edges, which is what gives the growth its raised, coral-like
// read instead of looking like a flat stain.
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uState;
uniform vec2 uSimSize;

float bAt(vec2 uv) {
  return texture(uState, uv).g;
}

void main() {
  vec2 texel = 1.0 / uSimSize;
  float b = bAt(vUv);

  // Central-difference gradient → a cheap surface normal for the lighting.
  float gx = bAt(vUv + vec2(texel.x, 0.0)) - bAt(vUv - vec2(texel.x, 0.0));
  float gy = bAt(vUv + vec2(0.0, texel.y)) - bAt(vUv - vec2(0.0, texel.y));
  vec3 n = normalize(vec3(-gx * 40.0, -gy * 40.0, 1.0));
  float lit = clamp(dot(n, normalize(vec3(0.5, 0.6, 0.62))), 0.0, 1.0);
  float edge = clamp(length(vec2(gx, gy)) * 26.0, 0.0, 1.0);

  float v = smoothstep(0.05, 0.32, b);

  // Colour needs a second axis, or every cell of the pattern lands on the
  // same stop — concentration alone mostly reads "in" or "out". A slow,
  // large-scale noise field drifts regions of the frame along the theme ramp,
  // so the same structure is one colour here and another over there, and the
  // chemical A (depleted inside the growth) adds banding within each line.
  float a = texture(uState, vUv).r;
  vec2 aspectUv = vUv * vec2(uSimSize.x / uSimSize.y, 1.0);
  float region = noise(aspectUv * 1.6 + vec2(uTime * 0.04, -uTime * 0.03));
  float t = region * 0.75 + v * 0.3 + (1.0 - a) * 0.35 + uBass * 0.08;

  vec3 col = themeRamp(t) * (0.16 + v * 0.95);
  col *= 0.45 + lit * 0.85;
  col += themeRamp(t + 0.33) * edge * (0.35 + uMid * 0.8); // rims take the next stop
  col += vec3(0.02, 0.025, 0.035) * (1.0 - v);              // substrate

  col *= mix(0.7, 1.9, uGain) * (0.75 + uLevel * 0.6 + uBeat * 0.25);
  outColor = vec4(col, 1.0);
}
