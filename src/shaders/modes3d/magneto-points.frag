// MAGNETO point fragment — additive dots. Hodgin moved the original to
// additive blending in OpenGL partly to avoid depth sorting entirely, which is
// exactly why this needs no depth buffer either: light adds up in any order.
//
// Colour says what the particle is: its band walks the theme ramp (bass at one
// stop, air at another), and its charge picks a side, so the two halves of the
// swarm stay legible as they fight.
in float vBand;
in float vCharge;
in float vSpeed;
out vec4 outColor;

void main() {
  float m = smoothstep(0.5, 0.08, length(gl_PointCoord - 0.5));
  vec3 col = themeRamp(0.05 + vBand * 0.6);
  // Negative charge leans a third of the way further along the ramp.
  col = mix(col, themeRamp(0.38 + vBand * 0.6), step(vCharge, 0.0) * 0.5);
  // Fast particles flare — the eye reads speed as heat.
  float lum = 0.35 + uLevel * 0.5 + uBeat * 0.35 + clamp(vSpeed * 0.25, 0.0, 0.6);
  outColor = vec4(col * m * lum * mix(0.7, 1.8, uGain), 1.0);
}
