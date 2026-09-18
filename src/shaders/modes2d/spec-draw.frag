// SPECTROGRAM draw — read the ring buffer as time against frequency.
//
// Time runs across the screen with now at the leading edge, frequency up the
// other axis. The buffer is a ring, so the newest column is wherever the write
// head happens to be and the mapping has to wrap; sampling is done by hand
// (fetch the four neighbours and blend) because a wrapped LINEAR fetch would
// smear the oldest column into the newest across the seam.
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uHistory;
uniform vec2 uSpecSize;   // columns, rows
uniform float uWriteCol;  // where the newest column sits in the ring
uniform float uWaterfall; // 0 = time across, 1 = time down

float sampleHistory(float colF, float rowF) {
  float w = uSpecSize.x;
  float c0 = floor(colF);
  float c1 = c0 + 1.0;
  float r0 = floor(rowF);
  float r1 = min(r0 + 1.0, uSpecSize.y - 1.0);
  float fc = colF - c0;
  float fr = rowF - r0;
  // mod() keeps both column samples inside the ring.
  ivec2 a = ivec2(int(mod(c0, w)), int(r0));
  ivec2 b = ivec2(int(mod(c1, w)), int(r0));
  ivec2 c = ivec2(int(mod(c0, w)), int(r1));
  ivec2 d = ivec2(int(mod(c1, w)), int(r1));
  float top = mix(texelFetch(uHistory, a, 0).r, texelFetch(uHistory, b, 0).r, fc);
  float bot = mix(texelFetch(uHistory, c, 0).r, texelFetch(uHistory, d, 0).r, fc);
  return mix(top, bot, fr);
}

vec3 render(vec2 uv) {
  // Age: 0 at the leading edge (now), 1 at the far edge (the oldest column
  // still in the buffer).
  float age = uWaterfall > 0.5 ? uv.y : 1.0 - uv.x;
  float freq = uWaterfall > 0.5 ? uv.x : uv.y;

  float visible = uSpecSize.x * mix(0.25, 1.0, uSpecWindow);
  float colF = uWriteCol - age * visible;
  float rowF = clamp(freq, 0.0, 1.0) * (uSpecSize.y - 1.0);
  float mag = sampleHistory(colF, rowF);

  // Contrast is a gamma, not a multiplier. Multiplying pushes everything above
  // the loudest bin to white and the picture becomes a silhouette; a gamma
  // moves the midtones and leaves both ends where they are, which is what lets
  // a quiet harmonic and a kick share a frame.
  float v = pow(clamp(mag, 0.0, 1.0), mix(3.0, 0.7, uSpecGain));

  vec3 col = themeRamp(0.05 + v * 0.62) * v;
  // Older columns dim, so the eye reads which way time runs.
  col *= mix(1.0, 0.45, age * age);
  // The leading edge is the live spectrum: a bright line so "now" is obvious.
  float edge = smoothstep(0.02, 0.0, age);
  col += themeRamp(0.75) * edge * (0.25 + uLevel * 0.9);
  col += vec3(0.012, 0.013, 0.02);

  col *= mix(0.7, 2.0, uGain);
  return themed(col, 0.08 + v * 0.55);
}

void main() {
  outColor = vec4(render(vUv), 1.0);
}
