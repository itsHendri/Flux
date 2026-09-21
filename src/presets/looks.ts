import type { ControlDef } from '../core/state.ts';
import type { Preset } from './presets.ts';

/**
 * Built-in looks — combinations worth starting from.
 *
 * FLUX ships nine modes and eight effects, which is more combinations than
 * anyone wants to audition by hand mid-set; the user's own words were that he
 * still needed "to play around and look at a few combos". These are the
 * answers: six named settings of the whole instrument, each a mode, a pass
 * chain, a theme and the control values that make that pairing work.
 *
 * A look lists only what it cares about. `applyLook` resets everything to its
 * default first, so recalling one always lands in the same place regardless of
 * what was on before — a look that inherited leftover effects wouldn't be a
 * look, it would be a suggestion.
 */
export interface Look {
  name: string;
  /** Why this one exists — the panel shows it as a tooltip. */
  note: string;
  preset: Preset;
}

export const LOOKS: Look[] = [
  {
    name: 'cathedral',
    note: 'Domain-warp flow pulled through itself and mirrored — the deep fractal mandala.',
    preset: {
      mode: 'flow',
      values: {
        theme: 0,
        themeMix: 0.85,
        'fx-warp': 1,
        'fx-kaleido': 1,
        'fx-bloom': 1,
        kaleidoSegments: 8,
        warpZoom: 1.008,
        warpRot: 0.12,
        warpDecay: 0.82,
        bloomIntensity: 0.3,
        flowTurb: 0.35,
        scale: 0.5,
        gain: 0.38,
        // ACES rather than Reinhard: Reinhard rolls everything off together
        // and the mandala goes milky, where ACES keeps the contrast.
        tonemap: 2,
      },
    },
  },
  {
    name: 'coral',
    note: 'The reaction growing in firelight; kicks seed new colonies.',
    preset: {
      mode: 'reaction',
      values: {
        theme: 1,
        themeMix: 0.9,
        'fx-bloom': 1,
        rdPattern: 1,
        rdSpeed: 14,
        rdAudio: 0.7,
        bloomIntensity: 0.2,
        gain: 0.35,
        tonemap: 2,
      },
    },
  },
  {
    name: 'scope',
    note: 'The mirrored waveform on a cold ribbon — the classic iTunes read.',
    preset: {
      mode: 'waveform',
      values: {
        theme: 2,
        themeMix: 0.8,
        'fx-trails': 1,
        'fx-bloom': 1,
        waveStyle: 1,
        waveAmp: 0.6,
        waveGlow: 0.35,
        waveLayers: 3,
        trailDecay: 0.7,
        bloomIntensity: 0.25,
        gain: 0.35,
        tonemap: 1,
      },
    },
  },
  {
    name: 'supernova',
    note: 'Charged particles gathering on the poles, with the glow the original had.',
    preset: {
      mode: 'magneto',
      values: {
        theme: 0,
        themeMix: 0.85,
        'fx-bloom': 1,
        'fx-trails': 1,
        magCharge: 0.75,
        magDamp: 0.68,
        magSpin: 0.45,
        particles: 256,
        trailDecay: 0.86,
        bloomIntensity: 0.6,
        scale: 0.45,
        gain: 0.55,
      },
    },
  },
  {
    name: 'ink',
    note: 'Ink stirred through a real fluid; kicks throw a new colour in.',
    preset: {
      mode: 'fluid',
      values: {
        theme: 2,
        themeMix: 0.8,
        'fx-bloom': 1,
        fluidDetail: 384,
        fluidForce: 0.55,
        fluidSwirl: 0.7,
        fluidFade: 0.3,
        bloomIntensity: 0.35,
        gain: 0.5,
        tonemap: 2,
      },
    },
  },
  {
    name: 'shrine',
    note: 'The Mandelbulb, close and lit; every accent re-grows its spires.',
    preset: {
      mode: 'bulb',
      values: {
        theme: 1,
        themeMix: 0.85,
        'fx-bloom': 1,
        bulbQuality: 1,
        bulbPower: 8,
        bulbGrow: 0.5,
        bulbGlow: 0.45,
        scale: 0.55,
        bloomIntensity: 0.3,
        gain: 0.45,
        tonemap: 2,
      },
    },
  },
  {
    name: 'readout',
    note: 'The last few seconds of the track as a picture, on a cold CRT.',
    preset: {
      mode: 'spectro',
      values: {
        theme: 2,
        themeMix: 0.8,
        'fx-scanline': 1,
        'fx-bloom': 1,
        specWindow: 0.6,
        specGain: 0.42,
        specWaterfall: 0,
        scanlineIntensity: 0.3,
        bloomIntensity: 0.25,
        gain: 0.45,
        tonemap: 1,
      },
    },
  },
  {
    name: 'vault',
    note: 'The Mandelbox from outside: arches and shafts, fog and distance.',
    preset: {
      mode: 'lattice',
      values: {
        theme: 0,
        themeMix: 0.85,
        'fx-bloom': 1,
        latticeQuality: 1,
        boxScale: 2.0,
        boxFold: 0.35,
        boxDrive: 0.4,
        boxGlow: 0.35,
        scale: 0.45,
        bloomIntensity: 0.3,
        gain: 0.5,
        tonemap: 2,
      },
    },
  },
  {
    name: 'molten',
    note: 'A slug of chrome under a studio light; kicks dent it.',
    preset: {
      mode: 'chrome',
      values: {
        theme: 4,
        themeMix: 0.6,
        'fx-bloom': 1,
        chromeMelt: 0.55,
        chromeRough: 0.12,
        scale: 0.45,
        bloomIntensity: 0.4,
        gain: 0.5,
        tonemap: 2,
      },
    },
  },
  {
    name: 'coat',
    note: 'A field of fur the bass combs; the tips catch the highs.',
    preset: {
      mode: 'fur',
      values: {
        theme: 1,
        themeMix: 0.85,
        'fx-bloom': 1,
        furLength: 0.55,
        furDensity: 0.5,
        furBrush: 0.55,
        bloomIntensity: 0.2,
        gain: 0.5,
      },
    },
  },
  {
    name: 'tape',
    note: 'The spectrum through a dithered, quantised, scanlined transfer.',
    preset: {
      mode: 'bars',
      values: {
        theme: 4,
        themeMix: 0.75,
        'fx-dither': 1,
        'fx-scanline': 1,
        // No quantize here: that pass maps luminance onto its own cosine
        // palette, which overrides the theme entirely — it can't be
        // monochrome, whatever Mono says.
        ditherSize: 4,
        ditherMode: 0,
        ditherLevels: 5,
        scanlineIntensity: 0.45,
        barCount: 40,
        barGlow: 0.25,
        // Low: on a loud track every column pins to full height at the usual
        // gain, and a wall of full-height bars is not a spectrum.
        gain: 0.3,
      },
    },
  },
  {
    name: 'comet',
    note: 'The curl-noise swarm mirrored into acid — trails3d at its loudest.',
    preset: {
      mode: 'trails3d',
      values: {
        theme: 3,
        themeMix: 0.9,
        'fx-trails': 1,
        'fx-bloom': 1,
        'fx-kaleido': 1,
        kaleidoSegments: 6,
        particles: 256,
        flowSpeed: 0.55,
        trailTurb: 0.5,
        trailDecay: 0.93,
        bloomIntensity: 1.0,
        scale: 0.45,
        // Points are small and sparse; this look needs the brightness the
        // fullscreen-field modes don't.
        gain: 0.8,
      },
    },
  },
  {
    name: 'phosphor',
    note: 'Left against right on a green scope face — the stereo picture, glowing.',
    preset: {
      mode: 'vector',
      values: {
        // Mostly the phosphor's own green: a scope that takes on the theme
        // fully stops reading as a scope.
        theme: 2,
        themeMix: 0.25,
        'fx-bloom': 1,
        bloomIntensity: 0.6,
        scopePersist: 0.6,
        scopeBeam: 1.2,
        tonemap: 2,
      },
    },
  },
  {
    name: 'foundry',
    note: 'A swarm of chrome beads that builds a shape and breaks it on the kick.',
    preset: {
      mode: 'forge',
      values: {
        theme: 1,
        themeMix: 0.7,
        'fx-bloom': 1,
        bloomIntensity: 0.45,
        forgeShatter: 0.65,
        forgeReact: 0.6,
        tonemap: 2,
      },
    },
  },
  {
    name: 'constellation',
    note: 'Every hit a star — a sky that grows over the track, mirrored.',
    preset: {
      mode: 'synapse',
      values: {
        theme: 0,
        themeMix: 0.85,
        'fx-bloom': 1,
        'fx-kaleido': 1,
        kaleidoSegments: 6,
        bloomIntensity: 0.9,
        synMemory: 256,
        synGlow: 1.2,
        tonemap: 2,
      },
    },
  },
  {
    name: 'polyp',
    note: 'Rings strung out on curling arms — the spectrum read from the root to the tips.',
    preset: {
      mode: 'anemone',
      values: {
        theme: 2,
        themeMix: 0.85,
        'fx-bloom': 1,
        bloomIntensity: 0.7,
        anemoneArms: 18,
        tonemap: 2,
      },
    },
  },
  {
    name: 'corridor',
    note: 'Falling through neon gates; the kick lights the next one.',
    preset: {
      mode: 'gate',
      values: {
        theme: 0,
        themeMix: 0.9,
        'fx-bloom': 1,
        bloomIntensity: 0.9,
        gateGlow: 1.3,
        tonemap: 2,
      },
    },
  },
  {
    name: 'nightwood',
    note: 'A fractal forest at dusk; the canopy re-grows with every chord.',
    preset: {
      mode: 'grove',
      values: {
        theme: 1,
        themeMix: 0.8,
        'fx-bloom': 1,
        bloomIntensity: 0.5,
        groveReact: 0.9,
        tonemap: 2,
      },
    },
  },
  {
    name: 'firefly',
    note: 'One light wandering a world of dust, darting on the kick.',
    preset: {
      mode: 'wisp',
      values: {
        theme: 1,
        themeMix: 0.85,
        'fx-bloom': 1,
        'fx-trails': 1,
        trailDecay: 0.9,
        bloomIntensity: 1.0,
        wispLight: 1.3,
        tonemap: 2,
      },
    },
  },
  {
    name: 'sanctum',
    note: 'A dark chamber drawn in light at its edges; the spectrum runs round the walls.',
    preset: {
      mode: 'oracle',
      values: {
        theme: 0,
        themeMix: 0.9,
        'fx-bloom': 1,
        bloomIntensity: 0.8,
        oracleGlow: 1.2,
        tonemap: 2,
      },
    },
  },
  {
    name: 'hyperspace',
    note: 'Neon rays rushing past, coloured by the bands that are playing.',
    preset: {
      mode: 'spacetime',
      values: {
        theme: 0,
        themeMix: 0.9,
        'fx-bloom': 1,
        'fx-trails': 1,
        trailDecay: 0.8,
        bloomIntensity: 0.9,
        tonemap: 2,
      },
    },
  },
];

/**
 * Every control at its schema default, keyed by glslName — the clean slate a
 * look is applied onto. Colour controls hand back a copy so a caller can't
 * edit the schema by mutating what it gets.
 */
export function defaultValues(defs: ControlDef[]): Record<string, number | number[]> {
  const out: Record<string, number | number[]> = {};
  for (const def of defs) {
    const d = def.default;
    out[def.glslName] = typeof d === 'number' ? d : Array.isArray(d) ? d.slice() : d ? 1 : 0;
  }
  return out;
}

/** Look up a look by name. */
export function findLook(name: string): Look | null {
  return LOOKS.find((l) => l.name === name) ?? null;
}
