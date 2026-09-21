// VECTOR beam — the energy a Gaussian spot deposits while sweeping a segment.
//
// Integrating exp(-r²/2σ²) along the segment gives a closed form: a Gaussian
// across it times a difference of two erfs along it (woscope, m1el). Divided
// by length, so a fast sweep is dim and a slow one bright — which is how a
// real phosphor trace reads: the beam carries fixed energy per unit *time*,
// and where it lingers it burns.
in vec2 vLocal;
in float vLen;
in float vSigma;
out vec4 outColor;

uniform float uFrameWeight;

// Abramowitz & Stegun 7.1.26 — |error| < 1.5e-7, plenty for light.
float erf1(float x) {
  float s = sign(x);
  x = abs(x);
  float t = 1.0 / (1.0 + 0.3275911 * x);
  float y = 1.0 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * exp(-x * x);
  return s * y;
}

void main() {
  float s = vSigma * 1.41421356;
  float across = exp(-(vLocal.y * vLocal.y) / (s * s));
  float along;
  if (vLen < 1e-3) {
    // A sample that didn't move: the spot sits still, all its energy here.
    along = exp(-(vLocal.x * vLocal.x) / (s * s));
  } else {
    along = 0.5 * (erf1(vLocal.x / s) - erf1((vLocal.x - vLen) / s)) * min(1.0, vSigma * 2.5 / vLen);
  }
  outColor = vec4(vec3(across * along * uFrameWeight), 1.0);
}
