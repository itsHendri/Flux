/**
 * Presets section: a name field + save button, then a chip per saved preset
 * (click = recall, × = delete). Pure UI — storage and state application live
 * with the caller via the callbacks; `refresh` re-renders the chip list.
 */
export interface PresetPanelCallbacks {
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  onDelete: (name: string) => void;
  /** Recall a built-in look (no delete — they ship with the app). */
  onLook: (name: string) => void;
}

/** A shipped combination: name + one line on why it exists. */
export interface LookChip {
  name: string;
  note: string;
}

export class PresetPanel {
  private readonly list: HTMLElement;
  private readonly looks: HTMLElement;

  constructor(parent: HTMLElement, cb: PresetPanelCallbacks) {
    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = '<h2>Looks</h2>';

    // Built-in looks first: the answer to "which combinations are worth
    // using", before the space for your own.
    this.looks = document.createElement('div');
    this.looks.className = 'btn-row look-list';
    section.appendChild(this.looks);

    const yours = document.createElement('h2');
    yours.textContent = 'Your presets';
    yours.className = 'subhead';
    section.appendChild(yours);

    const row = document.createElement('div');
    row.className = 'preset-row';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'preset-name';
    input.placeholder = 'preset name';
    input.maxLength = 32;
    const save = document.createElement('button');
    save.textContent = 'save';
    const doSave = () => {
      const name = input.value.trim();
      if (!name) return;
      cb.onSave(name);
      input.value = '';
    };
    save.addEventListener('click', doSave);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doSave();
    });
    row.append(input, save);

    this.list = document.createElement('div');
    this.list.className = 'btn-row preset-list';

    section.append(row, this.list);
    parent.appendChild(section);

    this.cb = cb;
  }

  private readonly cb: PresetPanelCallbacks;

  /** Render the built-in looks. Called once — they never change. */
  setLooks(looks: LookChip[]): void {
    this.looks.textContent = '';
    for (const look of looks) {
      const btn = document.createElement('button');
      btn.textContent = look.name;
      btn.title = look.note;
      btn.addEventListener('click', () => this.cb.onLook(look.name));
      this.looks.appendChild(btn);
    }
  }

  /** Re-render the chip list from the current preset names. */
  refresh(names: string[]): void {
    this.list.textContent = '';
    for (const name of names) {
      const chip = document.createElement('span');
      chip.className = 'preset-chip';
      const load = document.createElement('button');
      load.textContent = name;
      load.title = `Load "${name}"`;
      load.addEventListener('click', () => this.cb.onLoad(name));
      const del = document.createElement('button');
      del.textContent = '×';
      del.className = 'preset-delete';
      del.title = `Delete "${name}"`;
      del.addEventListener('click', () => this.cb.onDelete(name));
      chip.append(load, del);
      this.list.appendChild(chip);
    }
  }
}
