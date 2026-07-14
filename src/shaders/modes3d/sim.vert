#version 300 es
// Attribute-less fullscreen triangle for the trails3d GPGPU passes.
void main() {
  const vec2 p[3] = vec2[3](vec2(-1., -1.), vec2(3., -1.), vec2(-1., 3.));
  gl_Position = vec4(p[gl_VertexID], 0., 1.);
}
