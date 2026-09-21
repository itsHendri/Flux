// WISP mote — a soft dot, lit by the wanderer. Close motes go white-hot, the
// rest take the theme's colour and fall away to almost nothing.
in float vLight;
in float vNear;
in float vHue;
out vec4 outColor;

void main() {
  float m = smoothstep(0.5, 0.05, length(gl_PointCoord - 0.5));
  vec3 col = mix(themeRamp(0.2 + vHue * 0.5), vec3(1.0), clamp(vNear * 1.2, 0.0, 1.0));
  // A faint floor so the world is there in the dark, then the light.
  float lum = 0.012 + vLight * 0.22;
  outColor = vec4(col * lum * m * mix(0.6, 1.6, uGain), 1.0);
}
