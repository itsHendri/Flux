// FORGE seed — a loose cloud. Nothing starts assembled: arriving in the mode
// shows the first shape being built.
out vec4 outState;

uniform vec2 uStateSize;
uniform float uIsVelocity;

void main() {
  vec2 tc = gl_FragCoord.xy;
  float id = tc.y * uStateSize.x + tc.x;
  float total = uStateSize.x * uStateSize.y;
  if (uIsVelocity > 0.5) {
    outState = vec4(0.0);
  } else {
    vec3 p = vec3(hash(tc + 1.3), hash(tc + 4.7), hash(tc + 9.1)) * 2.0 - 1.0;
    // w = this particle's place in the spectrum and on every shape, for life.
    outState = vec4(p * 2.2, id / max(total - 1.0, 1.0));
  }
}
