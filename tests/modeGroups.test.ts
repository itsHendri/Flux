import { describe, it, expect } from 'vitest';
import { MODE_GROUPS, groupModes, modeOrder } from '../src/ui/modeGroups.ts';

describe('groupModes — the grouped mode picker', () => {
  it('keeps the table order within and across groups', () => {
    const groups = groupModes(['magneto', 'bars', 'reaction', 'waveform']);
    expect(groups).toEqual([
      { label: 'signal', modes: ['bars', 'waveform'] },
      { label: 'simulations', modes: ['reaction'] },
      { label: 'particles', modes: ['magneto'] },
    ]);
  });

  it('drops modes that did not register, and groups left empty', () => {
    const groups = groupModes(['bars']);
    expect(groups.map((g) => g.label)).toEqual(['signal']);
  });

  it('puts unknown modes in a trailing "other" group rather than losing them', () => {
    const groups = groupModes(['bars', 'mystery']);
    expect(groups.at(-1)).toEqual({ label: 'other', modes: ['mystery'] });
  });

  it('never lists a mode twice', () => {
    const groups = groupModes(['bars'], [
      { label: 'a', modes: ['bars'] },
      { label: 'b', modes: ['bars'] },
    ]);
    expect(modeOrder(groups)).toEqual(['bars']);
  });

  it('the cycler order is the picker read top to bottom', () => {
    const all = MODE_GROUPS.flatMap((g) => g.modes);
    expect(modeOrder(groupModes(all))).toEqual(all);
  });

  it('places every mode that ships today', () => {
    const shipped = [
      'bars', 'waveform', 'raymarch', 'flow', 'cells', 'mandala', 'sand', 'bulb',
      'lattice', 'chrome', 'fur', 'logo', 'reaction', 'fluid', 'spectro', 'magneto',
      'trails3d',
    ];
    const groups = groupModes(shipped);
    expect(groups.some((g) => g.label === 'other')).toBe(false);
    expect(modeOrder(groups).sort()).toEqual([...shipped].sort());
  });
});
