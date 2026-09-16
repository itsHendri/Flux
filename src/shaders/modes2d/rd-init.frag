// REACTION seed — the substrate full of chemical A, with a scattering of B
// blobs for the pattern to grow out of. Gray-Scott does nothing at all from a
// uniform start: B has to exist somewhere before it can consume A.
in vec2 vUv;
out vec4 outState;

uniform vec2 uSimSize;
uniform float uSeed;

void main() {
  vec2 p = vUv * vec2(uSimSize.x / uSimSize.y, 1.0);
  float b = 0.0;
  // A handful of soft blobs, placed by hash so each reseed differs.
  for (int i = 0; i < 12; i++) {
    vec2 c = vec2(hash(vec2(float(i) * 3.1 + uSeed, 7.7)),
                  hash(vec2(float(i) * 5.7 - uSeed, 2.3)));
    c.x *= uSimSize.x / uSimSize.y;
    b = max(b, smoothstep(0.045, 0.0, length(p - c)));
  }
  // Plus a sparse speckle across the whole field, one hash per cell. Slow
  // regimes (Maze especially) spread from a front, so a dozen blobs leave
  // most of the screen empty for many seconds; with seeds everywhere the
  // pattern resolves across the whole frame at once — the way Munafo's
  // reference images are started. Per-cell means the speckle gets finer with
  // Detail, matching the lines it grows into.
  float speckle = step(0.985, hash(gl_FragCoord.xy * 0.731 + uSeed));
  b = max(b, speckle);
  outState = vec4(1.0, b, 0.0, 1.0);
}
