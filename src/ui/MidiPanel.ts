/**
 * MIDI section: connect button + status line, a control picker with a
 * "learn" button (arm → twist a knob → bound), and a chip per binding with
 * an unbind ×. Pure UI — the engine, mapping, and persistence live with the
 * caller via callbacks.
 */
export interface MidiPanelCallbacks {
  onConnect: () => void;
  /** Arm (controlId) or cancel (null) learning. */
  onLearn: (controlId: string | null) => void;
  onUnbind: (controlId: string) => void;
}

export interface LearnableControl {
  id: string;
  name: string;
}

export class MidiPanel {
  private readonly status: HTMLElement;
  private readonly learnBtn: HTMLButtonElement;
  private readonly select: HTMLSelectElement;
  private readonly list: HTMLElement;
  private readonly cb: MidiPanelCallbacks;
  private learning = false;

  constructor(parent: HTMLElement, learnable: LearnableControl[], cb: MidiPanelCallbacks) {
    this.cb = cb;
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = '<h2>MIDI</h2>';

    const connect = document.createElement('button');
    connect.className = 'big-btn';
    connect.textContent = 'connect midi';
    connect.addEventListener('click', () => cb.onConnect());

    this.status = document.createElement('div');
    this.status.className = 'midi-status';

    const row = document.createElement('div');
    row.className = 'preset-row';
    this.select = document.createElement('select');
    this.select.className = 'source-select';
    for (const c of learnable) {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      this.select.appendChild(opt);
    }
    this.learnBtn = document.createElement('button');
    this.learnBtn.textContent = 'learn';
    this.learnBtn.addEventListener('click', () => {
      const next = !this.learning;
      this.setLearning(next);
      cb.onLearn(next ? this.select.value : null);
    });
    row.append(this.select, this.learnBtn);

    this.list = document.createElement('div');
    this.list.className = 'btn-row';

    section.append(connect, this.status, row, this.list);
    parent.appendChild(section);
  }

  setStatus(text: string): void {
    this.status.textContent = text;
  }

  setLearning(on: boolean): void {
    this.learning = on;
    this.learnBtn.textContent = on ? 'twist a knob…' : 'learn';
    this.learnBtn.classList.toggle('active', on);
  }

  /** Re-render the binding chips: `text` is the display label per binding. */
  refreshBindings(bindings: { controlId: string; text: string }[]): void {
    this.list.textContent = '';
    for (const b of bindings) {
      const chip = document.createElement('span');
      chip.className = 'preset-chip';
      const label = document.createElement('button');
      label.textContent = b.text;
      label.disabled = true;
      const del = document.createElement('button');
      del.textContent = '×';
      del.className = 'preset-delete';
      del.title = 'Unbind';
      del.addEventListener('click', () => this.cb.onUnbind(b.controlId));
      chip.append(label, del);
      this.list.appendChild(chip);
    }
  }
}
