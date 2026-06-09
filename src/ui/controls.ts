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
  // Trails/feedback pass — how long motion smears persist (0..1).
  {
    id: 'trailDecay',
    name: 'Trail Decay',
    glslName: 'uTrailDecay',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.9,
  },
  // Dither pass — matrix size snaps to {2,4,8}; levels = steps per channel.
  {
    id: 'ditherSize',
    name: 'Dither Matrix',
    glslName: 'uDitherSize',
    min: 2,
    max: 8,
    step: 1,
    default: 4,
  },
  {
    id: 'ditherLevels',
    name: 'Dither Levels',
    glslName: 'uDitherLevels',
    min: 2,
    max: 8,
    step: 1,
    default: 4,
  },
  // Palette quantize pass — N colours + manual palette phase offset.
  {
    id: 'paletteColors',
    name: 'Palette Colors',
    glslName: 'uPaletteColors',
    min: 2,
    max: 16,
    step: 1,
    default: 6,
  },
  {
    id: 'paletteShift',
    name: 'Palette Shift',
    glslName: 'uPaletteShift',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
  },
  // Bloom pass — brightness threshold + additive glow intensity.
  {
    id: 'bloomThreshold',
    name: 'Bloom Threshold',
    glslName: 'uBloomThreshold',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.55,
  },
  {
    id: 'bloomIntensity',
    name: 'Bloom Intensity',
    glslName: 'uBloomIntensity',
    min: 0,
    max: 3,
    step: 0.01,
    default: 1.1,
  },
  // Chromatic aberration — radial RGB split magnitude (also scaled by level).
  {
    id: 'chromaAmount',
    name: 'Chroma Split',
    glslName: 'uChromaAmount',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
  },
];

/** glslNames of every control — handed to the Renderer for uniform plumbing. */
export const CONTROL_UNIFORMS: string[] = CONTROLS.map((c) => c.glslName);
