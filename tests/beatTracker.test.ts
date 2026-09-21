import { describe, it, expect } from 'vitest';
import { BeatTracker } from '../src/audio/BeatTracker.ts';

const FPS = 60;
const DT = 1 / FPS;

/** A decaying kick pulse like AudioFrame.beat, kicks at the given times. */
function pulse(t: number, kicks: number[]): number {
  let v = 0;
  for (const k of kicks) if (t >= k && t - k < 0.4) v = Math.max(v, Math.exp(-(t - k) / 0.08));
  return v;
}

function kicksAt(bpm: number, from: number, to: number): number[] {
  const out: number[] = [];
  for (let t = from; t < to; t += 60 / bpm) out.push(t);
  return out;
}

/** Run; record the tracker's beat phase at each kick frame after `checkFrom`. */
function run(tr: BeatTracker, seconds: number, kicks: number[], checkFrom = Infinity): number[] {
  const errs: number[] = [];
  const kickFrames = new Set(kicks.map((k) => Math.ceil(k * FPS)));
  for (let i = 0; i < seconds * FPS; i++) {
    const t = i * DT;
    tr.update(i === 0 ? 0 : DT, pulse(t, kicks));
    if (t >= checkFrom && kickFrames.has(i)) {
      const p = tr.beatPhase;
      errs.push(Math.min(p, 1 - p));
    }
  }
  return errs;
}

describe('BeatTracker', () => {
  it('locks to a 120 bpm kick and sits on the beat', () => {
    const tr = new BeatTracker();
    const kicks = kicksAt(120, 0.3, 20);
    const errs = run(tr, 20, kicks, 6);
    expect(tr.locked).toBe(true);
    expect(tr.bpm).toBeGreaterThan(118);
    expect(tr.bpm).toBeLessThan(122);
    for (const e of errs) expect(e).toBeLessThan(0.06);
  });

  it('keeps time through a fill: phase still lands when the kicks come back', () => {
    const tr = new BeatTracker();
    // 120 bpm, but no kicks from 8 s to 10 s.
    const kicks = kicksAt(120, 0.3, 20).filter((k) => k < 8 || k >= 10);
    const errs = run(tr, 20, kicks, 10);
    expect(tr.locked).toBe(true);
    expect(errs[0]).toBeLessThan(0.08); // the first kick back is on the predicted beat
  });

  it('re-locks after a tempo change', () => {
    const tr = new BeatTracker();
    const kicks = [...kicksAt(120, 0.3, 10), ...kicksAt(128, 10, 30)];
    const errs = run(tr, 30, kicks, 22);
    expect(tr.locked).toBe(true);
    expect(tr.bpm).toBeGreaterThan(126);
    expect(tr.bpm).toBeLessThan(130);
    for (const e of errs) expect(e).toBeLessThan(0.08);
  });

  it('lets go when the kicks stop', () => {
    const tr = new BeatTracker();
    run(tr, 30, kicksAt(120, 0.3, 10));
    expect(tr.locked).toBe(false);
  });

  it('never locks without kicks', () => {
    const tr = new BeatTracker();
    run(tr, 10, []);
    expect(tr.locked).toBe(false);
  });

  it('counts the bar four beats long', () => {
    const tr = new BeatTracker();
    run(tr, 12, kicksAt(120, 0.3, 12));
    const bar = tr.barPhase;
    const beat = tr.beatPhase;
    expect(Math.abs(bar * 4 - Math.floor(bar * 4) - beat)).toBeLessThan(1e-6);
  });
});
