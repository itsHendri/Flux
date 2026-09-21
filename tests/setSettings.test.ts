import { describe, it, expect } from 'vitest';
import { DEFAULT_SET, loadSet, parseSet, saveSet } from '../src/ui/setSettings.ts';

describe('set settings', () => {
  it('defaults when nothing is stored', () => {
    expect(parseSet(null)).toEqual(DEFAULT_SET);
  });

  it('round-trips through storage', () => {
    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
    const s = { fade: 4, auto: true, phraseBars: 16, order: 'sequence' as const };
    saveSet(storage, s);
    expect(loadSet(storage)).toEqual(s);
  });

  it('replaces anything invalid with the default, field by field', () => {
    expect(parseSet('{"fade": 3, "auto": "yes", "phraseBars": 16, "order": "random"}')).toEqual({
      ...DEFAULT_SET,
      phraseBars: 16,
    });
    expect(parseSet('not json')).toEqual(DEFAULT_SET);
  });

  it('survives storage that throws', () => {
    const bad = { getItem: () => { throw new Error('blocked'); } };
    expect(loadSet(bad)).toEqual(DEFAULT_SET);
  });
});
