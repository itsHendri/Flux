import type { ControlDef } from '../core/state.ts';
import { themeOptions } from './themes.ts';

// Modes that share the generic Warp/Scale controls (the procedural fields).
const WARP_MODES = ['plasma', 'raymarch', 'flow', 'cells'];
const SCALE_MODES = ['pulse', 'plasma', 'raymarch', 'flow', 'cells', 'logo', 'trails3d'];

/**
 * THE uniform schema — single source of truth.
 *
 * Each entry generates both a panel widget (ControlPanel, per `type`) and a
 * shader uniform declaration + per-frame upload (Renderer). `type` defaults to
 * `'slider'`. `modes`/`pass` scope a control's visibility (see ControlDef): a
 * control shows only when its mode is active / its pass is enabled, so the panel
 * always reflects what's actually steerable right now. The uniform is declared
 * and uploaded regardless.
 *
 * Per-mode controls are grouped at the end so each mode has an expressive,
 * distinctive set on top of the shared Gain/Warp/Scale.
 */
export const CONTROLS: ControlDef[] = [
  // --- Shared --------------------------------------------------------------
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
    // Read only by present.frag — resolves the HDR chain output for display.
    id: 'tonemap',
    name: 'Tonemap',
    glslName: 'uTonemap',
    type: 'select',
    options: [
      { label: 'None', value: 0 },
      { label: 'Reinhard', value: 1 },
      { label: 'ACES', value: 2 },
    ],
    default: 0,
  },
  {
    // The instrument's global colour: which theme, and how far every mode is
    // pulled toward it (0 = each mode's own palette, 1 = fully re-tinted).
    // Keys 1-5 switch themes; the colours themselves ride in uThemeA/B/C.
    id: 'theme',
    name: 'Theme',
    glslName: 'uTheme',
    type: 'select',
    options: themeOptions(),
    default: 0,
  },
  {
    id: 'themeMix',
    name: 'Tint',
    glslName: 'uThemeMix',
    min: 0,
    max: 1,
    step: 0.01,
    // High by default: at 0.85 a theme actually reads as itself while a trace
    // of each mode's own colour survives. Pull it down for the native look.
    default: 0.85,
  },
  {
    id: 'warp',
    name: 'Warp',
    glslName: 'uWarp',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
    modes: WARP_MODES,
  },
  {
    id: 'scale',
    name: 'Scale',
    glslName: 'uScale',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
    modes: SCALE_MODES,
  },

  // --- Per-mode (distinctive) ---------------------------------------------
  {
    id: 'barCount',
    name: 'Bar Count',
    glslName: 'uBarCount',
    min: 8,
    max: 48,
    step: 1,
    default: 28,
    modes: ['bars'],
  },
  {
    id: 'barGlow',
    name: 'Bar Glow',
    glslName: 'uBarGlow',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.45,
    modes: ['bars'],
  },
  {
    id: 'petals',
    name: 'Petals',
    glslName: 'uPetals',
    min: 3,
    max: 10,
    step: 1,
    default: 6,
    modes: ['pulse'],
  },
  {
    id: 'plasmaVeins',
    name: 'Veins',
    glslName: 'uPlasmaVeins',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.7,
    modes: ['plasma'],
  },
  {
    id: 'rayGlow',
    name: 'Glow',
    glslName: 'uRayGlow',
    min: 0,
    max: 2,
    step: 0.01,
    default: 1.0,
    modes: ['raymarch'],
  },
  {
    id: 'flowTurb',
    name: 'Turbulence',
    glslName: 'uFlowTurb',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
    modes: ['flow'],
  },
  {
    id: 'cellEdge',
    name: 'Edge Glow',
    glslName: 'uCellEdge',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
    modes: ['cells'],
  },
  {
    // Particle texture size: count = value². The mode's perf story — drop it
    // on weak GPUs, raise it for density.
    id: 'particles',
    name: 'Particles',
    glslName: 'uParticles',
    type: 'select',
    options: [
      { label: '16k', value: 128 },
      { label: '65k', value: 256 },
      { label: '262k', value: 512 },
    ],
    default: 256,
    modes: ['trails3d'],
  },
  {
    id: 'flowSpeed',
    name: 'Flow',
    glslName: 'uFlowSpeed',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
    modes: ['trails3d'],
  },
  {
    id: 'trailTurb',
    name: 'Turbulence',
    glslName: 'uTrailTurb',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
    modes: ['trails3d'],
  },
  {
    id: 'logoRipple',
    name: 'Ripple',
    glslName: 'uLogoRipple',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
    modes: ['logo'],
  },

  // --- Post-pass controls (shown only while their pass is enabled) ---------
  {
    // MilkDrop's warp vocabulary (see passes/warp.frag). Defaults are Geiss's:
    // zoom 1.0 = still, warp 1.0 = normal, decay 0.98 recommended.
    id: 'warpZoom',
    name: 'Warp Zoom',
    glslName: 'uWarpZoom',
    min: 0.9,
    max: 1.1,
    step: 0.001,
    default: 1.012,
    pass: 'warp',
  },
  {
    id: 'warpRot',
    name: 'Warp Rotate',
    glslName: 'uWarpRot',
    min: -1,
    max: 1,
    step: 0.01,
    default: 0.18,
    pass: 'warp',
  },
  {
    id: 'warpAmount',
    name: 'Warp',
    glslName: 'uWarpAmount',
    min: 0,
    max: 2,
    step: 0.01,
    default: 1.0,
    pass: 'warp',
  },
  {
    id: 'warpDecay',
    name: 'Warp Decay',
    glslName: 'uWarpDecay',
    min: 0.7,
    max: 0.995,
    step: 0.001,
    // Geiss recommends 0.98, but MilkDrop draws sparse geometry into its
    // feedback buffer; FLUX feeds it a full-screen mode, and above ~0.95 every
    // pixel keeps getting re-lit until the image washes out. 0.90 keeps the
    // mode's structure with the outward pull on top.
    default: 0.9,
    pass: 'warp',
  },
  {
    id: 'warpAudio',
    name: 'Warp Drive',
    glslName: 'uWarpAudio',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.6,
    pass: 'warp',
  },
  {
    id: 'trailDecay',
    name: 'Trail Decay',
    glslName: 'uTrailDecay',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.9,
    pass: 'trails',
  },
  {
    id: 'ditherMode',
    name: 'Dither Noise',
    glslName: 'uDitherMode',
    type: 'select',
    options: [
      { label: 'Bayer', value: 0 },
      { label: 'IGN', value: 1 },
      { label: 'Blue Noise', value: 2 },
    ],
    default: 0,
    pass: 'dither',
  },
  {
    id: 'ditherTemporal',
    name: 'Animate Noise',
    glslName: 'uDitherTemporal',
    type: 'toggle',
    default: false,
    pass: 'dither',
  },
  {
    // Bayer matrix size — no effect on the IGN / blue-noise modes.
    id: 'ditherSize',
    name: 'Dither Matrix',
    glslName: 'uDitherSize',
    type: 'select',
    options: [
      { label: '2', value: 2 },
      { label: '4', value: 4 },
      { label: '8', value: 8 },
    ],
    default: 4,
    pass: 'dither',
  },
  {
    id: 'ditherLevels',
    name: 'Dither Levels',
    glslName: 'uDitherLevels',
    min: 2,
    max: 8,
    step: 1,
    default: 4,
    pass: 'dither',
  },
  {
    id: 'paletteColors',
    name: 'Palette Colors',
    glslName: 'uPaletteColors',
    min: 2,
    max: 16,
    step: 1,
    default: 6,
    pass: 'quantize',
  },
  {
    id: 'paletteShift',
    name: 'Palette Shift',
    glslName: 'uPaletteShift',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
    pass: 'quantize',
  },
  {
    id: 'paletteCycle',
    name: 'Palette Cycle',
    glslName: 'uPaletteCycle',
    type: 'toggle',
    default: false,
    pass: 'quantize',
  },
  {
    id: 'paletteTint',
    name: 'Palette Tint',
    glslName: 'uPaletteTint',
    type: 'color',
    default: [1, 1, 1],
    pass: 'quantize',
  },
  {
    // 0 = no bright-pass (fully energy-conserving mip bloom); >0 = soft knee.
    id: 'bloomThreshold',
    name: 'Bloom Threshold',
    glslName: 'uBloomThreshold',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0,
    pass: 'bloom',
  },
  {
    id: 'bloomIntensity',
    name: 'Bloom Intensity',
    glslName: 'uBloomIntensity',
    min: 0,
    max: 3,
    step: 0.01,
    default: 0.8,
    pass: 'bloom',
  },
  {
    id: 'bloomRadius',
    name: 'Bloom Radius',
    glslName: 'uBloomRadius',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.35,
    pass: 'bloom',
  },
  {
    id: 'chromaAmount',
    name: 'Chroma Split',
    glslName: 'uChromaAmount',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.4,
    pass: 'chroma',
  },
  {
    id: 'kaleidoSegments',
    name: 'Kaleido Segments',
    glslName: 'uKaleidoSegments',
    min: 2,
    max: 16,
    step: 1,
    default: 6,
    pass: 'kaleido',
  },
  {
    id: 'scanlineIntensity',
    name: 'Scanline / VHS',
    glslName: 'uScanlineIntensity',
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
    pass: 'scanline',
  },
];
