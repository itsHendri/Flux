import type { ControlDef } from '../core/state.ts';

/**
 * Presets — a saved snapshot of the live state: the active mode plus every
 * control value (including the uFx* pass toggles, which live in the same
 * store since the toggle unification). Values are keyed by `ControlDef.id`,
 * the stable contract — uniform names may be refactored, ids must not be.
 */
export interface Preset {
  mode: string;
  /** ControlDef.id → value (number, or [r,g,b] for color controls). */
  values: Record<string, number | number[]>;
}

/** Snapshot the live store (keyed by glslName) into a Preset (keyed by id). */
export function snapshotPreset(
  mode: string,
  defs: ControlDef[],
  live: Record<string, number | number[]>,
): Preset {
  const values: Record<string, number | number[]> = {};
  for (const def of defs) {
    const v = live[def.glslName];
    if (v === undefined) continue;
    values[def.id] = Array.isArray(v) ? v.slice() : v;
  }
  return { mode, values };
}

/**
 * Resolve a Preset back to live values keyed by glslName. Ids that no longer
 * exist in the schema are ignored; controls missing from the preset keep
 * their current value (they're simply absent from the result).
 */
export function resolvePreset(
  preset: Preset,
  defs: ControlDef[],
): Record<string, number | number[]> {
  const byId = new Map(defs.map((d) => [d.id, d]));
  const out: Record<string, number | number[]> = {};
  for (const [id, v] of Object.entries(preset.values)) {
    const def = byId.get(id);
    if (!def) continue;
    out[def.glslName] = Array.isArray(v) ? v.slice() : v;
  }
  return out;
}

/**
 * Named presets in a Storage (localStorage in the app, a stub in tests),
 * one JSON document under a single key. Corrupt JSON degrades to empty.
 */
export class PresetStore {
  constructor(
    private readonly storage: Storage,
    private readonly key = 'flux.presets.v1',
  ) {}

  private read(): Record<string, Preset> {
    try {
      const raw = this.storage.getItem(this.key);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, Preset>) : {};
    } catch {
      return {};
    }
  }

  private write(all: Record<string, Preset>): void {
    this.storage.setItem(this.key, JSON.stringify(all));
  }

  list(): string[] {
    return Object.keys(this.read()).sort();
  }

  save(name: string, preset: Preset): void {
    const all = this.read();
    all[name] = preset;
    this.write(all);
  }

  load(name: string): Preset | null {
    return this.read()[name] ?? null;
  }

  remove(name: string): void {
    const all = this.read();
    delete all[name];
    this.write(all);
  }
}
