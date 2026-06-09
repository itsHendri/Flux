// SCANLINE / VHS — final-stage analog-video grunge. Periodic horizontal
// scanline darkening, a small per-band horizontal jitter that wobbles over time
// (VHS tracking), and film grain. All scaled by uScanlineIntensity so it ranges
// from a subtle CRT texture to a heavy degraded-tape look. Uses noise()/hash()
// from common.glsl. Toggleable.
vec3 render(vec2 uv) {
  float amt = uScanlineIntensity;

  // VHS horizontal jitter — small per-band wobble, re-rolled a few times a second.
  float band = floor(gl_FragCoord.y / 3.0);
  float jitter = (noise(vec2(band, floor(uTime * 12.0))) - 0.5) * 0.02 * amt;
  vec3 col = texture(uSource, vec2(uv.x + jitter, uv.y)).rgb;

  // Scanlines — periodic horizontal darkening (~4 device-px period).
  float scan = 0.5 + 0.5 * sin(gl_FragCoord.y * (PI / 2.0));
  col *= 1.0 - amt * 0.6 * (1.0 - scan);

  // Film grain.
  float grain = (hash(gl_FragCoord.xy + fract(uTime) * 91.7) - 0.5) * 0.18 * amt;
  col += grain;

  return col;
}
