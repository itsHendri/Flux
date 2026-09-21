// VECTOR draw — the phosphor buffer as light, over a graticule.
//
// Colour is P31 phosphor green by default (the green of every analogue scope),
// pulled toward the theme by Tint. The core of the trace goes white as it
// saturates, which is what makes a bright phosphor look hot rather than just
// more green.
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPhosphor;

float gridLine(float v, float spacing, float px) {
  float d = abs(fract(v / spacing + 0.5) - 0.5) * spacing;
  return 1.0 - smoothstep(0.0, px, d);
}

vec3 render(vec2 uv) {
  float e = texture(uPhosphor, uv).r;
  vec3 phosphor = vec3(0.25, 1.0, 0.45);
  vec3 beam = themed(phosphor, 0.15 + uWidth * 0.5) * e;
  beam += vec3(1.0) * smoothstep(0.6, 3.0, e) * 0.6;
  // A kick flares the beam a little, as if the intensity knob were nudged.
  beam *= 1.0 + uBeat * 0.35;

  vec3 col = beam;
  if (uScopeGraticule > 0.5) {
    // Square graticule, ten divisions across the short side, centre cross
    // marked — the face of a scope, not a chart.
    float scale = min(uResolution.x, uResolution.y) * 0.5;
    vec2 p = (uv - 0.5) * uResolution / scale;
    float px = 1.0 / scale;
    float inside = step(max(abs(p.x), abs(p.y)), 1.0);
    float g = max(gridLine(p.x, 0.2, px), gridLine(p.y, 0.2, px)) * 0.5;
    g = max(g, max(gridLine(p.x, 1.0, px * 1.5), gridLine(p.y, 1.0, px * 1.5)));
    // The two diagonals are where mono (X/Y) and hard-panned (mid/side) sit.
    float diag = max(gridLine(p.x - p.y, 10.0, px * 1.4), gridLine(p.x + p.y, 10.0, px * 1.4));
    g = max(g, diag * 0.35);
    col += themed(vec3(0.35, 0.45, 0.4), 0.6) * g * inside * 0.2;
  }
  return col;
}

void main() {
  outColor = vec4(render(vUv), 1.0);
}
