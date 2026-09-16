import type { AudioInputDevice } from '../audio/devices.ts';

/**
 * Universal input picker.
 *
 * The visualization always runs — if there's audio there's movement, if not
 * there isn't. Live input needs no play/pause: the only required user action is
 * a one-time "Enable Audio" gesture (browsers demand a gesture before audio
 * capture and before resuming an AudioContext). After that the dropdown picks
 * between the available microphone inputs, and the list refreshes itself as
 * microphones are connected or removed.
 *
 * A loaded audio file joins the same dropdown in its own group, so the one
 * question "what is driving the visuals?" keeps one answer in one place — the
 * file's play/pause and scrubber live in the Transport section.
 */
export type Selection =
  | { kind: 'none' }
  | { kind: 'file'; label: string }
  | { kind: 'device'; deviceId: string; label: string };

export interface SourcePickerCallbacks {
  /** The one-time gesture: resume audio, request permission, scan devices. */
  onEnableAudio(): void;
  /** Dropdown changed — activate the newly selected device. */
  onSelectSource(): void;
}

const DEVICE_PREFIX = 'device:';
const FILE_VALUE = 'file:';

export class SourcePicker {
  private readonly select: HTMLSelectElement;
  private readonly enableBtn: HTMLButtonElement;
  private readonly status: HTMLElement;
  private readonly cb: SourcePickerCallbacks;
  private devices: AudioInputDevice[] = [];
  /** Name of the loaded file, if any — it sits in the list beside the mics. */
  private fileName: string | null = null;

  constructor(parent: HTMLElement, cb: SourcePickerCallbacks) {
    this.cb = cb;

    const section = document.createElement('div');
    section.className = 'section';
    section.innerHTML = '<h2>Input</h2>';

    // --- Source dropdown -------------------------------------------------
    this.select = document.createElement('select');
    this.select.className = 'source-select';
    this.select.addEventListener('change', () => this.cb.onSelectSource());
    section.appendChild(this.select);

    // --- Enable Audio button (the one required gesture) ------------------
    this.enableBtn = document.createElement('button');
    this.enableBtn.className = 'big-btn';
    this.enableBtn.style.marginTop = '8px';
    this.enableBtn.textContent = 'ENABLE AUDIO';
    this.enableBtn.addEventListener('click', () => this.cb.onEnableAudio());
    section.appendChild(this.enableBtn);

    this.status = document.createElement('div');
    this.status.style.cssText = 'margin-top:8px;font-size:10px;color:var(--ink-dim);';
    this.status.textContent = 'press Enable Audio to start reacting to sound';
    section.appendChild(this.status);

    parent.appendChild(section);

    this.rebuildOptions();
  }

  /** The currently selected source. */
  get selection(): Selection {
    const v = this.select.value;
    if (v === FILE_VALUE && this.fileName) {
      return { kind: 'file', label: this.fileName };
    }
    if (v.startsWith(DEVICE_PREFIX)) {
      const deviceId = v.slice(DEVICE_PREFIX.length);
      const dev = this.devices.find((d) => d.deviceId === deviceId);
      return { kind: 'device', deviceId, label: dev?.label ?? 'input device' };
    }
    return { kind: 'none' };
  }

  /** Replace the live device list (after the permission grant or devicechange). */
  setDevices(devices: AudioInputDevice[]): void {
    this.devices = devices;
    this.rebuildOptions();
  }

  /** Put a loaded file in the list (or take it back out with `null`). */
  setFile(name: string | null): void {
    this.fileName = name;
    this.rebuildOptions();
  }

  /** Point the dropdown back at a live input — the bar's mic button. */
  selectFirstDevice(): void {
    const first = this.devices[0];
    if (first) this.select.value = `${DEVICE_PREFIX}${first.deviceId}`;
  }

  /** Make the file the active choice — called right after one is loaded. */
  selectFile(): void {
    if (this.fileName) this.select.value = FILE_VALUE;
  }

  /** Hide the gesture button once audio is enabled. */
  markAudioEnabled(): void {
    this.enableBtn.style.display = 'none';
  }

  /** Rebuild the dropdown, keeping the current selection if it still exists. */
  private rebuildOptions(): void {
    const keep = this.select.value;
    this.select.innerHTML = '';

    const opt = (value: string, label: string): HTMLOptionElement => {
      const o = document.createElement('option');
      o.value = value;
      o.textContent = label;
      return o;
    };

    if (this.fileName) {
      const group = document.createElement('optgroup');
      group.label = 'file';
      group.appendChild(opt(FILE_VALUE, this.fileName));
      this.select.appendChild(group);
    }

    const live = document.createElement('optgroup');
    live.label = 'live input';
    if (this.devices.length > 0) {
      for (const d of this.devices) {
        live.appendChild(opt(`${DEVICE_PREFIX}${d.deviceId}`, d.label));
      }
    } else {
      live.appendChild(opt('', '— no audio inputs detected —'));
    }
    this.select.appendChild(live);

    const hasKeep =
      keep !== '' && Array.from(this.select.options).some((o) => o.value === keep);
    if (hasKeep) {
      this.select.value = keep;
    } else {
      const first = Array.from(this.select.options).find((o) => o.value !== '');
      this.select.value = first ? first.value : '';
    }
  }

  setStatus(msg: string): void {
    this.status.textContent = msg;
  }
}
