// ANEMONE ring — a glowing annulus. Light adds (no depth), so where rings
// crowd near the root the body glows, and out along the arms each ring stands
// alone.
in vec2 vLocal;
in float vBand;
in float vEnergy;
in float vThick;
out vec4 outColor;

void main() {
  float d = abs(length(vLocal) - 1.0) / vThick;
  float line = exp(-d * d * 0.5);
  float halo = exp(-d * d * 0.04) * 0.12;
  vec3 col = themeRamp(0.1 + vBand * 0.75);
  float lum = (line + halo) * (0.25 + vEnergy * 1.4 + uBeat * 0.3) * (1.0 - vBand * 0.35);
  vec3 c = mix(col, vec3(1.0), line * vEnergy * 0.35) * lum;
  outColor = vec4(c * mix(0.5, 1.5, uGain), 1.0);
}
