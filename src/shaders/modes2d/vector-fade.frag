// VECTOR persistence — the phosphor fading, in up to two draws of this shader.
// First with blendFunc(ZERO, SRC_ALPHA): the buffer is multiplied by uFade in
// place, no ping-pong. Then, on 8-bit buffers only, with a reverse-subtract
// blend: uFloor is taken off every pixel, because there the multiply rounds a
// faint value back up to itself and a dim ghost of the trace would never
// fade. (Not on float buffers: nothing clamps there, and the subtraction would
// push the black below zero and eat the next trace.)
in vec2 vUv;
out vec4 outColor;

uniform float uFade;
uniform float uFloor;

void main() {
  outColor = vec4(vec3(uFloor), uFade);
}
