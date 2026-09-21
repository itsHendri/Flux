import type { ShaderMode } from '../render/Renderer.ts';
import bars from './modes/bars.frag?raw';
import waveform from './modes/waveform.frag?raw';
import raymarch from './modes/raymarch.frag?raw';
import flow from './modes/flow.frag?raw';
import cells from './modes/cells.frag?raw';
import logo from './modes/logo.frag?raw';
import mandala from './modes/mandala.frag?raw';
import sand from './modes/sand.frag?raw';
import bulb from './modes/bulb.frag?raw';
import lattice from './modes/lattice.frag?raw';
import chrome from './modes/chrome.frag?raw';
import fur from './modes/fur.frag?raw';
import grove from './modes/grove.frag?raw';

/** All shader modes. Each is a `vec3 render(vec2 uv)` fragment. */
export const MODES: ShaderMode[] = [
  { name: 'bars', fragSource: bars },
  { name: 'waveform', fragSource: waveform },
  { name: 'raymarch', fragSource: raymarch },
  { name: 'flow', fragSource: flow },
  { name: 'cells', fragSource: cells },
  { name: 'mandala', fragSource: mandala },
  { name: 'sand', fragSource: sand },
  { name: 'bulb', fragSource: bulb },
  { name: 'lattice', fragSource: lattice },
  { name: 'chrome', fragSource: chrome },
  { name: 'fur', fragSource: fur },
  { name: 'grove', fragSource: grove },
  { name: 'logo', fragSource: logo },
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
