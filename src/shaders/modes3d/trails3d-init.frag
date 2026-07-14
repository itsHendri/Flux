// TRAILS3D seed pass — fills the position texture with points on the unit
// sphere and staggered ages (so respawns spread out from the first frame).
// Runs once whenever the particle texture is (re)allocated.

out vec4 outPos;

void main() {
  vec2 tc = gl_FragCoord.xy;
  outPos = vec4(spherePoint(tc), hash(tc + 3.7) * 6.0);
}
