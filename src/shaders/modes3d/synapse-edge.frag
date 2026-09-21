// SYNAPSE edge — a filament that draws itself in from the parent, and carries
// a pulse when either end fires.
in vec2 vLocal;
in float vLen;
in float vWidth;
in vec4 vEdge;   // born, fired, fromA, presence
in float vBand;
out vec4 outColor;

void main() {
  float born = vEdge.x;
  float fired = vEdge.y;
  float fromA = vEdge.z;
  float presence = vEdge.w;

  // Growth: the line extends from A to B over half a second.
  float grow = clamp((uTime - born) / 0.5, 0.0, 1.0);
  float t = vLocal.x / vLen;
  float head = grow * vLen;
  float drawn = smoothstep(head + vWidth, head - vWidth, vLocal.x) * step(-vWidth * 7.0, vLocal.x);
  // Soft ends: the line fades into its nodes rather than stopping square.
  float ends = smoothstep(-vWidth * 2.0, vWidth * 2.0, vLocal.x) *
               smoothstep(vLen + vWidth * 2.0, vLen - vWidth * 2.0, vLocal.x);

  float r = vLocal.y / vWidth;
  float core = exp(-r * r * 0.5);
  float halo = exp(-r * r * 0.06) * 0.18;

  // The pulse: a bright bead travelling the edge, away from whichever end
  // fired, in 0.6 s whatever the edge's length.
  float p = (uTime - fired) / 0.6;
  float pos = fromA > 0.5 ? p : 1.0 - p;
  float along = (t - pos) * vLen;
  float pulse = (p >= 0.0 && p <= 1.0) ? exp(-along * along / (vWidth * vWidth * 18.0)) : 0.0;

  vec3 col = themeRamp(0.1 + vBand * 0.7);
  float lum = (core * 0.55 + halo) * (0.55 + uLevel * 0.45) + pulse * (core * 2.5 + halo * 3.0);
  vec3 outc = mix(col, vec3(1.0), pulse * core * 0.6) * lum * drawn * ends * presence;
  outColor = vec4(outc * mix(0.6, 1.6, uGain), 1.0);
}
