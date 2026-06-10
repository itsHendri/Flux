import { describe, it, expect } from 'vitest';
import { computeMipSizes, MAX_BLOOM_LEVELS, MIN_BLOOM_DIM } from '../src/render/BloomPipeline.ts';

describe('computeMipSizes', () => {
  it('halves each level from a typical 1080p-ish canvas', () => {
    expect(computeMipSizes(1920, 1080)).toEqual([
      { w: 960, h: 540 },
      { w: 480, h: 270 },
      { w: 240, h: 135 },
      { w: 120, h: 67 },
      { w: 60, h: 33 },
      { w: 30, h: 16 },
    ]);
  });

  it('never exceeds MAX_BLOOM_LEVELS', () => {
    expect(computeMipSizes(8192, 8192).length).toBe(MAX_BLOOM_LEVELS);
  });

  it('stops before a level drops under MIN_BLOOM_DIM', () => {
    for (const { w, h } of computeMipSizes(100, 100)) {
      expect(Math.min(w, h)).toBeGreaterThanOrEqual(MIN_BLOOM_DIM);
    }
  });

  it('handles odd dimensions without ever returning a zero size', () => {
    for (const { w, h } of computeMipSizes(1919, 1079)) {
      expect(w).toBeGreaterThan(0);
      expect(h).toBeGreaterThan(0);
    }
  });

  it('always returns at least one level, even for a tiny canvas', () => {
    expect(computeMipSizes(2, 2).length).toBeGreaterThanOrEqual(1);
    expect(computeMipSizes(1, 1)).toEqual([{ w: 1, h: 1 }]);
  });
});
