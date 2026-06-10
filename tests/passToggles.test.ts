import { describe, it, expect } from 'vitest';
import { passToggleDefs, passToggleUniform } from '../src/core/state.ts';

describe('pass toggle controls', () => {
  it('maps pass names to uFx* uniform names', () => {
    expect(passToggleUniform('trails')).toBe('uFxTrails');
    expect(passToggleUniform('bloom')).toBe('uFxBloom');
  });

  it('generates one toggle def per pass, default off', () => {
    const defs = passToggleDefs(['trails', 'dither']);
    expect(defs).toEqual([
      { id: 'fx-trails', name: 'trails', glslName: 'uFxTrails', type: 'toggle', default: false },
      { id: 'fx-dither', name: 'dither', glslName: 'uFxDither', type: 'toggle', default: false },
    ]);
  });
});
