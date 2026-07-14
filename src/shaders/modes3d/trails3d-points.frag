// TRAILS3D point fragment — soft additive dots. Gets the Renderer's standard
// preamble (builtins, controls, common.glsl), so hsv() and the audio
// uniforms are available; declares its own out and main (custom-mode shape).

in float vSeed;
out vec4 outColor;

void main() {
  float m = smoothstep(0.5, 0.1, length(gl_PointCoord - 0.5));
  vec3 col = hsv(0.55 + vSeed * 0.25 + uTime * 0.01, 0.6, 1.0);
  outColor = vec4(col * m * (0.35 + uLevel * 0.4 + uBeat * 0.3), 1.0);
}
