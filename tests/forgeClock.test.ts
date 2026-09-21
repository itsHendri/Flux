import { describe, it, expect } from 'vitest';
import { ForgeClock, FLIGHT_SECONDS, REBUILD_SECONDS } from '../src/modes3d/forgeClock.ts';

describe('ForgeClock — when forge breaks', () => {
  it('builds from nothing on entry: debris first, then the pull ramps to full', () => {
    const c = new ForgeClock();
    c.reset(10);
    expect(c.update(0, 10, 0.5).pull).toBe(0);
    const mid = c.update(0, 10 + (REBUILD_SECONDS - FLIGHT_SECONDS) / 2, 0.5).pull;
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
    expect(c.update(0, 10 + REBUILD_SECONDS, 0.5).pull).toBe(1);
  });

  it('a kick shatters an assembled shape: one impulse, pull back to zero', () => {
    const c = new ForgeClock();
    c.reset(0);
    const hit = c.update(1, 5, 0.5);
    expect(hit.shattered).toBe(true);
    expect(hit.impulse).toBe(1);
    expect(hit.pull).toBe(0);
    expect(c.update(0, 5.01, 0.5).impulse).toBe(0);
  });

  it('will not shatter a shape that is still flying together', () => {
    const c = new ForgeClock();
    c.reset(0);
    c.update(1, 5, 0.5);
    c.update(0, 5.2, 0.5); // re-arm
    expect(c.update(1, 5.5, 0.5).shattered).toBe(false);
  });

  it('needs the detector to re-arm: a held pulse is one shatter, not many', () => {
    const c = new ForgeClock();
    c.reset(0);
    expect(c.update(1, 5, 0.5).shattered).toBe(true);
    // Beat never drops below the re-arm level.
    expect(c.update(0.9, 8, 0.5).shattered).toBe(false);
    c.update(0.1, 8.1, 0.5);
    expect(c.update(0.9, 8.2, 0.5).shattered).toBe(true);
  });

  it('Shatter at 0 never breaks; higher is touchier', () => {
    const c = new ForgeClock();
    c.reset(0);
    expect(c.update(1, 5, 0).shattered).toBe(false);
    const soft = new ForgeClock();
    soft.reset(0);
    expect(soft.update(0.5, 5, 0.3).shattered).toBe(false);
    const touchy = new ForgeClock();
    touchy.reset(0);
    expect(touchy.update(0.5, 5, 0.9).shattered).toBe(true);
  });
});
