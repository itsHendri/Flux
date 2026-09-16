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
type ApplyFn = (v: number | number[]) => void;
type ChangeFn = (v: number | number[]) => void;

export class ControlPanel {
  private readonly values: Record<string, number | number[]> = {};
  private readonly items: { def: ControlDef; wrap: HTMLElement }[] = [];
  private readonly section: HTMLElement;
  // Per-widget repaint hooks so values applied programmatically (presets)
  // update the visible widget state too. Keyed by glslName.
  private readonly appliers = new Map<string, ApplyFn>();
  // Subscribers to a control's value, however it changed — widget, hotkey,
  // MIDI or preset recall. Lets one control drive others (Theme writes the
  // theme colours) without anything reaching into the store behind our back.
  private readonly listeners = new Map<string, ChangeFn[]>();

  /**
   * @param controls rendered as widgets in the Controls section.
   * @param widgetless seeded into the value store with no widget here — their
   *   UI lives elsewhere (e.g. the pass toggles behind the Effects button row,
   *   driven via setValue/getValue). Same store, so getValues() serialises
   *   everything.
   */
  constructor(parent: HTMLElement, controls: ControlDef[], widgetless: ControlDef[] = []) {
    for (const def of widgetless) {
      this.values[def.glslName] =
        typeof def.default === 'number'
          ? def.default
          : Array.isArray(def.default)
            ? def.default.slice()
            : def.default
              ? 1
              : 0;
    }
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = '<h2>Controls</h2>';
    this.section = section;

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
      this.items.push({ def, wrap });
    }

    parent.appendChild(section);
  }

  /**
   * Show only the controls relevant to the current state: a control with
   * `modes` shows when the active mode is in it; one with `pass` shows when that
   * pass is enabled; otherwise it's always shown. Keeps live steering focused on
   * what's actually adjustable. The whole section hides if nothing is visible.
   */
  update(activeMode: string, isPassEnabled: (pass: string) => boolean): void {
    let anyVisible = false;
    for (const { def, wrap } of this.items) {
      const modeOk = !def.modes || def.modes.includes(activeMode);
      const passOk = !def.pass || isPassEnabled(def.pass);
      const visible = modeOk && passOk;
      wrap.style.display = visible ? '' : 'none';
      anyVisible = anyVisible || visible;
    }
    this.section.style.display = anyVisible ? '' : 'none';
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
      this.emit(def.glslName, v);
    });
    this.appliers.set(def.glslName, (v) => {
      if (typeof v !== 'number') return;
      input.value = String(v);
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
      this.emit(def.glslName, next ? 1 : 0);
    });
    this.appliers.set(def.glslName, (v) => paint(v === 1));
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
        this.emit(def.glslName, opt.value);
      });
      buttons.push(btn);
      group.appendChild(btn);
    }
    this.appliers.set(def.glslName, (v) => {
      for (let i = 0; i < options.length; i++) {
        buttons[i].classList.toggle('active', options[i].value === v);
      }
    });
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
      const rgb = hexToRgb(input.value);
      this.values[def.glslName] = rgb;
      this.emit(def.glslName, rgb);
    });
    this.appliers.set(def.glslName, (v) => {
      if (Array.isArray(v) && v.length === 3) {
        input.value = rgbToHex(v as [number, number, number]);
      }
    });
    wrap.append(row, input);
  }

  /** Subscribe to a control's value. Fires for every path that writes it. */
  onChange(glslName: string, cb: ChangeFn): void {
    const list = this.listeners.get(glslName);
    if (list) list.push(cb);
    else this.listeners.set(glslName, [cb]);
  }

  private emit(glslName: string, v: number | number[]): void {
    const list = this.listeners.get(glslName);
    if (!list) return;
    for (const cb of list) cb(v);
  }

  /** Current control values keyed by glslName. */
  getValues(): Record<string, number | number[]> {
    return this.values;
  }

  /** Read one scalar value (0 if unset/non-scalar). */
  getValue(glslName: string): number {
    const v = this.values[glslName];
    return typeof v === 'number' ? v : 0;
  }

  /** Write one scalar value — the path external widgets (Effects row) use. */
  setValue(glslName: string, value: number): void {
    this.values[glslName] = value;
    this.emit(glslName, value);
  }

  /**
   * Apply a batch of values (keyed by glslName) — preset recall. Updates the
   * store and repaints each control's widget; unknown names are ignored,
   * absent names keep their current value.
   */
  applyValues(values: Record<string, number | number[]>): void {
    for (const [glslName, v] of Object.entries(values)) {
      if (!(glslName in this.values)) continue;
      this.values[glslName] = Array.isArray(v) ? v.slice() : v;
      this.appliers.get(glslName)?.(v);
      this.emit(glslName, v);
    }
  }
}
