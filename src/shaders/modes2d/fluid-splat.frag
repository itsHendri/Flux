// FLUID splat — inject force and ink. This is where the music enters: every
// other pass is just physics carrying on from what was put in here.
//
// Up to four splats a frame in one pass, each a Gaussian blob, added to what's
// already there. Used twice per frame with the same points: once on the
// velocity field (a push) and once on the dye (a colour).
in vec2 vUv;
out vec4 outColor;

uniform sampler2D uTarget;
uniform float uAspect;
uniform int uSplatCount;
uniform vec4 uSplatPos[4];  // xy = centre in uv, z = radius, w = unused
uniform vec4 uSplatData[4]; // velocity pass: xy = push; dye pass: rgb = colour

void main() {
  vec3 sum = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (i >= uSplatCount) break;
    vec2 d = vUv - uSplatPos[i].xy;
    d.x *= uAspect;
    float fall = exp(-dot(d, d) / max(uSplatPos[i].z, 1e-5));
    sum += uSplatData[i].xyz * fall;
  }
  outColor = vec4(texture(uTarget, vUv).xyz + sum, 1.0);
}
