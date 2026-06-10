/**
 * A snapshot of analysed audio for one frame. The bands are 0..1, smoothed;
 * `beat`/`onset` are 0..1 decaying pulses from the spectral-flux detectors —
 * 1.0 at a hit (beat = bass-band transient, onset = any transient), decaying
 * exponentially after, rather than continuously tracking energy.
 */
export interface AudioFrame {
  bass: number;
  mid: number;
  high: number;
  level: number;
  beat: number;
  onset: number;
}

export const SILENT_FRAME: AudioFrame = { bass: 0, mid: 0, high: 0, level: 0, beat: 0, onset: 0 };

/**
 * Immutable per-frame state handed from the App orchestrator to the Renderer.
 * The Renderer consumes this and nothing else — it never touches AudioEngine.
 */
export interface FrameState {
  /** Seconds since the app started. */
  time: number;
  /** Seconds since the previous frame. */
  dt: number;
  /** Drawing-buffer size in device pixels. */
  resolution: [number, number];
  audio: AudioFrame;
  /**
   * glslName -> value, derived from the control schema. A number for
   * slider/toggle/select uniforms, an `[r,g,b]` triple for `color` uniforms.
   */
  controls: Record<string, number | number[]>;
  /** Name of the active shader mode. */
  mode: string;
}

/** How a control renders and what GLSL uniform type it drives. */
export type ControlType = 'slider' | 'toggle' | 'select' | 'color';

/** One choice in a `select` control: a label and the float it uploads. */
export interface SelectOption {
  label: string;
  value: number;
}

/**
 * A single user-facing control. Drives one shader uniform.
 *
 * `type` (default `'slider'`) picks the widget and the uniform it feeds:
 * - `slider`  → `float`; uses `min`/`max`/`step`, numeric `default`.
 * - `toggle`  → `float` 0/1; boolean `default`.
 * - `select`  → `float`; one of `options`, numeric `default` (an option value).
 * - `color`   → `vec3`; `[r,g,b]` in 0..1, `[r,g,b]` `default`.
 */
export interface ControlDef {
  /** Stable id, used for presets later. */
  id: string;
  /** Human label shown in the panel. */
  name: string;
  /** Uniform name in GLSL, e.g. "uWarp". */
  glslName: string;
  /** Widget + uniform type. Omitted means `'slider'`. */
  type?: ControlType;
  /** slider only */
  min?: number;
  max?: number;
  step?: number;
  /** select only */
  options?: SelectOption[];
  default: number | boolean | [number, number, number];
  /**
   * Visibility scope (live-steering polish). A control shows only when it's
   * relevant: `modes` limits it to those shader modes; `pass` shows it only
   * while that post-pass is enabled. Omit both for a global control. The
   * uniform is always declared + uploaded regardless of visibility.
   */
  modes?: string[];
  pass?: string;
}

/** True if a control drives a `vec3` uniform (only `color` does). */
export function isColor(def: ControlDef): boolean {
  return def.type === 'color';
}

/** Uniform name carrying a pass's enable state, e.g. "trails" → "uFxTrails". */
export function passToggleUniform(passName: string): string {
  return `uFx${passName.charAt(0).toUpperCase()}${passName.slice(1)}`;
}

/**
 * Typed toggle controls carrying pass-enable state — one per registered pass.
 * These live in the same value store as every other control, so FrameState.
 * controls is the complete serialisable snapshot (mode aside): the Renderer
 * derives its active chain from these values each frame, and presets get pass
 * state for free. They render as the compact Effects button row, not as
 * Controls-section widgets. Passes start disabled (no-op pipeline).
 */
export function passToggleDefs(passNames: string[]): ControlDef[] {
  return passNames.map((name) => ({
    id: `fx-${name}`,
    name,
    glslName: passToggleUniform(name),
    type: 'toggle' as const,
    default: false,
  }));
}
