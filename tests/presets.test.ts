import { describe, it, expect } from 'vitest';
import type { ControlDef } from '../src/core/state.ts';
import { snapshotPreset, resolvePreset, PresetStore } from '../src/presets/presets.ts';

const DEFS: ControlDef[] = [
  { id: 'gain', name: 'Gain', glslName: 'uGain', default: 0.5 },
  { id: 'tint', name: 'Tint', glslName: 'uTint', type: 'color', default: [1, 1, 1] },
  { id: 'fx-bloom', name: 'bloom', glslName: 'uFxBloom', type: 'toggle', default: false },
];

function fakeStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
    key: (i) => [...data.keys()][i] ?? null,
  };
}

describe('presets', () => {
  it('round-trips mode + controls + pass toggles through id keys', () => {
    const live = { uGain: 0.8, uTint: [0.2, 0.4, 0.6], uFxBloom: 1 };
    const preset = snapshotPreset('cells', DEFS, live);
    expect(preset).toEqual({
      mode: 'cells',
      values: { gain: 0.8, tint: [0.2, 0.4, 0.6], 'fx-bloom': 1 },
    });
    expect(resolvePreset(preset, DEFS)).toEqual(live);
  });

  it('ignores preset ids that no longer exist in the schema', () => {
    const preset = { mode: 'bars', values: { gain: 0.3, removedControl: 9 } };
    expect(resolvePreset(preset, DEFS)).toEqual({ uGain: 0.3 });
  });

  it('snapshot copies color arrays instead of referencing the live store', () => {
    const live = { uTint: [0.1, 0.2, 0.3] };
    const preset = snapshotPreset('bars', DEFS, live);
    (live.uTint as number[])[0] = 0.9;
    expect(preset.values.tint).toEqual([0.1, 0.2, 0.3]);
  });

  it('PresetStore saves, lists, loads, and removes', () => {
    const store = new PresetStore(fakeStorage());
    expect(store.list()).toEqual([]);
    store.save('club', { mode: 'cells', values: { gain: 1 } });
    store.save('ambient', { mode: 'flow', values: { gain: 0.2 } });
    expect(store.list()).toEqual(['ambient', 'club']);
    expect(store.load('club')).toEqual({ mode: 'cells', values: { gain: 1 } });
    store.remove('club');
    expect(store.list()).toEqual(['ambient']);
    expect(store.load('club')).toBeNull();
  });

  it('PresetStore degrades corrupt JSON to empty', () => {
    const storage = fakeStorage();
    storage.setItem('flux.presets.v1', '{not json');
    const store = new PresetStore(storage);
    expect(store.list()).toEqual([]);
  });
});
