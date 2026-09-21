import { describe, it, expect } from 'vitest';
import { beatCorrection, gatesPerBeat } from '../src/modes2d/gateLock.ts';

describe('gate on the beat', () => {
  it('maps Speed to whole gates per beat', () => {
    expect(gatesPerBeat(0.3)).toBe(0.5);
    expect(gatesPerBeat(1)).toBe(1);
    expect(gatesPerBeat(2.5)).toBe(2);
  });

  it('steers the flight so the camera crosses a gate on each beat', () => {
    // 120 bpm, one gate per beat, spacing 3: start out of phase and fly.
    const spacing = 3;
    const bpm = 120;
    const dt = 1 / 60;
    let travel = 1.3; // 43% of the way between gates
    let phase = 0;
    const speed = (spacing * bpm) / 60;
    for (let i = 0; i < 60 * 6; i++) {
      travel += beatCorrection(travel, spacing, phase, 1, dt);
      travel += dt * speed;
      phase = (phase + (dt * bpm) / 60) % 1;
    }
    // Locked in: the position in the gate cycle equals the beat phase, so the
    // camera is at a gate (0) exactly when the beat phase is 0.
    const off = ((travel / spacing) % 1 + 1) % 1;
    let diff = off - phase;
    diff -= Math.round(diff);
    expect(Math.abs(diff)).toBeLessThan(0.01);
  });

  it('takes the short way round', () => {
    // Just past a gate but wanting to be just before one: a small step back,
    // not most of a spacing forward.
    const c = beatCorrection(0.05 * 3, 3, 0.97, 1, 1);
    expect(c).toBeLessThan(0);
    expect(Math.abs(c)).toBeLessThan(0.3);
  });
});
