/** A snapshot of analysed audio for one frame. All bands are 0..1, smoothed. */
export interface AudioFrame {
  bass: number;
  mid: number;
  high: number;
  level: number;
}

export const SILENT_FRAME: AudioFrame = { bass: 0, mid: 0, high: 0, level: 0 };

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
  /** glslName -> value, derived from the control schema. */
  controls: Record<string, number>;
  /** Name of the active shader mode. */
  mode: string;
}

/** A single user-facing control. Drives one shader uniform. */
export interface ControlDef {
  /** Stable id, used for presets later. */
  id: string;
  /** Human label shown in the panel. */
  name: string;
  /** Uniform name in GLSL, e.g. "uWarp". */
  glslName: string;
  min: number;
  max: number;
  step: number;
  default: number;
}
