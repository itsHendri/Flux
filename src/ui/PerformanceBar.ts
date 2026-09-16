import type { Theme } from './themes.ts';

/**
 * Step an index by `step`, wrapping in both directions. The mode cycler runs
 * off the end of the list in both directions all night, and JS `%` keeps the
 * sign of the left operand, so -1 % 8 is -1, not 7.
 */
export function stepIndex(current: number, step: number, length: number): number {
  if (length <= 0) return 0;
  const from = current < 0 ? 0 : current;
  return (((from + step) % length) + length) % length;
}

export interface PerformanceBarCallbacks {
  /** Listen to the room. */
  onMic(): void;
  /** Play the loaded file — or ask for one if nothing is loaded yet. */
  onFile(): void;
  /** Play/pause the loaded file. */
  onPlayPause(): void;
  onTheme(index: number): void;
  /** Step the mode list by -1 or +1. */
  onCycleMode(step: number): void;
  onFullscreen(): void;
  onPip(): void;
}

/**
 * The performance bar: a floating pill over the visual holding the handful of
 * things you actually touch mid-set — what's feeding it, what it looks like,
 * where it's going out. Everything here also exists in the dock panel; the
 * difference is reach. It gets out of the way on its own after a few idle
 * seconds, because the point of a performance is the picture, and comes back
 * on the first twitch of the mouse.
 */
const IDLE_MS = 2600;

export class PerformanceBar {
  private readonly root: HTMLElement;
  private readonly micBtn: HTMLButtonElement;
  private readonly fileBtn: HTMLButtonElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly time: HTMLElement;
  private readonly transportGroup: HTMLElement;
  private readonly modeLabel: HTMLElement;
  private readonly swatches: HTMLButtonElement[] = [];
  private readonly pipBtn: HTMLButtonElement;
  private idleTimer = 0;
  private hovered = false;

  constructor(parent: HTMLElement, themes: Theme[], cb: PerformanceBarCallbacks) {
    this.root = document.createElement('div');
    this.root.id = 'perf-bar';

    // --- Source ----------------------------------------------------------
    this.micBtn = this.iconButton('mic', 'Listen to the microphone', cb.onMic);
    this.fileBtn = this.iconButton('file', 'Play an audio file', cb.onFile);
    const source = this.group(this.micBtn, this.fileBtn);

    // --- Transport (only while a file is loaded) -------------------------
    this.playBtn = this.iconButton('▶', 'Play / pause (Space)', cb.onPlayPause);
    this.time = document.createElement('span');
    this.time.className = 'perf-time';
    this.time.textContent = '0:00 / 0:00';
    this.transportGroup = this.group(this.playBtn, this.time);
    this.transportGroup.style.display = 'none';

    // --- Themes ----------------------------------------------------------
    themes.forEach((theme, i) => {
      const btn = document.createElement('button');
      btn.className = 'perf-swatch';
      btn.title = `${theme.name} (${i + 1})`;
      btn.setAttribute('aria-label', `Theme ${theme.name}`);
      const stops = theme.colors.map((c) => cssRgb(c));
      btn.style.background = `linear-gradient(135deg, ${stops[0]}, ${stops[1]}, ${stops[2]})`;
      btn.addEventListener('click', () => cb.onTheme(i));
      this.swatches.push(btn);
    });
    const themeGroup = this.group(...this.swatches);

    // --- Mode cycler -----------------------------------------------------
    const prev = this.iconButton('‹', 'Previous mode', () => cb.onCycleMode(-1));
    this.modeLabel = document.createElement('span');
    this.modeLabel.className = 'perf-mode';
    this.modeLabel.textContent = '—';
    const next = this.iconButton('›', 'Next mode', () => cb.onCycleMode(1));
    const modeGroup = this.group(prev, this.modeLabel, next);

    // --- Output ----------------------------------------------------------
    const fsBtn = this.iconButton('⛶', 'Fullscreen', cb.onFullscreen);
    this.pipBtn = this.iconButton('⧉', 'Picture-in-Picture window', cb.onPip);
    const outGroup = this.group(fsBtn, this.pipBtn);

    this.root.append(source, this.transportGroup, themeGroup, modeGroup, outGroup);
    parent.appendChild(this.root);

    // Hovering the bar means it's in use — never fade out from under the
    // pointer, even if the mouse is perfectly still on a control.
    this.root.addEventListener('pointerenter', () => {
      this.hovered = true;
      this.wake();
    });
    this.root.addEventListener('pointerleave', () => {
      this.hovered = false;
      this.wake();
    });
    for (const ev of ['pointermove', 'pointerdown', 'keydown'] as const) {
      window.addEventListener(ev, () => this.wake());
    }
    this.wake();
  }

  /** Show the bar and restart the idle countdown. */
  private wake(): void {
    this.root.classList.remove('idle');
    window.clearTimeout(this.idleTimer);
    if (this.hovered) return;
    this.idleTimer = window.setTimeout(() => {
      if (!this.hovered) this.root.classList.add('idle');
    }, IDLE_MS);
  }

  /** Which source is live — highlights one half of the source toggle. */
  setSource(kind: 'mic' | 'file' | 'none'): void {
    this.micBtn.classList.toggle('active', kind === 'mic');
    this.fileBtn.classList.toggle('active', kind === 'file');
  }

  /** Mirror the file transport (see `Transport.watch`). */
  setTransport(state: { loaded: boolean; playing: boolean; readout: string }): void {
    this.transportGroup.style.display = state.loaded ? '' : 'none';
    this.playBtn.textContent = state.playing ? '❚❚' : '▶';
    this.playBtn.classList.toggle('active', state.playing);
    this.time.textContent = state.readout;
  }

  setTheme(index: number): void {
    this.swatches.forEach((b, i) => b.classList.toggle('active', i === index));
  }

  setMode(name: string): void {
    this.modeLabel.textContent = name;
  }

  setPip(on: boolean): void {
    this.pipBtn.classList.toggle('active', on);
  }

  private group(...children: HTMLElement[]): HTMLElement {
    const el = document.createElement('div');
    el.className = 'perf-group';
    el.append(...children);
    return el;
  }

  private iconButton(label: string, title: string, run: () => void): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.className = 'perf-btn';
    btn.textContent = label;
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.addEventListener('click', () => {
      run();
      // Don't leave a bar button holding focus: Space would then click it
      // again instead of reaching the transport hotkey.
      btn.blur();
    });
    return btn;
  }
}

function cssRgb(c: [number, number, number]): string {
  const b = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${b(c[0])}, ${b(c[1])}, ${b(c[2])})`;
}
