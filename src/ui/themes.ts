import type { ControlDef, SelectOption } from '../core/state.ts';

/**
 * Global colour themes.
 *
 * Every mode invents its own colour (cosine palettes, hsv ramps, hand-picked
 * constants), which is why FLUX has always looked like eight instruments
 * rather than one. A theme is three stops that modes route their own colour
 * through — see `themed()` in `common.glsl`, which keeps each mode's
 * luminance and takes only the hue from the theme, so structure and contrast
 * survive the re-tint.
 *
 * The table lives here, in TypeScript, because two places need it: the
 * uniforms uploaded to the shaders, and the swatches in the UI.
 */
export interface Theme {
  /** Stable id (never serialised on its own — the index is what presets hold). */
  id: string;
  name: string;
  /** Three stops, cycling A → B → C → A. `[r, g, b]` in 0..1. */
  colors: [RGB, RGB, RGB];
}

export type RGB = [number, number, number];

/** "#rrggbb" → [r,g,b] in 0..1 — the table is easier to read as hex. */
function rgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * Five, mapped to the `1`–`5` keys. Ultra is first because it's closest to
 * what FLUX already looked like, so the default install doesn't lurch.
 */
export const THEMES: Theme[] = [
  { id: 'ultra', name: 'Ultra', colors: [rgb('#6a2bff'), rgb('#ff2fb0'), rgb('#2ff5ff')] },
  { id: 'ember', name: 'Ember', colors: [rgb('#ff3b1f'), rgb('#ff9e2c'), rgb('#ffe27a')] },
  { id: 'ice', name: 'Ice', colors: [rgb('#2a6bff'), rgb('#35d0ff'), rgb('#c8f6ff')] },
  { id: 'acid', name: 'Acid', colors: [rgb('#ff2fd0'), rgb('#9dff2f'), rgb('#fff62f')] },
  { id: 'mono', name: 'Mono', colors: [rgb('#7d838f'), rgb('#c7ccd6'), rgb('#ffffff')] },
];

/** Theme options for the `select` control — the value is the index. */
export function themeOptions(): SelectOption[] {
  return THEMES.map((t, i) => ({ label: t.name, value: i }));
}

/** Clamp an arbitrary stored value to a real theme (presets outlive tables). */
export function themeAt(index: number): Theme {
  const i = Math.round(index);
  return THEMES[i] ?? THEMES[0];
}

/**
 * The three colour uniforms the theme drives. They carry no widget of their
 * own — the Theme selector writes them — but they live in the same control
 * store as everything else, so they're declared, uploaded and serialised into
 * presets like any other control. A preset therefore restores the colours it
 * was saved with even if this table later changes.
 */
export const THEME_COLOR_CONTROLS: ControlDef[] = ['A', 'B', 'C'].map((stop, i) => ({
  id: `theme${stop}`,
  name: `Theme ${stop}`,
  glslName: `uTheme${stop}`,
  type: 'color' as const,
  default: THEMES[0].colors[i],
}));

/** glslName → colour, for the selected theme. Feeds `applyValues`. */
export function themeValues(index: number): Record<string, number[]> {
  const theme = themeAt(index);
  const out: Record<string, number[]> = {};
  THEME_COLOR_CONTROLS.forEach((def, i) => {
    out[def.glslName] = theme.colors[i].slice();
  });
  return out;
}
