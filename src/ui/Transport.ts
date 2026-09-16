import { formatTime } from '../audio/files.ts';

export interface TransportCallbacks {
  /** A file was chosen through the button (the stage drop uses the same path). */
  onFile(file: File): void;
}

/** What the transport looks like right now — for a second view of it. */
export interface TransportState {
  loaded: boolean;
  playing: boolean;
  /** Formatted `m:ss / m:ss`. */
  readout: string;
  name: string;
}

/**
 * Transport for the file source: load, play/pause, scrub, time readout.
 *
 * Hidden until a file is attached — with the mic there is nothing to transport,
 * the visuals just react. The element does the real work; this is its face.
 * Updates run off the element's own events (`timeupdate` ≈ 4 Hz) rather than
 * the render loop, so nothing here can cost frames.
 */
export class Transport {
  private readonly section: HTMLElement;
  private readonly transport: HTMLElement;
  private readonly playBtn: HTMLButtonElement;
  private readonly seek: HTMLInputElement;
  private readonly readout: HTMLElement;
  private readonly loadBtn: HTMLButtonElement;
  private readonly fileInput: HTMLInputElement;
  private media: HTMLAudioElement | null = null;
  /** Listeners registered on the current element, dropped on detach. */
  private unbind: (() => void)[] = [];
  /** Mirrors of this transport elsewhere (the performance bar). */
  private readonly watchers: ((s: TransportState) => void)[] = [];
  private name = '';

  constructor(parent: HTMLElement, cb: TransportCallbacks) {
    this.section = document.createElement('div');
    this.section.className = 'section';
    this.section.innerHTML = '<h2>File</h2>';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'audio/*';
    fileInput.style.display = 'none';
    fileInput.addEventListener('change', () => {
      const file = fileInput.files?.[0];
      // Reset so re-picking the same file fires `change` again.
      fileInput.value = '';
      if (file) cb.onFile(file);
    });

    this.fileInput = fileInput;
    this.loadBtn = document.createElement('button');
    this.loadBtn.className = 'big-btn';
    this.loadBtn.textContent = 'load audio file';
    this.loadBtn.addEventListener('click', () => fileInput.click());

    // --- Transport row (hidden until something is loaded) ----------------
    const row = document.createElement('div');
    row.className = 'transport-row';

    this.playBtn = document.createElement('button');
    this.playBtn.className = 'transport-play';
    this.playBtn.title = 'Play / pause (Space)';
    this.playBtn.textContent = '▶';
    this.playBtn.addEventListener('click', () => this.toggle());

    this.readout = document.createElement('span');
    this.readout.className = 'transport-time';
    this.readout.textContent = '0:00 / 0:00';

    this.seek = document.createElement('input');
    this.seek.type = 'range';
    this.seek.min = '0';
    this.seek.max = '1';
    this.seek.step = '0.001';
    this.seek.value = '0';
    this.seek.className = 'transport-seek';
    this.seek.addEventListener('input', () => {
      if (!this.media) return;
      this.media.currentTime = Number(this.seek.value);
      this.paint();
    });

    row.append(this.playBtn, this.readout);
    this.transport = document.createElement('div');
    this.transport.className = 'transport';
    this.transport.style.display = 'none';
    this.transport.append(row, this.seek);

    this.section.append(this.loadBtn, fileInput, this.transport);
    parent.appendChild(this.section);
  }

  /** True once a file is loaded — the Space hotkey checks this. */
  get hasMedia(): boolean {
    return this.media !== null;
  }

  /**
   * Watch the transport. The performance bar shows the same play state as the
   * panel does, from one source of truth: the element.
   */
  watch(cb: (s: TransportState) => void): void {
    this.watchers.push(cb);
    cb(this.state());
  }

  private state(): TransportState {
    const media = this.media;
    return {
      loaded: media !== null,
      playing: media !== null && !media.paused,
      readout: this.readout.textContent ?? '0:00 / 0:00',
      name: this.name,
    };
  }

  /** Open the system file picker — the performance bar's file button. */
  openFilePicker(): void {
    this.fileInput.click();
  }

  /** Point the transport at a freshly created file source's element. */
  attach(media: HTMLAudioElement, name: string): void {
    this.detach();
    this.media = media;
    this.name = name;
    this.loadBtn.textContent = name;
    this.transport.style.display = '';

    const on = <K extends keyof HTMLMediaElementEventMap>(
      type: K,
      fn: () => void,
    ): void => {
      media.addEventListener(type, fn);
      this.unbind.push(() => media.removeEventListener(type, fn));
    };
    const paint = () => this.paint();
    on('loadedmetadata', paint);
    on('timeupdate', paint);
    on('play', paint);
    on('pause', paint);
    on('ended', paint);
    this.paint();
  }

  /** Forget the current element (it's about to be disposed, or swapped out). */
  detach(): void {
    for (const off of this.unbind) off();
    this.unbind = [];
    this.media = null;
    this.name = '';
    this.transport.style.display = 'none';
    this.loadBtn.textContent = 'load audio file';
    this.publish();
  }

  /** Play/pause — the button and the Space hotkey both land here. */
  toggle(): void {
    const media = this.media;
    if (!media) return;
    if (media.paused) void media.play().catch(() => {});
    else media.pause();
    this.paint();
  }

  /** Mirror the element's state into the widgets. */
  private paint(): void {
    const media = this.media;
    if (!media) return;
    const duration = Number.isFinite(media.duration) ? media.duration : 0;
    this.seek.max = String(duration || 1);
    this.seek.value = String(Math.min(media.currentTime, duration || media.currentTime));
    this.seek.disabled = duration === 0;
    this.readout.textContent = `${formatTime(media.currentTime)} / ${formatTime(duration)}`;
    this.playBtn.textContent = media.paused ? '▶' : '❚❚';
    this.playBtn.classList.toggle('active', !media.paused);
    this.publish();
  }

  private publish(): void {
    const s = this.state();
    for (const cb of this.watchers) cb(s);
  }
}
