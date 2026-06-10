// BLOOM stage 2 of 3 — progressive 3×3 tent upsample (Jimenez 2014). Each draw
// filters the next-smaller mip (uSource) up one level; BloomPipeline runs it
// with additive blending (ONE, ONE) so the result accumulates onto the
// downsampled content the target level already holds. uBloomRadius widens the
// tent footprint, scattering the glow further per level.

vec3 render(vec2 uv) {
  vec2 t = (1.0 + uBloomRadius) / vec2(textureSize(uSource, 0));
  vec3 sum = texture(uSource, uv + t * vec2(-1.0,  1.0)).rgb;
  sum += texture(uSource, uv + t * vec2( 0.0,  1.0)).rgb * 2.0;
  sum += texture(uSource, uv + t * vec2( 1.0,  1.0)).rgb;
  sum += texture(uSource, uv + t * vec2(-1.0,  0.0)).rgb * 2.0;
  sum += texture(uSource, uv).rgb * 4.0;
  sum += texture(uSource, uv + t * vec2( 1.0,  0.0)).rgb * 2.0;
  sum += texture(uSource, uv + t * vec2(-1.0, -1.0)).rgb;
  sum += texture(uSource, uv + t * vec2( 0.0, -1.0)).rgb * 2.0;
  sum += texture(uSource, uv + t * vec2( 1.0, -1.0)).rgb;
  return sum / 16.0;
}
