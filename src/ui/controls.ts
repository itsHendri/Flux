import type { ControlDef } from '../core/state.ts';

/**
 * THE uniform schema — single source of truth.
 *
 * Each entry generates both a panel slider (ControlPanel) and a shader uniform
 * declaration + per-frame upload (Renderer). Add a control here and it appears
 * in both places automatically; nothing else needs to change.
 */
export const CONTROLS: ControlDef[] = [
  {
    id: 'gain',
    name: 'Gain',
    glslName: 'uGain',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
  },
  {
    id: 'warp',
    name: 'Warp',
    glslName: 'uWarp',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
  },
  {
    id: 'scale',
    name: 'Scale',
    glslName: 'uScale',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
  },
];

/** glslNames of every control — handed to the Renderer for uniform plumbing. */
export const CONTROL_UNIFORMS: string[] = CONTROLS.map((c) => c.glslName);
