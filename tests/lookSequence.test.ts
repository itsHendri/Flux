import { describe, it, expect } from 'vitest';
import { LookSequence } from '../src/presets/lookSequence.ts';

const NAMES = ['a', 'b', 'c', 'd', 'e'];

describe('LookSequence', () => {
  it('in order: the next one, wrapping', () => {
    const s = new LookSequence(NAMES);
    expect(s.next('b', 'sequence')).toBe('c');
    expect(s.next('e', 'sequence')).toBe('a');
    expect(s.next(null, 'sequence')).toBe('a');
  });

  it('shuffled: every look once before any repeats, never the one showing', () => {
    const s = new LookSequence(NAMES);
    let current = 'a';
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      const n = s.next(current, 'shuffle');
      expect(n).not.toBe(current);
      seen.push(n);
      current = n;
    }
    expect(new Set(seen)).toEqual(new Set(['b', 'c', 'd', 'e']));
  });

  it('shuffled over a long run never repeats back to back', () => {
    const s = new LookSequence(NAMES);
    let current: string | null = null;
    for (let i = 0; i < 200; i++) {
      const n = s.next(current, 'shuffle');
      expect(n).not.toBe(current);
      current = n;
    }
  });
});
