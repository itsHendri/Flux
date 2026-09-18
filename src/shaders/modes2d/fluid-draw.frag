// FLUID draw — the ink, lit.
//
// Dye alone is flat colour; what sells a fluid is the *shape* of the dye, so
// the density gradient is used as a surface normal to light it, the same trick
// the reaction mode uses. Velocity adds a slight highlight where the fluid is
// moving fastest, which is what makes fast filaments read as fast.
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uDye;
uniform sampler2D uVelocity;
uniform vec2 uTexel;

void main() {
  vec3 dye = texture(uDye, vUv).rgb;
  float d = length(dye);

  float l = length(texture(uDye, vUv - vec2(uTexel.x, 0.0)).rgb);
  float r = length(texture(uDye, vUv + vec2(uTexel.x, 0.0)).rgb);
  float b = length(texture(uDye, vUv - vec2(0.0, uTexel.y)).rgb);
  float t = length(texture(uDye, vUv + vec2(0.0, uTexel.y)).rgb);
  vec3 n = normalize(vec3(l - r, b - t, 0.6));
  float lit = 0.55 + 0.45 * clamp(dot(n, normalize(vec3(0.4, 0.5, 0.75))), 0.0, 1.0);

  float speed = length(texture(uVelocity, vUv).xy);

  vec3 col = dye * lit;
  col += dye * clamp(speed * 0.004, 0.0, 0.5);          // motion highlight
  col += vec3(0.012, 0.013, 0.02) * (1.0 - clamp(d, 0.0, 1.0)); // the tank
  col *= mix(0.7, 2.0, uGain);
  outColor = vec4(col, 1.0);
}
