import { describe, it, expect } from 'vitest';
import {
  FrameGovernor,
  QualityGovernor,
  qualityLadder,
  type QualityHost,
} from '../src/core/governor.ts';

/** Feed `seconds` of frames at `fps`; return every step taken. */
function run(g: FrameGovernor, fps: number, seconds: number, canUp = true, canDown = true): number[] {
  const steps: number[] = [];
  const dt = 1 / fps;
  for (let t = 0; t < seconds; t += dt) {
    const s = g.update(dt, canUp, canDown);
    if (s !== 0) steps.push(s);
  }
  return steps;
}

describe('FrameGovernor — when to step', () => {
  it('steps down within ~2 s of a machine falling behind', () => {
    const g = new FrameGovernor();
    const dt = 1 / 30;
    let t = 0;
    let when = -1;
    for (; t < 5 && when < 0; t += dt) if (g.update(dt, true, true) === -1) when = t;
    expect(when).toBeGreaterThan(0);
    expect(when).toBeLessThan(2.5);
  });

  it('holds at a healthy frame rate, 60 Hz or 120 Hz', () => {
    expect(run(new FrameGovernor(), 60, 20, false, true)).toEqual([]);
    expect(run(new FrameGovernor(), 120, 20, false, true)).toEqual([]);
  });

  it('probes back up once frames have been good for a while', () => {
    const g = new FrameGovernor();
    expect(run(g, 60, 4.5, true, true)).toEqual([]);
    expect(run(g, 60, 2, true, true)).toEqual([1]);
  });

  it('ignores hitches: one long frame is not a slow machine', () => {
    const g = new FrameGovernor();
    run(g, 60, 3, false, true);
    expect(g.update(0.5, false, true)).toBe(0);
    expect(run(g, 60, 3, false, true)).toEqual([]);
  });

  it('backs off after failed probes, so a machine at the edge settles', () => {
    // A machine that manages 60 fps one rung down and 40 fps at the top.
    const g = new FrameGovernor();
    let rung = 1; // start one rung down, where it copes
    const steps: number[] = [];
    const dt = 1 / 60;
    for (let t = 0; t < 180; t += dt) {
      const frame = rung === 0 ? 1 / 40 : 1 / 60;
      const s = g.update(frame, rung > 0, rung < 1);
      if (s !== 0) {
        steps.push(s);
        rung -= s;
      }
    }
    // Up/down pairs happen, but ever more rarely: over three minutes, far
    // fewer than the ~26 a fixed 5 s probe would make.
    expect(steps.length).toBeLessThan(12);
    expect(g.upWait).toBeGreaterThan(5);
  });
});

describe('FrameGovernor — the machines it must not misread', () => {
  it('a machine managing 3 fps still gets stepped down', () => {
    // Every frame is over the hitch limit; one would be a hitch, a run isn't.
    const g = new FrameGovernor();
    const steps: number[] = [];
    for (let i = 0; i < 40 && steps.length === 0; i++) {
      const s = g.update(1 / 3, false, true);
      if (s !== 0) steps.push(s);
    }
    expect(steps).toEqual([-1]);
  });

  it('a 30 Hz cap is learned, not chased to the bottom rung', () => {
    // Frames are 33 ms whatever the rung: stepping down buys nothing.
    const g = new FrameGovernor();
    let rung = 0;
    const steps: number[] = [];
    for (let t = 0; t < 60; t += 1 / 30) {
      const s = g.update(1 / 30, rung > 0, rung < 3);
      if (s !== 0) {
        steps.push(s);
        rung -= s;
      }
    }
    // One step down, judged useless and undone — then it holds.
    expect(steps).toEqual([-1, 1]);
    expect(rung).toBe(0);
    expect(g.capFloor).toBeCloseTo(1 / 30, 3);
  });

  it('forgets the cap when frames get well under it', () => {
    const g = new FrameGovernor();
    let rung = 0;
    for (let t = 0; t < 20; t += 1 / 30) {
      const s = g.update(1 / 30, rung > 0, rung < 3);
      rung -= s;
    }
    expect(g.capFloor).toBeGreaterThan(0);
    run(g, 60, 3, false, false);
    expect(g.capFloor).toBe(0);
  });

  it('a new mode starts with a fresh probe wait', () => {
    const g = new FrameGovernor();
    let rung = 1;
    for (let t = 0; t < 120; t += 1 / 60) {
      const s = g.update(rung === 0 ? 1 / 40 : 1 / 60, rung > 0, rung < 1);
      rung -= s;
    }
    expect(g.upWait).toBeGreaterThan(5);
    g.resetForMode();
    expect(g.upWait).toBe(5);
  });
});

