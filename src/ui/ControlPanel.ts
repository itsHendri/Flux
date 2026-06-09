import type { ControlDef } from '../core/state.ts';

/**
 * Generates a slider per control from the schema and holds the live values.
 * Values are keyed by glslName, ready to drop into FrameState.controls.
 */
export class ControlPanel {
  private readonly values: Record<string, number> = {};

  constructor(parent: HTMLElement, controls: ControlDef[]) {
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = '<h2>Controls</h2>';

    for (const def of controls) {
      this.values[def.glslName] = def.default;

      const wrap = document.createElement('div');
      wrap.className = 'control';

      const label = document.createElement('label');
      const name = document.createElement('span');
      name.textContent = def.name;
      const val = document.createElement('span');
      val.className = 'val';
      val.textContent = def.default.toFixed(2);
      label.append(name, val);

      const input = document.createElement('input');
      input.type = 'range';
      input.min = String(def.min);
      input.max = String(def.max);
      input.step = String(def.step);
      input.value = String(def.default);
      input.addEventListener('input', () => {
        const v = Number(input.value);
        this.values[def.glslName] = v;
        val.textContent = v.toFixed(2);
      });

      wrap.append(label, input);
      section.appendChild(wrap);
    }

    parent.appendChild(section);
  }

  /** Current control values keyed by glslName. */
  getValues(): Record<string, number> {
    return this.values;
  }
}
