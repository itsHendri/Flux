import { FADE_OPTIONS, PHRASE_OPTIONS, type SetSettings } from './setSettings.ts';

export interface SetPanelCallbacks {
  onChange(next: SetSettings): void;
}

/**
 * The Set section: how a set moves from one picture to the next. A row of
 * choices per setting — the same button-row idiom as the rest of the panel.
 */
export class SetPanel {
  private settings: SetSettings;
  private readonly repaints: (() => void)[] = [];

  constructor(parent: HTMLElement, initial: SetSettings, private readonly cb: SetPanelCallbacks) {
    this.settings = { ...initial };
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = '<h2>Set</h2>';

    this.row(section, 'Crossfade', FADE_OPTIONS, (v) => (v === 0 ? 'cut' : `${v}s`), 'fade');
    // Auto looks itself is switched from the performance bar (and key A);
    // these are how it behaves.
    this.row(section, 'Auto looks every', PHRASE_OPTIONS, (v) => `${v} bars`, 'phraseBars');
    this.row(section, 'Order', ['shuffle', 'sequence'] as const, (v) => v, 'order');

    parent.appendChild(section);
  }

  /** Repaint from outside (the bar's auto switch changes `auto`). */
  set(next: SetSettings): void {
    this.settings = { ...next };
    for (const r of this.repaints) r();
  }

  private row<K extends keyof SetSettings>(
    section: HTMLElement,
    label: string,
    values: readonly SetSettings[K][],
    text: (v: SetSettings[K]) => string,
    key: K,
  ): void {
    const title = document.createElement('div');
    title.className = 'set-label';
    title.textContent = label;
    const row = document.createElement('div');
    row.className = 'btn-row';
    const buttons = values.map((v) => {
      const b = document.createElement('button');
      b.textContent = text(v);
      b.addEventListener('click', () => {
        this.settings = { ...this.settings, [key]: v };
        paint();
        this.cb.onChange({ ...this.settings });
      });
      row.appendChild(b);
      return b;
    });
    const paint = () => buttons.forEach((b, i) => b.classList.toggle('active', values[i] === this.settings[key]));
    paint();
    this.repaints.push(paint);
    section.append(title, row);
  }
}
