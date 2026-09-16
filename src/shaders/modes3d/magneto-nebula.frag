// MAGNETO background — the nebula, the rays, and the cores they come from.
//
// iTunes 10's Magnetosphere had three named parts: "the cores, which are the
// moving spheres; the rays, which flow out of the cores; and the nebula clouds,
// which fill the whole screen" — the nebula described as iridescent (TidBITS,
// see REFERENCES.md). FLUX's magneto already had the physics but its poles were
// invisible force points on a flat dark clear. This pass replaces the clear:
// it draws before the additive particles, so the swarm sits in front of it.
//
// Everything here is screen-space. The cores are projected on the CPU and
// handed in, and the clouds scroll with the camera's orbit so they feel like a
// distant backdrop rather than a painted card.
in vec2 vUv;
out vec4 outColor;

// xy = core position in screen uv, z = apparent radius in screen heights,
// w = charge (+1 / -1), or 0 when the core is behind the camera.
uniform vec4 uCores[4];
uniform float uCamAngle;

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  vec2 p = (vUv - 0.5) * vec2(aspect, 1.0);

  // --- Nebula -----------------------------------------------------------
  // Domain-warped fbm (iq's technique, as in `flow`) so the clouds billow
  // rather than tile. The warp field doubles as the iridescence phase, which
  // is what makes the colour slide through the cloud instead of sitting flat.
  vec2 q = p * 1.3 + vec2(uCamAngle * 0.35, 0.0);
  float t = uTime * 0.025;
  vec2 warp = vec2(fbm(q + t), fbm(q + vec2(5.2, 1.3) - t));
  float n = fbm(q + warp * 1.7 + uBass * 0.25);
  float density = smoothstep(0.32, 0.9, n);
  float phase = n * 1.3 + length(warp) * 0.9 + uTime * 0.015;

  // --- Cores and their light --------------------------------------------
  vec3 wash = vec3(0.0);  // light the cores throw into the clouds
  vec3 rays = vec3(0.0);
  vec3 cores = vec3(0.0);
  for (int i = 0; i < 4; i++) {
    if (uCores[i].w == 0.0) continue;
    vec2 c = (uCores[i].xy - 0.5) * vec2(aspect, 1.0);
    vec2 d = p - c;
    float r = length(d);
    float s = max(uCores[i].z, 0.002);
    // Positive and negative cores take different theme stops, so the two
    // sides of the fight are legible in the light as well as the swarm.
    vec3 tint = themeRamp(uCores[i].w > 0.0 ? 0.08 : 0.42);

    wash += tint * (s * s) / (r * r + s * s * 0.6);

    // Rays. The angular noise runs on the unit direction vector rather than
    // on atan(): atan jumps from +pi to -pi, and noise over it leaves a hard
    // seam on one side of every core. Sharpening the noise with pow() turns
    // soft variation into distinct spokes; a second noise term scrolling
    // outward along the radius is the "flow" — light moving away from the core.
    vec2 dir = d / max(r, 1e-4);
    float fi = float(i) * 7.3;
    float spokes = pow(noise(dir * 5.5 + vec2(fi, uTime * 0.12)), 5.0) * 1.4;
    float fine = pow(noise(dir * 17.0 + vec2(-fi, uTime * 0.3)), 8.0) * 1.0;
    // Radius is measured in core sizes, so a near core's rays flow at the same
    // apparent rate as a distant one's.
    float flow = 0.45 + 0.55 * noise(vec2(dot(dir, vec2(3.1, 4.7)) * 4.0,
                                          r / s * 0.45 - uTime * (1.4 + uLevel * 2.0)));
    float reach = s * mix(4.0, 11.0, uMagRays) * (1.0 + uBeat * 0.5);
    float fall = exp(-r / reach) * smoothstep(s * 0.6, s * 1.6, r);
    // Kept well under 1.0: this is a background that bloom and trails will
    // both amplify, and the swarm in front of it is the subject.
    rays += tint * (spokes + fine) * flow * fall * (0.12 + uHigh * 0.35 + uBeat * 0.3);

    // The core itself: a soft tinted body with a hot white centre.
    cores += tint * smoothstep(s * 1.6, 0.0, r) * 0.45
           + vec3(1.0) * smoothstep(s * 0.45, 0.0, r) * (0.5 + uBeat * 0.4);
  }

  vec3 base = vec3(0.012, 0.014, 0.026);
  // Clouds are dim on their own and glow where the cores light them.
  vec3 nebula = themeRamp(phase) * density * (0.09 + min(wash, vec3(1.5)) * 0.35) * uMagNebula;
  vec3 col = base + nebula + (rays + cores) * uMagRays;

  col *= mix(0.6, 1.4, uGain) * (0.85 + uLevel * 0.3);
  outColor = vec4(col, 1.0);
}
