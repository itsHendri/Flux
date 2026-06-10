import type { ControlDef } from '../core/state.ts';

/**
 * Web MIDI → controls. A controller knob/fader sends Control Change (CC)
 * messages; a MIDI-learn flow binds a CC (channel + controller number) to a
 * slider control, scaling the 0–127 value into the control's min..max range.
 * Bindings persist to localStorage keyed by stable ControlDef.id.
 *
 * Split for testability: parsing and the learn/apply mapping are pure
 * (`parseMidi`, `MidiMap`); only `MidiEngine` touches the Web MIDI API.
 */

export interface CcEvent {
  channel: number; // 0..15
  controller: number; // 0..127
  value: number; // 0..127
}

/** Parse a raw MIDI message; returns a CC event or null for anything else. */
export function parseMidi(data: Uint8Array): CcEvent | null {
  if (data.length < 3) return null;
  const status = data[0];
  if ((status & 0xf0) !== 0xb0) return null; // 0xB0..0xBF = Control Change
  return { channel: status & 0x0f, controller: data[1], value: data[2] };
}

/** Scale a 0..127 CC value into a control's min..max (slider) range. */
export function scaleCc(value: number, def: ControlDef): number {
  const min = def.min ?? 0;
  const max = def.max ?? 1;
  const v = min + (Math.max(0, Math.min(127, value)) / 127) * (max - min);
  const step = def.step ?? 0;
  return step > 0 ? Math.round(v / step) * step : v;
}

export interface MidiBinding {
  controlId: string;
  channel: number;
  controller: number;
}

/**
 * The learn/apply mapping. Arm a control with `learn`; the next CC event
 * binds to it (one binding per control, one per CC — later wins). Subsequent
 * events route to their bound control as a scaled value.
 */
export class MidiMap {
  private bindings: MidiBinding[] = [];
  private armed: string | null = null;

  constructor(private readonly defs: ControlDef[]) {}

  /** Arm a control id for learning (null disarms). */
  learn(controlId: string | null): void {
    this.armed = controlId;
  }

  get armedControl(): string | null {
    return this.armed;
  }

  get all(): MidiBinding[] {
    return [...this.bindings];
  }

  setAll(bindings: MidiBinding[]): void {
    const ids = new Set(this.defs.map((d) => d.id));
    this.bindings = bindings.filter((b) => ids.has(b.controlId));
  }

  unbind(controlId: string): void {
    this.bindings = this.bindings.filter((b) => b.controlId !== controlId);
  }

  /**
   * Feed one CC event. If a control is armed, this event binds it (and
   * disarms). Returns the bound control's glslName + scaled value when the
   * event routes somewhere, else null.
   */
  feed(ev: CcEvent): { controlId: string; glslName: string; value: number } | null {
    if (this.armed) {
      const id = this.armed;
      this.armed = null;
      this.bindings = this.bindings.filter(
        (b) => b.controlId !== id && !(b.channel === ev.channel && b.controller === ev.controller),
      );
      this.bindings.push({ controlId: id, channel: ev.channel, controller: ev.controller });
    }
    const bound = this.bindings.find(
      (b) => b.channel === ev.channel && b.controller === ev.controller,
    );
    if (!bound) return null;
    const def = this.defs.find((d) => d.id === bound.controlId);
    if (!def) return null;
    return { controlId: def.id, glslName: def.glslName, value: scaleCc(ev.value, def) };
  }
}

/** Persist/recall bindings (localStorage in app, any Storage in tests). */
export class MidiBindingStore {
  constructor(
    private readonly storage: Storage,
    private readonly key = 'flux.midi.v1',
  ) {}

  load(): MidiBinding[] {
    try {
      const raw = this.storage.getItem(this.key);
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? (parsed as MidiBinding[]) : [];
    } catch {
      return [];
    }
  }

  save(bindings: MidiBinding[]): void {
    this.storage.setItem(this.key, JSON.stringify(bindings));
  }
}

/**
 * The Web MIDI layer: requests access, fans every input's CC messages into a
 * callback, and tracks the connected input names (hot-plug aware). Degrades
 * cleanly where Web MIDI is unsupported (Safari) or no device is present.
 */
export class MidiEngine {
  private access: MIDIAccess | null = null;
  private ccCb: (ev: CcEvent) => void = () => {};
  private devicesCb: (names: string[]) => void = () => {};

  static get supported(): boolean {
    return typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator;
  }

  onCc(cb: (ev: CcEvent) => void): void {
    this.ccCb = cb;
  }

  onDevicesChanged(cb: (names: string[]) => void): void {
    this.devicesCb = cb;
  }

  async init(): Promise<void> {
    if (!MidiEngine.supported) throw new Error('Web MIDI is not supported in this browser.');
    this.access = await navigator.requestMIDIAccess();
    this.attachAll();
    this.access.addEventListener('statechange', () => {
      this.attachAll();
      this.devicesCb(this.deviceNames);
    });
    this.devicesCb(this.deviceNames);
  }

  get deviceNames(): string[] {
    if (!this.access) return [];
    return [...this.access.inputs.values()].map((i) => i.name ?? 'unnamed device');
  }

  private attachAll(): void {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (e: MIDIMessageEvent) => {
        if (!e.data) return;
        const cc = parseMidi(e.data);
        if (cc) this.ccCb(cc);
      };
    }
  }
}
