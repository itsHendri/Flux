// TRAILS3D point fragment — soft additive dots, cool bright heads shading to
// violet tails by age (the comet read), sparkling on highs. Gets the standard
// preamble (builtins, controls, common.glsl); own out + main (custom-mode
// shape). The app's trails/bloom post passes supply persistence and glow.

in float vAge;
out vec4 outColor;

const float LIFE = 6.0;

void main() {
  float m = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
  // Fade in fast, fade out before respawn so resets never pop.
  float fade = smoothstep(0.0, 0.5, vAge) * smoothstep(LIFE, LIFE - 1.2, vAge);
  vec3 head = vec3(0.62, 0.80, 1.0);
  vec3 tail = vec3(0.84, 0.60, 1.0);
  vec3 col = mix(head, tail, smoothstep(0.0, 3.5, vAge));
  float lum = 0.45 + uLevel * 0.5 + uBeat * 0.4 + uHigh * 0.35;
  outColor = vec4(col * m * fade * lum * mix(0.7, 1.6, uGain), 1.0);
}
