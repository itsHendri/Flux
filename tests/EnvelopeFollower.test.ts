import { describe, it, expect } from 'vitest';
import { EnvelopeFollower } from '../src/audio/EnvelopeFollower.ts';

const DT = 1 / 60; // a typical 60fps frame

describe('EnvelopeFollower', () => {
  it('starts at zero', () => {
    expect(new EnvelopeFollower().current).toBe(0);
  });

  it('rises toward a target but never overshoots in one step', () => {
    const env = new EnvelopeFollower();
    const v = env.update(1, DT);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(1);
  });

  it('converges to the target after enough time', () => {
    const env = new EnvelopeFollower();
    for (let i = 0; i < 600; i++) env.update(1, DT); // ~10s
    expect(env.current).toBeGreaterThan(0.99);
  });

  it('attacks faster than it releases (the musical asymmetry)', () => {
    // Same dt, same distance travelled: rising one step should cover more
    // ground than falling one step, because attack < release.
    const rising = new EnvelopeFollower();
    const riseStep = rising.update(1, DT); // 0 -> toward 1

    const falling = new EnvelopeFollower();
    // Seed it near 1, then release toward 0 and measure the drop.
    for (let i = 0; i < 600; i++) falling.update(1, DT);
    const before = falling.current;
    const after = falling.update(0, DT);
    const fallStep = before - after;

    expect(riseStep).toBeGreaterThan(fallStep);
  });

  it('is frame-rate independent: one big step ≈ many small steps', () => {
    const coarse = new EnvelopeFollower();
    coarse.update(1, 0.1);

    const fine = new EnvelopeFollower();
    for (let i = 0; i < 100; i++) fine.update(1, 0.001); // same 0.1s total

    expect(Math.abs(coarse.current - fine.current)).toBeLessThan(0.02);
  });

  it('clamps absurdly large dt so a stalled tab cannot snap instantly', () => {
    const env = new EnvelopeFollower();
    const v = env.update(1, 1000); // 1000s — dt is clamped internally to 0.1
    expect(v).toBeLessThan(1); // would be ~1 without the clamp
  });

  it('reset returns to zero', () => {
    const env = new EnvelopeFollower();
    env.update(1, DT);
    env.reset();
    expect(env.current).toBe(0);
  });
});
