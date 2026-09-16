import { describe, it, expect } from 'vitest';
import { SpectrumSmoother } from '../src/audio/SpectrumSmoother.ts';

const DT = 1 / 60;

describe('SpectrumSmoother', () => {
  it('rises fast and falls slow — a transient is never muted', () => {
    const s = new SpectrumSmoother(4, { attack: 0.012, release: 0.22 });
    const up = new Uint8Array([255, 255, 255, 255]);
    s.update(up, DT);
    // One frame of attack should already be most of the way there.
    expect(up[0]).toBeGreaterThan(190);

    const down = new Uint8Array([0, 0, 0, 0]);
    s.update(down, DT);
    // ...while one frame of release barely moves.
    expect(down[0]).toBeGreaterThan(150);
  });

  it('settles on a steady input', () => {
    const s = new SpectrumSmoother(1);
    for (let i = 0; i < 200; i++) s.update(new Uint8Array([100]), DT);
    const out = new Uint8Array([100]);
    s.update(out, DT);
    expect(out[0]).toBe(100);
  });

  it('smooths each bin independently', () => {
    const s = new SpectrumSmoother(3);
    for (let i = 0; i < 100; i++) s.update(new Uint8Array([255, 0, 255]), DT);
    const out = new Uint8Array([255, 0, 255]);
    s.update(out, DT);
    expect(out[0]).toBeGreaterThan(250);
    expect(out[1]).toBe(0);
    expect(out[2]).toBeGreaterThan(250);
  });

  it('is framerate-independent: one big step ≈ several small ones', () => {
    const slow = new SpectrumSmoother(1);
    const fast = new SpectrumSmoother(1);
    const a = new Uint8Array([200]);
    slow.update(a, 4 / 60);
    const b = new Uint8Array([200]);
    for (let i = 0; i < 4; i++) {
      b[0] = 200;
      fast.update(b, 1 / 60);
    }
    expect(Math.abs(a[0] - b[0])).toBeLessThanOrEqual(2);
  });

  it('forgets everything on reset', () => {
    const s = new SpectrumSmoother(1);
    for (let i = 0; i < 50; i++) s.update(new Uint8Array([255]), DT);
    s.reset();
    const out = new Uint8Array([0]);
    s.update(out, DT);
    expect(out[0]).toBe(0);
  });
});
