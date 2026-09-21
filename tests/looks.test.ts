import { describe, it, expect } from 'vitest';
import { LOOKS, defaultValues, findLook } from '../src/presets/looks.ts';
import { CONTROLS } from '../src/ui/controls.ts';
import { THEME_COLOR_CONTROLS } from '../src/ui/themes.ts';
import { passToggleDefs } from '../src/core/state.ts';
import { PASSES } from '../src/shaders/passes.ts';
import { MODES } from '../src/shaders/modes.ts';
import { ReactionMode } from '../src/modes2d/ReactionMode.ts';
import { FluidMode } from '../src/modes2d/FluidMode.ts';
import { SpectrogramMode } from '../src/modes2d/SpectrogramMode.ts';
import { VectorMode } from '../src/modes2d/VectorMode.ts';
import { MagnetoMode } from '../src/modes3d/MagnetoMode.ts';
import { Trails3DMode } from '../src/modes3d/Trails3DMode.ts';
import { ForgeMode } from '../src/modes3d/ForgeMode.ts';
import { SynapseMode } from '../src/modes3d/SynapseMode.ts';
import { AnemoneMode } from '../src/modes3d/AnemoneMode.ts';
import { GateMode } from '../src/modes2d/GateMode.ts';
import { resolvePreset } from '../src/presets/presets.ts';

const PASS_NAMES = PASSES.map((p) => p.name);
const DEFS = [...CONTROLS, ...passToggleDefs(PASS_NAMES), ...THEME_COLOR_CONTROLS];
const BY_ID = new Map(DEFS.map((d) => [d.id, d]));
// Custom-draw modes aren't in MODES — they register at runtime — so their
// names come from the classes themselves rather than a list that has to be
// remembered every time a mode is added.
const CUSTOM_MODES = [
  new ReactionMode(),
  new FluidMode(),
  new SpectrogramMode(),
  new VectorMode(),
  new MagnetoMode(),
  new Trails3DMode(),
  new ForgeMode(),
  new SynapseMode(),
  new AnemoneMode(),
  new GateMode(),
];
const MODE_NAMES = [...MODES.map((m) => m.name), ...CUSTOM_MODES.map((m) => m.name)];

describe('the built-in looks', () => {
  it('have unique names', () => {
    expect(new Set(LOOKS.map((l) => l.name)).size).toBe(LOOKS.length);
  });

  it('name a mode that exists', () => {
    for (const look of LOOKS) {
      expect(MODE_NAMES, `${look.name} names an unknown mode`).toContain(look.preset.mode);
    }
  });

  // The important one. resolvePreset silently drops ids it doesn't recognise,
  // so a typo wouldn't throw — the look would just quietly come out wrong.
  it('only reference control ids that exist', () => {
    for (const look of LOOKS) {
      for (const id of Object.keys(look.preset.values)) {
        expect(BY_ID.has(id), `look "${look.name}" references unknown control "${id}"`).toBe(true);
      }
    }
  });

  it('stay inside each control´s range and options', () => {
    for (const look of LOOKS) {
      for (const [id, value] of Object.entries(look.preset.values)) {
        const def = BY_ID.get(id);
        if (!def || typeof value !== 'number') continue;
        const type = def.type ?? 'slider';
        if (type === 'select') {
          const allowed = (def.options ?? []).map((o) => o.value);
          expect(allowed, `${look.name}.${id}`).toContain(value);
        } else if (type === 'toggle') {
          expect([0, 1], `${look.name}.${id}`).toContain(value);
        } else {
          expect(value, `${look.name}.${id} below min`).toBeGreaterThanOrEqual(def.min ?? 0);
          expect(value, `${look.name}.${id} above max`).toBeLessThanOrEqual(def.max ?? 1);
        }
      }
    }
  });

  it('each switch on at least one effect', () => {
    for (const look of LOOKS) {
      const on = Object.entries(look.preset.values).filter(
        ([id, v]) => id.startsWith('fx-') && v === 1,
      );
      expect(on.length, `${look.name} enables no effects`).toBeGreaterThan(0);
    }
  });

  it('resolve to live uniform names', () => {
    const resolved = resolvePreset(LOOKS[0].preset, DEFS);
    expect(resolved.uTheme).toBe(0);
    expect(resolved.uFxKaleido).toBe(1);
  });

  it('are findable by name', () => {
    expect(findLook('cathedral')?.preset.mode).toBe('flow');
    expect(findLook('nope')).toBeNull();
  });
});

describe('defaultValues', () => {
  it('covers every control, keyed by uniform name', () => {
    const d = defaultValues(DEFS);
    expect(Object.keys(d).length).toBe(DEFS.length);
    expect(d.uGain).toBe(0.5);
    expect(d.uFxWarp).toBe(0); // toggles default off
    expect(Array.isArray(d.uThemeA)).toBe(true);
  });

  it('hands back copies of colour values', () => {
    const d = defaultValues(DEFS);
    (d.uThemeA as number[])[0] = 0.5;
    expect((defaultValues(DEFS).uThemeA as number[])[0]).not.toBe(0.5);
  });
});
