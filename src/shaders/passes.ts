import type { PostPass } from '../render/Renderer.ts';
import trails from './passes/trails.frag?raw';
import dither from './passes/dither.frag?raw';
import quantize from './passes/quantize.frag?raw';

/**
 * The post-pass registry — mirrors `modes.ts`. Each entry becomes a toggleable
 * effect in the pipeline; order here is the chain order. Add a `.frag` defining
 * `vec3 render(vec2 uv)` (it may sample `uSource` and `uPrevFrame`) and an entry
 * here, and it appears as a toggle in the Effects panel automatically.
 */
export const PASSES: PostPass[] = [
  // Trails first so feedback operates on the raw motion, before stylisation.
  { name: 'trails', fragSource: trails },
  { name: 'dither', fragSource: dither },
  { name: 'quantize', fragSource: quantize },
];

type PassesListener = (passes: PostPass[]) => void;
const listeners = new Set<PassesListener>();

/** Subscribe to hot-reloaded pass source (Vite HMR on the .frag files). */
export function onPassesChanged(cb: PassesListener): void {
  listeners.add(cb);
}

if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    if (mod) {
      const next = (mod as unknown as { PASSES: PostPass[] }).PASSES;
      for (const l of listeners) l(next);
    }
  });
}
