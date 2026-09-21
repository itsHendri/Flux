// FORGE target shapes. Every particle has a home on the current shape, chosen
// by two fixed random numbers of its own, so a particle always lands on the
// same spot of a given shape and the swarm reads as a surface, not a cloud.
// Prepended to forge's simulation programs by ForgeMode.ts.

// Fibonacci lattice: height from the particle's place in the list, angle the
// golden angle times its index. Evenly spaced, with none of the clumping at
// the poles two random angles give. (The index has to be the real one: with
// any other multiplier the lattice turns into visible spiral bands.)
vec3 fibSphere(float u, float index) {
  float z = 1.0 - 2.0 * u;
  float r = sqrt(max(0.0, 1.0 - z * z));
  float a = index * 2.39996323;
  return vec3(r * cos(a), z, r * sin(a));
}

// u = the particle's place in the list (0..1), v = its own random number,
// index = its position in the list as a count.
vec3 shapeHome(int shape, float u, float v, float index) {
  if (shape == 0) {
    return fibSphere(u, index) * 1.05;
  }
  if (shape == 1) {
    // Torus, 1.0 around, 0.36 thick.
    float a = u * TAU * 37.0;
    float b = v * TAU;
    return vec3((1.0 + 0.36 * cos(b)) * cos(a), 0.36 * sin(b), (1.0 + 0.36 * cos(b)) * sin(a));
  }
  if (shape == 2) {
    // Trefoil knot, a tube around the curve.
    float t = u * TAU;
    vec3 c = vec3(sin(t) + 2.0 * sin(2.0 * t), cos(t) - 2.0 * cos(2.0 * t), -sin(3.0 * t)) * 0.38;
    vec3 c2 = vec3(sin(t + 0.01) + 2.0 * sin(2.0 * t + 0.02), cos(t + 0.01) - 2.0 * cos(2.0 * t + 0.02), -sin(3.0 * t + 0.03)) * 0.38;
    vec3 tang = normalize(c2 - c);
    vec3 nrm = normalize(cross(tang, vec3(0.0, 0.0, 1.0)));
    vec3 bin = cross(tang, nrm);
    float b = v * TAU;
    return c + (nrm * cos(b) + bin * sin(b)) * 0.16;
  }
  if (shape == 3) {
    // Cube shell: pick a face, then a point on it.
    float f = floor(u * 6.0);
    vec2 q = vec2(fract(u * 6.0 * 29.0), v) * 2.0 - 1.0;
    float s = mod(f, 2.0) < 1.0 ? 1.0 : -1.0;
    vec3 p = f < 2.0 ? vec3(s, q) : f < 4.0 ? vec3(q.x, s, q.y) : vec3(q, s);
    return p * 0.8;
  }
  // Double helix: two strands and the rungs between them.
  float y = u * 2.0 - 1.0;
  float a = y * 7.0;
  float strand = v < 0.5 ? 0.0 : PI;
  vec3 onStrand = vec3(cos(a + strand) * 0.55, y * 1.3, sin(a + strand) * 0.55);
  // One particle in five is on a rung instead.
  if (fract(v * 5.0) < 0.2) {
    float along = fract(v * 17.0) * 2.0 - 1.0;
    float ra = floor(a * 1.3) / 1.3;
    return vec3(cos(ra) * 0.55 * along, y * 1.3, sin(ra) * 0.55 * along);
  }
  return onStrand;
}
