// REACTION step — the Gray-Scott model, one Euler step per draw.
//
//   A' = Da*lap(A) - A*B^2 + f*(1 - A)
//   B' = Db*lap(B) + A*B^2 - (k + f)*B
//
// Two chemicals: B eats A and reproduces, feed f tops A back up, kill k
// removes B. Everything the pattern does — coral, worms, mitosis, spots —
// comes out of where (f, k) sits; the shapes are not drawn anywhere.
// (Turing 1952; Pearson's parameterisation, catalogued by Munafo at
// mrob.com/pub/comp/xmorphia — see REFERENCES.md.)
in vec2 vUv;
out vec4 outState;

uniform sampler2D uState;
uniform vec2 uSimSize;
uniform float uInject; // 1 on the frame a kick lands, 0 otherwise

vec2 stateAt(vec2 offset) {
  return texture(uState, vUv + offset / uSimSize).rg;
}

void main() {
  vec2 c = stateAt(vec2(0.0));

  // The standard 9-point Laplacian: 0.2 orthogonal, 0.05 diagonal, -1 centre.
  vec2 lap = -c
    + 0.20 * (stateAt(vec2(1, 0)) + stateAt(vec2(-1, 0)) + stateAt(vec2(0, 1)) + stateAt(vec2(0, -1)))
    + 0.05 * (stateAt(vec2(1, 1)) + stateAt(vec2(-1, 1)) + stateAt(vec2(1, -1)) + stateAt(vec2(-1, -1)));

  // Audio nudges f and k, but only slightly: the living region of this model
  // is narrow, and a big push either kills the pattern or floods the frame.
  float feed = uRdFeed + (uBass - 0.35) * 0.006 * uRdAudio;
  float kill = uRdKill + (uHigh - 0.35) * 0.004 * uRdAudio;

  float reaction = c.r * c.g * c.g;
  float dA = lap.r - reaction + feed * (1.0 - c.r);
  float dB = 0.5 * lap.g + reaction - (kill + feed) * c.g;
  vec2 next = clamp(c + vec2(dA, dB), 0.0, 1.0);

  // A kick sprays fresh B so the pattern keeps being reborn instead of
  // settling — the visual equivalent of the beat restarting the growth.
  if (uInject > 0.5) {
    vec2 p = vUv * vec2(uSimSize.x / uSimSize.y, 1.0);
    for (int i = 0; i < 3; i++) {
      vec2 s = vec2(hash(vec2(float(i) * 2.7 + uTime, 1.3)),
                    hash(vec2(float(i) * 6.1 - uTime, 9.7)));
      s.x *= uSimSize.x / uSimSize.y;
      next.g = max(next.g, smoothstep(0.03, 0.0, length(p - s)));
    }
  }

  outState = vec4(next, 0.0, 1.0);
}