describe('qualityLadder', () => {
  it('with scaleFirst, spends the resolution before touching the lever', () => {
    expect(qualityLadder([0, 1, 2], 2, true)).toEqual([
      { quality: 2, scale: 1 },
      { quality: 2, scale: 0.75 },
      { quality: 2, scale: 0.5 },
      { quality: 1, scale: 0.5 },
      { quality: 0, scale: 0.5 },
    ]);
  });

  it('starts at the user’s own value and only ever goes down', () => {
    expect(qualityLadder([0, 1, 2], 1)).toEqual([
      { quality: 1, scale: 1 },
      { quality: 0, scale: 1 },
      { quality: 0, scale: 0.75 },
      { quality: 0, scale: 0.5 },
    ]);
  });

  it('keeps an off-list user value as the top rung', () => {
    expect(qualityLadder([256, 384], 300)[0]).toEqual({ quality: 300, scale: 1 });
  });

  it('is just render scales for a mode with no lever', () => {
    expect(qualityLadder(null, null).map((r) => r.scale)).toEqual([1, 0.75, 0.5]);
  });
});

describe('QualityGovernor — the lever', () => {
  function host(options = [0, 1, 2]) {
    const values: Record<string, number> = { uQ: 2 };
    let scale = 1;
    const h: QualityHost = {
      leverFor: (mode) => (mode === 'heavy' ? { glslName: 'uQ', options } : null),
      getValue: (n) => values[n],
      setValue: (n, v) => {
        values[n] = v;
        gov.onLeverChanged(n, v); // the panel's listener fires on every write
      },
      setRenderScale: (s) => (scale = s),
    };
    const gov = new QualityGovernor(h);
    return { gov, values, scale: () => scale };
  }
  /** A machine that gets ~15% faster per rung: 30 fps at the top, 60 by rung 4. */
  const machine = (level: number) => Math.max(1 / 60, (1 / 30) * Math.pow(0.85, level));
  const slow = (gov: QualityGovernor, seconds: number) => {
    for (let t = 0; t < seconds; ) {
      const dt = machine(gov.level);
      gov.frame(dt);
      t += dt;
    }
  };

  it('steps the mode’s own quality down first, then the render scale', () => {
    const { gov, values, scale } = host();
    gov.setMode('heavy');
    slow(gov, 2.5);
    expect(values.uQ).toBe(1);
    expect(scale()).toBe(1);
    slow(gov, 8);
    expect(values.uQ).toBe(0);
    expect(scale()).toBeLessThan(1);
  });

  it('spends the resolution first for a lever that would wipe a simulation', () => {
    const values: Record<string, number> = { uQ: 2 };
    let scale = 1;
    const gov = new QualityGovernor({
      leverFor: () => ({ glslName: 'uQ', options: [0, 1, 2], scaleFirst: true }),
      getValue: (n) => values[n],
      setValue: (n, v) => (values[n] = v),
      setRenderScale: (s) => (scale = s),
    });
    gov.setMode('sim');
    slow(gov, 2.5);
    expect(scale).toBe(0.75);
    expect(values.uQ).toBe(2); // the pattern survives the first steps
  });

  it('a user change becomes the new ceiling and restarts from the top', () => {
    const { gov, values } = host();
    gov.setMode('heavy');
    slow(gov, 2.5);
    expect(values.uQ).toBe(1);
    gov.onLeverChanged('uQ', 0); // the user picks Draft themselves
    expect(gov.level).toBe(0);
    expect(gov.current.quality).toBe(0);
  });

  it('leaving a mode gives its lever back at the user’s setting', () => {
    const { gov, values, scale } = host();
    gov.setMode('heavy');
    slow(gov, 8);
    gov.setMode('light');
    expect(values.uQ).toBe(2);
    expect(scale()).toBe(1);
  });

  it('pinned (Auto Quality off) restores and stops', () => {
    const { gov, values } = host();
    gov.setMode('heavy');
    slow(gov, 2.5);
    gov.setEnabled(false);
    expect(values.uQ).toBe(2);
    slow(gov, 10);
    expect(values.uQ).toBe(2);
  });

  it('saves the user’s value in a preset, not the stepped-down one', () => {
    const { gov, values } = host();
    gov.setMode('heavy');
    slow(gov, 2.5);
    expect(gov.userValues({ ...values }).uQ).toBe(2);
  });
});
