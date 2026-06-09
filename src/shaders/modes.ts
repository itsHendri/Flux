import type { ShaderMode } from '../render/Renderer.ts';
import bars from './modes/bars.frag?raw';
import pulse from './modes/pulse.frag?raw';
import plasma from './modes/plasma.frag?raw';

/** All shader modes available in Sprint 0. */
export const MODES: ShaderMode[] = [
  { name: 'bars', fragSource: bars },
  { name: 'pulse', fragSource: pulse },
  { name: 'plasma', fragSource: plasma },
];

type ModesListener = (modes: ShaderMode[]) => void;
const listeners = new Set<ModesListener>();

/** Subscribe to hot-reloaded shader source (Vite HMR on the .frag files). */
export function onModesChanged(cb: ModesListener): void {
  listeners.add(cb);
}

if (import.meta.hot) {
  import.meta.hot.accept((mod) => {
    if (mod) {
      const next = (mod as unknown as { MODES: ShaderMode[] }).MODES;
      for (const l of listeners) l(next);
    }
  });
}
