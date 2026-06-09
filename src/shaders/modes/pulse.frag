// PULSE — three organic layers stacked additively, one per band:
//   bass -> expanding warm rings
//   mid  -> rotating petal bloom with a noisy, organic edge
//   high -> cool sparkle field

// Petal bloom: a flower whose radius varies with angle, edge roughened by noise.
float petals(vec2 p, float count, float rot) {
  float a = atan(p.y, p.x) + rot;
  float r = length(p);
  float shape = 0.5 + 0.5 * cos(a * count);
  shape *= 0.75 + 0.45 * noise(vec2(a * 2.5, uTime * 0.4));
  float edge = mix(0.16, 0.60, shape);
  return smoothstep(0.06, 0.0, abs(r - edge));
}

vec3 render(vec2 uv) {
  vec2 p = centered(uv);
  float r = length(p);
  float gain = mix(0.6, 2.0, uGain);

  vec3 col = vec3(0.015, 0.018, 0.025);

  // --- bass: expanding warm rings --------------------------------------
  float ringPhase = uTime * (0.4 + uBass * 2.6);
  float rings = 0.5 + 0.5 * sin(r * mix(7.0, 17.0, uScale) - ringPhase * TAU);
  rings = pow(rings, 6.0) * smoothstep(1.3, 0.0, r);
  col += vec3(1.0, 0.30, 0.40) * rings * uBass * gain;

  // --- mid: rotating petal bloom ---------------------------------------
  float petalCount = floor(mix(4.0, 9.0, uMid));
  float bloom = petals(p, petalCount, uTime * 0.6);
  col += vec3(1.0, 0.72, 0.32) * bloom * (0.35 + uMid * gain);

  // --- high: twinkling sparkle field -----------------------------------
  vec2 cell = floor(p * mix(6.0, 15.0, uScale));
  float spark = hash(cell + floor(uTime * 6.0));
  spark = pow(spark, 14.0);
  col += vec3(0.50, 0.85, 1.0) * spark * uHigh * gain * 3.0;

  // --- shared core glow driven by overall level ------------------------
  col += vec3(0.45, 0.65, 0.95) * smoothstep(0.55, 0.0, r) * uLevel * 0.6;

  // Vignette.
  col *= 1.0 - 0.4 * smoothstep(0.55, 1.5, r);
  return col;
}
