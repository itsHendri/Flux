import { describe, it, expect } from 'vitest';
import {
  THEMES,
  THEME_COLOR_CONTROLS,
  themeAt,
  themeOptions,
  themeValues,
} from '../src/ui/themes.ts';
import { snapshotPreset, resolvePreset } from '../src/presets/presets.ts';
import { CONTROLS } from '../src/ui/controls.ts';

describe('the theme table', () => {
  it('has five themes with unique ids and three colours each', () => {
    expect(THEMES).toHaveLength(5); // the 1-5 keys
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(5);
    for (const theme of THEMES) {
      expect(theme.colors).toHaveLength(3);
      for (const c of theme.colors) {
        expect(c).toHaveLength(3);
        for (const ch of c) expect(ch).toBeGreaterThanOrEqual(0);
        for (const ch of c) expect(ch).toBeLessThanOrEqual(1);
      }
    }
  });

  it('numbers the select options by index, so key N picks theme N', () => {
    expect(themeOptions().map((o) => o.value)).toEqual([0, 1, 2, 3, 4]);
    expect(themeOptions()[0].label).toBe(THEMES[0].name);
  });

  it('clamps an out-of-range index rather than rendering undefined colours', () => {
    expect(themeAt(99).id).toBe(THEMES[0].id);
    expect(themeAt(-1).id).toBe(THEMES[0].id);
    expect(themeAt(1.4).id).toBe(THEMES[1].id);
  });
});

describe('themeValues', () => {
  it('maps the selected theme onto the three colour uniforms', () => {
    const values = themeValues(2);
    expect(Object.keys(values)).toEqual(['uThemeA', 'uThemeB', 'uThemeC']);
    expect(values.uThemeA).toEqual(THEMES[2].colors[0]);
    expect(values.uThemeC).toEqual(THEMES[2].colors[2]);
  });

  it('hands out copies — a caller mutating them can not edit the table', () => {
    const values = themeValues(0);
    (values.uThemeA as number[])[0] = 0.123;
    expect(THEMES[0].colors[0][0]).not.toBe(0.123);
  });
});

describe('a theme in a preset', () => {
  const defs = [...CONTROLS, ...THEME_COLOR_CONTROLS];

  it('round-trips the selection and the colours it was saved with', () => {
    const live: Record<string, number | number[]> = {
      uTheme: 3,
      uThemeMix: 0.8,
      ...themeValues(3),
    };
    const preset = snapshotPreset('cells', defs, live);
    expect(preset.values.theme).toBe(3);
    expect(preset.values.themeA).toEqual(THEMES[3].colors[0]);

    const resolved = resolvePreset(preset, defs);
    expect(resolved.uTheme).toBe(3);
    expect(resolved.uThemeMix).toBe(0.8);
    expect(resolved.uThemeC).toEqual(THEMES[3].colors[2]);
  });
});
