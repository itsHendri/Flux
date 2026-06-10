import { describe, it, expect } from 'vitest';
import type { ControlDef } from '../src/core/state.ts';
import { parseMidi, scaleCc, MidiMap, MidiBindingStore } from '../src/audio/midi.ts';

const DEFS: ControlDef[] = [
  { id: 'gain', name: 'Gain', glslName: 'uGain', min: 0, max: 1, step: 0.01, default: 0.5 },
  { id: 'count', name: 'Count', glslName: 'uCount', min: 8, max: 48, step: 1, default: 28 },
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

describe('parseMidi', () => {
  it('parses a Control Change with its channel', () => {
    expect(parseMidi(new Uint8Array([0xb2, 21, 100]))).toEqual({
      channel: 2,
      controller: 21,
      value: 100,
    });
  });

  it('returns null for non-CC messages and short data', () => {
    expect(parseMidi(new Uint8Array([0x92, 60, 100]))).toBeNull(); // note-on
    expect(parseMidi(new Uint8Array([0xb0, 21]))).toBeNull();
  });
});

describe('scaleCc', () => {
  it('maps 0..127 onto the control range', () => {
    expect(scaleCc(0, DEFS[0])).toBe(0);
    expect(scaleCc(127, DEFS[0])).toBe(1);
    expect(scaleCc(127, DEFS[1])).toBe(48);
  });

  it('snaps to the control step', () => {
    expect(scaleCc(64, DEFS[1]) % 1).toBe(0); // integer step
  });
});

describe('MidiMap', () => {
  it('learns the next CC and routes subsequent events', () => {
    const map = new MidiMap(DEFS);
    map.learn('gain');
    const first = map.feed({ channel: 0, controller: 21, value: 127 });
    expect(first).toEqual({ controlId: 'gain', glslName: 'uGain', value: 1 });
    expect(map.armedControl).toBeNull();
    expect(map.feed({ channel: 0, controller: 21, value: 0 })?.value).toBe(0);
  });

  it('ignores unbound CCs and rebinding replaces both sides', () => {
    const map = new MidiMap(DEFS);
    expect(map.feed({ channel: 0, controller: 9, value: 50 })).toBeNull();
    map.learn('gain');
    map.feed({ channel: 0, controller: 21, value: 1 });
    map.learn('count'); // same CC now binds count, releasing gain
    map.feed({ channel: 0, controller: 21, value: 1 });
    expect(map.all).toEqual([{ controlId: 'count', channel: 0, controller: 21 }]);
  });

  it('unbind removes a control binding; setAll drops unknown ids', () => {
    const map = new MidiMap(DEFS);
    map.setAll([
      { controlId: 'gain', channel: 0, controller: 1 },
      { controlId: 'ghost', channel: 0, controller: 2 },
    ]);
    expect(map.all.map((b) => b.controlId)).toEqual(['gain']);
    map.unbind('gain');
    expect(map.all).toEqual([]);
  });
});

describe('MidiBindingStore', () => {
  it('round-trips bindings and degrades corrupt JSON to empty', () => {
    const storage = fakeStorage();
    const store = new MidiBindingStore(storage);
    store.save([{ controlId: 'gain', channel: 0, controller: 21 }]);
    expect(store.load()).toEqual([{ controlId: 'gain', channel: 0, controller: 21 }]);
    storage.setItem('flux.midi.v1', '][');
    expect(store.load()).toEqual([]);
  });
});
