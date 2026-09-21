// FORGE bead — a chrome sphere on a point sprite.
//
// The sprite's coordinate is the sphere's normal in view space; reflect the
// view ray off it, rotate that back into the world, and look it up in the
// studio. So each bead is a tiny mirror of the same room the background is,
// and the swarm catches the softbox as it turns.
in vec3 vViewPos;
in float vBand;
out vec4 outColor;

uniform mat4 uView;

void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  q.y = -q.y;
  float rr = dot(q, q);
  if (rr > 1.0) discard;
  vec3 nView = vec3(q, sqrt(1.0 - rr));
  vec3 rdView = normalize(vViewPos);
  vec3 refView = reflect(rdView, nView);
  // View → world: the view matrix is a rotation (plus translation), so its
  // inverse rotation is the transpose.
  mat3 toWorld = transpose(mat3(uView));
  vec3 ref = toWorld * refView;

  float fres = 0.65 + 0.35 * pow(1.0 - clamp(dot(nView, -rdView), 0.0, 1.0), 4.0);
  vec3 col = studio(ref) * fres;
  // A hint of the particle's band in the metal — coloured chrome, not paint.
  col *= mix(vec3(1.0), themeRamp(0.1 + vBand * 0.6) * 1.6, 0.22 * uThemeMix);
  col *= mix(0.7, 1.6, uGain) * (1.0 + uBeat * 0.3);
  outColor = vec4(col, 1.0);
}
