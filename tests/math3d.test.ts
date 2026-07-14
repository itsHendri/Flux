import { describe, it, expect } from 'vitest';
import { perspective, lookAt } from '../src/render/math3d.ts';

describe('perspective', () => {
  it('builds the standard RH projection', () => {
    const m = perspective(Math.PI / 2, 2, 1, 11);
    expect(m[0]).toBeCloseTo(0.5); // f/aspect with f = 1/tan(45°) = 1
    expect(m[5]).toBeCloseTo(1);
    expect(m[10]).toBeCloseTo(-12 / 10); // (far+near)/(near-far)
    expect(m[11]).toBe(-1);
    expect(m[14]).toBeCloseTo(-22 / 10); // 2*far*near/(near-far)
  });
});

describe('lookAt', () => {
  it('is identity rotation when looking down -Z from +Z', () => {
    const m = lookAt([0, 0, 5], [0, 0, 0]);
    // Basis vectors stay world-aligned…
    expect([m[0], m[5], m[10]]).toEqual([1, 1, 1]);
    expect([m[1], m[2], m[4], m[6], m[8], m[9]]).toEqual([0, 0, 0, 0, 0, 0]);
    // …and the eye translates to the origin.
    expect(m[14]).toBeCloseTo(-5);
  });

  it('transforms the target to a point straight ahead on -Z', () => {
    const m = lookAt([3, 2, 1], [0, 0, 0]);
    const [x, y, z] = [0, 0, 0];
    const tx = m[0] * x + m[4] * y + m[8] * z + m[12];
    const ty = m[1] * x + m[5] * y + m[9] * z + m[13];
    const tz = m[2] * x + m[6] * y + m[10] * z + m[14];
    expect(tx).toBeCloseTo(0);
    expect(ty).toBeCloseTo(0);
    expect(tz).toBeCloseTo(-Math.hypot(3, 2, 1)); // straight ahead at eye distance
  });
});
