import { describe, it, expect } from 'vitest';
import { BUILTIN_UNIFORMS } from '../src/render/Renderer.ts';
import { CONTROLS } from '../src/ui/controls.ts';
import { THEME_COLOR_CONTROLS } from '../src/ui/themes.ts';
import { passToggleDefs } from '../src/core/state.ts';
import { PASSES } from '../src/shaders/passes.ts';

// Every program's preamble declares the builtins and every control uniform
// side by side, so one shared name is a GLSL redefinition — and it breaks
// *every* shader at once, which no TypeScript check can see. (Phase 9 nearly
// shipped a builtin called uBarCount, the bars mode's column control.)
describe('uniform names', () => {
  const controls = [...CONTROLS, ...THEME_COLOR_CONTROLS, ...passToggleDefs(PASSES.map((p) => p.name))];

  it('no builtin shares a name with a control', () => {
    const names = new Set(controls.map((c) => c.glslName));
    for (const b of BUILTIN_UNIFORMS) expect(names.has(b), `${b} is both a builtin and a control`).toBe(false);
  });

  it('no two controls share a uniform', () => {
    const seen = new Set<string>();
    for (const c of controls) {
      expect(seen.has(c.glslName), `${c.glslName} declared twice`).toBe(false);
      seen.add(c.glslName);
    }
  });
});
