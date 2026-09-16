import type { PostPass } from '../render/Renderer.ts';
import warp from './passes/warp.frag?raw';
import trails from './passes/trails.frag?raw';
import bloomDown from './passes/bloom-down.frag?raw';
import bloomUp from './passes/bloom-up.frag?raw';
import bloomComposite from './passes/bloom-composite.frag?raw';
import dither from './passes/dither.frag?raw';
import tunnel from './passes/tunnel.frag?raw';
import kaleido from './passes/kaleido.frag?raw';
import scanline from './passes/scanline.frag?raw';

/**
 * The post-pass registry — mirrors `modes.ts`. Each entry becomes a toggleable
 * effect in the pipeline; order here is the chain order. Add a `.frag` defining
 * `vec3 render(vec2 uv)` (it may sample `uSource` and `uPrevFrame`) and an entry
 * here, and it appears as a toggle in the Effects panel automatically.
 */
export const PASSES: PostPass[] = [
  // Feedback first, so it operates on the raw motion rather than on
  // stylisation. Warp before trails: warp pulls the past through a moving
  // coordinate field, trails lays a straight decay over whatever comes out.
  { name: 'warp', fragSource: warp },
  { name: 'trails', fragSource: trails },
  // Tunnel rebuilds the picture's geometry; it sits before kaleido so the
  // kaleidoscope folds the tunnel rather than the other way round.
  { name: 'tunnel', fragSource: tunnel },
  { name: 'dither', fragSource: dither },
  // Mip-chain bloom (Jimenez 2014): the Renderer routes this name to
  // BloomPipeline; stage order is [downsample, upsample, composite].
  { name: 'bloom', stages: [bloomDown, bloomUp, bloomComposite] },
  { name: 'kaleido', fragSource: kaleido },
  { name: 'scanline', fragSource: scanline },
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
