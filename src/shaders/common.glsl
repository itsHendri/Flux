// Shared helpers available to every shader mode.
// The Renderer prepends the #version header, the uniform block, and this file
// before each mode's source, then appends a main() that calls render().

#define PI 3.14159265359
#define TAU 6.28318530718

// Aspect-corrected, centered coordinates. x in [-a..a], y in [-1..1].
vec2 centered(vec2 uv) {
  vec2 p = uv * 2.0 - 1.0;
  p.x *= uResolution.x / uResolution.y;
  return p;
}

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// Value noise.
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 hsv(float h, float s, float v) {
  vec3 k = vec3(5.0, 3.0, 1.0);
  vec3 p = abs(fract(h + k / 6.0) * 6.0 - 3.0);
  return v * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), s);
}
