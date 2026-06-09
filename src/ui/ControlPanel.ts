import type { ControlDef } from '../core/state.ts';

/** "#rrggbb" → [r,g,b] in 0..1. */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** [r,g,b] in 0..1 → "#rrggbb". */
function rgbToHex(rgb: [number, number, number]): string {
  const c = (v: number) =>
    Math.round(Math.max(0, Math.min(1, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${c(rgb[0])}${c(rgb[1])}${c(rgb[2])}`;
}

/**
 * Generates a widget per control from the schema and holds the live values.
 * The widget depends on `ControlDef.type` (slider / toggle / select / color);
 * every type ultimately writes into `values`, keyed by glslName, ready to drop
 * into FrameState.controls. Slider/toggle/select store a number; color stores
 * an `[r,g,b]` triple.
 */
export class ControlPanel {
  private readonly values: Record<string, number | number[]> = {};

  constructor(parent: HTMLElement, controls: ControlDef[]) {
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = '<h2>Controls</h2>';

    for (const def of controls) {
      const type = def.type ?? 'slider';
      const wrap = document.createElement('div');
      wrap.className = 'control';
      switch (type) {
        case 'toggle':
          this.buildToggle(wrap, def);
          break;
        case 'select':
          this.buildSelect(wrap, def);
          break;
        case 'color':
          this.buildColor(wrap, def);
          break;
        default:
          this.buildSlider(wrap, def);
      }
      section.appendChild(wrap);
    }

    parent.appendChild(section);
  }

  /** Label row: the control name on the left, an optional value readout right. */
  private labelRow(name: string, valueText?: string): { row: HTMLElement; val: HTMLElement } {
    const label = document.createElement('label');
    const n = document.createElement('span');
    n.textContent = name;
    const val = document.createElement('span');
    val.className = 'val';
    if (valueText !== undefined) val.textContent = valueText;
    label.append(n, val);
    return { row: label, val };
  }

  private buildSlider(wrap: HTMLElement, def: ControlDef): void {
    const init = typeof def.default === 'number' ? def.default : 0;
    this.values[def.glslName] = init;

    const { row, val } = this.labelRow(def.name, init.toFixed(2));
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(def.min ?? 0);
    input.max = String(def.max ?? 1);
    input.step = String(def.step ?? 0.01);
    input.value = String(init);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      this.values[def.glslName] = v;
      val.textContent = v.toFixed(2);
    });
    wrap.append(row, input);
  }

  private buildToggle(wrap: HTMLElement, def: ControlDef): void {
    const on = def.default === true;
    this.values[def.glslName] = on ? 1 : 0;

    const { row } = this.labelRow(def.name);
    const btn = document.createElement('button');
    btn.className = 'toggle-btn';
    const paint = (state: boolean) => {
      btn.classList.toggle('active', state);
      btn.textContent = state ? 'on' : 'off';
    };
    paint(on);
    btn.addEventListener('click', () => {
      const next = this.values[def.glslName] !== 1;
      this.values[def.glslName] = next ? 1 : 0;
      paint(next);
    });
    wrap.append(row, btn);
  }

  private buildSelect(wrap: HTMLElement, def: ControlDef): void {
    const options = def.options ?? [];
    const init = typeof def.default === 'number' ? def.default : (options[0]?.value ?? 0);
    this.values[def.glslName] = init;

    const { row } = this.labelRow(def.name);
    const group = document.createElement('div');
    group.className = 'btn-row';
    const buttons: HTMLButtonElement[] = [];
    for (const opt of options) {
      const btn = document.createElement('button');
      btn.textContent = opt.label;
      btn.classList.toggle('active', opt.value === init);
      btn.addEventListener('click', () => {
        this.values[def.glslName] = opt.value;
        for (const b of buttons) b.classList.toggle('active', b === btn);
      });
      buttons.push(btn);
      group.appendChild(btn);
    }
    wrap.append(row, group);
  }

  private buildColor(wrap: HTMLElement, def: ControlDef): void {
    const init: [number, number, number] = Array.isArray(def.default)
      ? (def.default as [number, number, number])
      : [1, 1, 1];
    this.values[def.glslName] = init.slice();

    const { row } = this.labelRow(def.name);
    const input = document.createElement('input');
    input.type = 'color';
    input.className = 'color-input';
    input.value = rgbToHex(init);
    input.addEventListener('input', () => {
      this.values[def.glslName] = hexToRgb(input.value);
    });
    wrap.append(row, input);
  }

  /** Current control values keyed by glslName. */
  getValues(): Record<string, number | number[]> {
    return this.values;
  }
}
