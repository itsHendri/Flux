import { describe, it, expect } from 'vitest';
import { RD_PATTERNS, patternOptions, patternValues } from '../src/modes2d/patterns.ts';
import { CONTROLS } from '../src/ui/controls.ts';

const byId = new Map(CONTROLS.map((c) => [c.id, c]));

describe('reaction patterns', () => {
  it('sit inside the Feed and Kill slider ranges, so the sliders can follow', () => {
    const feed = byId.get('rdFeed')!;
    const kill = byId.get('rdKill')!;
    for (const p of RD_PATTERNS) {
      expect(p.feed, p.name).toBeGreaterThanOrEqual(feed.min!);
      expect(p.feed, p.name).toBeLessThanOrEqual(feed.max!);
      expect(p.kill, p.name).toBeGreaterThanOrEqual(kill.min!);
      expect(p.kill, p.name).toBeLessThanOrEqual(kill.max!);
    }
  });

  it('match the slider defaults for the default pattern', () => {
    // Otherwise resetting to defaults fires the pattern listener and moves
    // the sliders away from the values the schema just set.
    const def = patternValues(byId.get('rdPattern')!.default as number);
    expect(def.uRdFeed).toBe(byId.get('rdFeed')!.default);
    expect(def.uRdKill).toBe(byId.get('rdKill')!.default);
  });

  it('is declared before Feed and Kill, so a preset´s tuned values win', () => {
    const order = CONTROLS.map((c) => c.id);
    expect(order.indexOf('rdPattern')).toBeLessThan(order.indexOf('rdFeed'));
    expect(order.indexOf('rdPattern')).toBeLessThan(order.indexOf('rdKill'));
  });

  it('numbers options by index and clamps bad ones', () => {
    expect(patternOptions().map((o) => o.value)).toEqual(RD_PATTERNS.map((_, i) => i));
    expect(patternValues(42)).toEqual(patternValues(0));
  });
});
