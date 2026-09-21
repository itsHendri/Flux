// VECTOR persistence — the phosphor fading. Drawn with blendFunc(ZERO,
// SRC_ALPHA), so the buffer is multiplied by this alpha in place: no
// ping-pong, and the decay is exact.
in vec2 vUv;
out vec4 outColor;

uniform float uFade;

void main() {
  outColor = vec4(0.0, 0.0, 0.0, uFade);
}
