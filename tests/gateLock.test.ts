import { describe, it, expect } from 'vitest';
import { beatCorrection, gatesPerBeat } from '../src/modes2d/gateLock.ts';

describe('gate on the beat', () => {
  it('maps Speed to whole gates per beat', () => {
    expect(gatesPerBeat(0.3)).toBe(0.5);
    expect(gatesPerBeat(1)).toBe(1);
    expect(gatesPerBeat(2.5)).toBe(2);
  });

  /** Fly `seconds` at `bpm`; return the final cycle error and the slowest step. */
  function fly(perBeat: number, seconds: number, start: number) {
    const spacing = 3;
    const bpm = 120;
    const dt = 1 / 60;
    const speed = (perBeat * spacing * bpm) / 60;
    let travel = start;
    let beatInBar = 0;
    let slowest = Infinity;
    for (let i = 0; i < seconds * 60; i++) {
      const step = dt * speed;
      const move = step + beatCorrection(travel, spacing, beatInBar, perBeat, step);
      slowest = Math.min(slowest, move);
      travel += move;
      beatInBar = (beatInBar + (dt * bpm) / 60) % 4;
    }
    const cycle = beatInBar * perBeat;
    let diff = ((travel / spacing) % 1) - (cycle - Math.floor(cycle));
    diff -= Math.round(diff);
    return { diff: Math.abs(diff), slowest, step: dt * speed };
  }

  it('steers the flight so the camera crosses a gate on each beat', () => {
    const r = fly(1, 8, 1.3); // start 43% out of phase
    expect(r.diff).toBeLessThan(0.01);
  });

  it('works at half rate — a gate every other beat — without stalling', () => {
    const r = fly(0.5, 8, 1.3);
    expect(r.diff).toBeLessThan(0.01);
    // Never stops or reverses: every frame still moves at least 40% of a step.
    expect(r.slowest).toBeGreaterThan(r.step * 0.39);
  });

  it('and at double rate', () => {
    expect(fly(2, 8, 1.3).diff).toBeLessThan(0.01);
  });

  it('takes the short way round', () => {
    // Just past a gate but wanting to be just before one: a step back.
    const c = beatCorrection(0.05 * 3, 3, 0.97, 1, 1);
    expect(c).toBeLessThan(0);
  });
});
