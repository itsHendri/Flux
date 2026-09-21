// WISP wanderer — the one bright thing: a hot core, a wide halo, and a tail
// of fading light where it has been. Drawn as a screen pass over the dust,
// from the projected positions of the head and its trail.
in vec2 vUv;
out vec4 outColor;

uniform vec4 uTrail[48];   // screen uv, apparent radius, age 0..1 (w < 0 = off)
uniform int uTrailCount;

float segDistW(vec2 p, vec2 a, vec2 b) {
  vec2 ab = b - a;
  float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-8), 0.0, 1.0);
  return length(p - a - ab * h);
}

void main() {
  vec2 asp = vec2(uResolution.x / uResolution.y, 1.0);
  vec3 col = vec3(0.0);
  vec4 head = uTrail[0];
  if (uTrailCount > 0 && head.w >= 0.0) {
    // The head: white core, theme halo that breathes with the level.
    vec2 d = (vUv - head.xy) * asp;
    float r = max(head.z, 0.002);
    float q = dot(d, d) / (r * r);
    col += vec3(1.0) * exp(-q * 1.5) * 1.8;
    col += themeRamp(0.1) * exp(-q * 0.08) * (0.35 + uLevel * 0.5 + uBeat * 0.6);
  }
  // The tail: segments between consecutive samples, so a fast dart draws a
  // streak rather than a row of beads, thinning and fading with age.
  for (int i = 1; i < 48; i++) {
    if (i >= uTrailCount) break;
    vec4 a = uTrail[i - 1];
    vec4 b = uTrail[i];
    if (a.w < 0.0 || b.w < 0.0) continue;
    float dist = segDistW(vUv * asp, a.xy * asp, b.xy * asp);
    float r = max(b.z * (1.0 - b.w * 0.7), 0.0015);
    float fade = 1.0 - b.w;
    col += themeRamp(0.1 + b.w * 0.4) * exp(-dist * dist / (r * r) * 0.6) * fade * fade * 0.3;
  }
  outColor = vec4(col * mix(0.6, 1.6, uGain), 1.0);
}
