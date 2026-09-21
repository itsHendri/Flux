import { describe, it, expect } from 'vitest';
import { driveRate } from '../src/audio/drive.ts';

describe('driveRate — the music’s clock', () => {
  it('stands still in silence', () => {
    expect(driveRate(0, 0, 0)).toBe(0);
  });

  it('runs faster for louder, punchier music, and never backwards', () => {
    expect(driveRate(0.2, 0.2, 0)).toBeLessThan(driveRate(0.8, 0.6, 0));
    expect(driveRate(0.5, 0.5, 1)).toBeGreaterThan(driveRate(0.5, 0.5, 0));
    for (const v of [0, 0.3, 1]) expect(driveRate(v, v, v)).toBeGreaterThanOrEqual(0);
  });
});
