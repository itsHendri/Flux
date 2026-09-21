/**
 * Settings for playing a set: how modes change, and (with auto looks) when.
 *
 * Kept per machine in localStorage and deliberately *not* controls: controls
 * travel in presets and looks, and a look resets every control to its default,
 * so a look would silently undo how the user wants looks to change.
 */
export interface SetSettings {
  /** Crossfade length in seconds when the mode or look changes; 0 = cut. */
  fade: number;
  /** Change look automatically on phrase boundaries. */
  auto: boolean;
  /** Bars per phrase for auto looks. */
  phraseBars: number;
  /** Auto looks in the listed order, or shuffled without repeats. */
  order: 'sequence' | 'shuffle';
}

export const FADE_OPTIONS = [0, 1, 2, 4];
export const PHRASE_OPTIONS = [4, 8, 16, 32];

export const DEFAULT_SET: SetSettings = { fade: 2, auto: false, phraseBars: 8, order: 'shuffle' };

const KEY = 'flux.set';

/** Anything stored that isn't a valid value falls back to the default. */
export function parseSet(raw: string | null): SetSettings {
  let v: Partial<SetSettings> = {};
  try {
    v = raw ? (JSON.parse(raw) as Partial<SetSettings>) : {};
  } catch {
    v = {};
  }
  return {
    fade: FADE_OPTIONS.includes(v.fade as number) ? (v.fade as number) : DEFAULT_SET.fade,
    auto: typeof v.auto === 'boolean' ? v.auto : DEFAULT_SET.auto,
    phraseBars: PHRASE_OPTIONS.includes(v.phraseBars as number)
      ? (v.phraseBars as number)
      : DEFAULT_SET.phraseBars,
    order: v.order === 'sequence' || v.order === 'shuffle' ? v.order : DEFAULT_SET.order,
  };
}

export function loadSet(storage: Pick<Storage, 'getItem'> | null): SetSettings {
  try {
    return parseSet(storage?.getItem(KEY) ?? null);
  } catch {
    return { ...DEFAULT_SET };
  }
}

export function saveSet(storage: Pick<Storage, 'setItem'> | null, s: SetSettings): void {
  try {
    storage?.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode or blocked storage: the settings just won't persist.
  }
}
