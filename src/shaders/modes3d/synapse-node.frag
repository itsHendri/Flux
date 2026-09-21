// SYNAPSE node — a star: a hot core, a wide halo, a flash when it's born and
// again whenever it fires.
in vec2 vQuad;
in vec4 vInfo;   // born, band, fired, presence
in float vSize;
out vec4 outColor;

void main() {
  float r2 = dot(vQuad, vQuad);
  if (r2 > 1.0) discard;
  float born = vInfo.x;
  float band = vInfo.y;
  float fired = vInfo.z;
  float presence = vInfo.w;

  float age = uTime - born;
  float flash = exp(-max(age, 0.0) * 3.5) * step(0.0, age);
  float fire = exp(-max(uTime - fired, 0.0) * 3.0);
  // Appear: a new star swells in over a fifth of a second.
  float appear = smoothstep(0.0, 0.2, age);

  float core = exp(-r2 * 60.0);
  float halo = exp(-r2 * 7.0) * 0.35 + (1.0 - r2) * 0.04;
  vec3 col = themeRamp(0.1 + band * 0.7);
  float heat = 1.0 + flash * 3.0 + fire * 1.6;
  vec3 c = col * halo * heat + mix(col, vec3(1.0), 0.7) * core * (1.2 + flash * 2.0 + fire);
  c *= presence * appear * (0.7 + vSize * 0.3);
  outColor = vec4(c * mix(0.6, 1.6, uGain), 1.0);
}
