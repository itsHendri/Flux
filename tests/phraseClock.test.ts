import { describe, it, expect } from 'vitest';
import { PhraseClock, foldPeriod } from '../src/audio/PhraseClock.ts';

const FPS = 60;

/** A decaying kick pulse like AudioFrame.beat, a kick every `every` seconds. */
function beatAt(t: number, every: number, from = 0): number {
  if (t < from) return 0;
  const since = (t - from) % every;
  return Math.exp(-since / 0.08);
}

/** Run the clock; return boundary times. */
function run(
  clock: PhraseClock,
  seconds: number,
  beat: (t: number) => number,
  level: (t: number) => number,
  bars = 8,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < seconds * FPS; i++) {
    const t = i / FPS;
    if (clock.update(t, beat(t), level(t), bars)) out.push(t);
  }
  return out;
}

describe('PhraseClock — tempo', () => {
  it('reads a 120 bpm four-on-the-floor as 120', () => {
    const c = new PhraseClock();
    run(c, 20, (t) => beatAt(t, 0.5), () => 0.5);
    expect(c.bpm).toBeGreaterThan(117);
    expect(c.bpm).toBeLessThan(123);
  });

  it('reads a half-time kick at the same tempo', () => {
    const c = new PhraseClock();
    run(c, 20, (t) => beatAt(t, 1.0), () => 0.5);
    expect(c.bpm).toBeGreaterThan(117);
    expect(c.bpm).toBeLessThan(123);
  });

  it('folds gaps into 80–160 bpm', () => {
    expect(60 / foldPeriod(1.0)).toBeCloseTo(120);
    expect(60 / foldPeriod(0.25)).toBeCloseTo(120);
    expect(60 / foldPeriod(0.6)).toBeCloseTo(100);
  });
});

describe('PhraseClock — phrases', () => {
  it('ends a phrase every 8 bars at 120 bpm, on a kick', () => {
    const c = new PhraseClock();
    const times = run(c, 70, (t) => beatAt(t, 0.5), () => 0.5);
    // 8 bars at 120 = 16 s. The first phrase is measured on the default tempo
    // (also 120 here), so boundaries land near 16, 32, 48, 64.
    expect(times.length).toBe(4);
    times.forEach((t, i) => expect(Math.abs(t - 16 * (i + 1))).toBeLessThan(0.6));
    // On a kick: within a frame or two of a multiple of 0.5 s.
    for (const t of times) expect(Math.min(t % 0.5, 0.5 - (t % 0.5))).toBeLessThan(0.05);
  });

  it('honours the phrase length', () => {
    const c = new PhraseClock();
    const times = run(c, 40, (t) => beatAt(t, 0.5), () => 0.5, 4);
    expect(times.length).toBe(4); // every 8 s
  });

  it('a drop ends the phrase early', () => {
    const c = new PhraseClock();
    // A quiet build for 12 s, then the drop: level jumps.
    const times = run(c, 14, (t) => beatAt(t, 0.5), (t) => (t < 12 ? 0.12 : 0.7));
    expect(times.length).toBe(1);
    expect(times[0]).toBeGreaterThan(12);
    expect(times[0]).toBeLessThan(13.5);
  });

  it('a breakdown ends the phrase early too', () => {
    const c = new PhraseClock();
    // Full for 10 s, then the drums and most of the energy drop out.
    const times = run(c, 13, (t) => (t < 10 ? beatAt(t, 0.5) : 0), (t) => (t < 10 ? 0.7 : 0.15));
    expect(times.length).toBe(1);
    expect(times[0]).toBeGreaterThan(10);
    expect(times[0]).toBeLessThan(12);
  });

  it('with no kick at all, still ends a bar late', () => {
    const c = new PhraseClock();
    const times = run(c, 20, () => 0, () => 0.4);
    expect(times.length).toBe(1);
    expect(times[0]).toBeCloseTo(18, 0); // 8 bars + 1 at the default 120 bpm
  });

  it('stays quiet in silence', () => {
    const c = new PhraseClock();
    expect(run(c, 60, () => 0, () => 0)).toEqual([]);
  });

  it('restart begins a fresh count', () => {
    const c = new PhraseClock();
    run(c, 10, (t) => beatAt(t, 0.5), () => 0.5);
    c.restart(10);
    expect(c.barsAt(10)).toBe(0);
  });
});
