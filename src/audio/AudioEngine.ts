import { AudioFrame, SILENT_FRAME } from '../core/state.ts';
import { EnvelopeFollower } from './EnvelopeFollower.ts';
import { analyseBands } from './bands.ts';
import type { AudioSource } from './sources.ts';

export interface AudioEngineOptions {
  fftSize?: number;
}

/**
 * Owns a single AudioContext and a single AnalyserNode. The current source is
 * swappable; everything downstream (analysis, smoothing) is identical no matter
 * where the audio came from.
 */
export class AudioEngine {
  private readonly ctx: AudioContext;
  private readonly analyser: AnalyserNode;
  private readonly freqData: Uint8Array<ArrayBuffer>;
  private readonly timeData: Uint8Array<ArrayBuffer>;

  private readonly envBass = new EnvelopeFollower();
  private readonly envMid = new EnvelopeFollower();
  private readonly envHigh = new EnvelopeFollower();
  private readonly envLevel = new EnvelopeFollower();

  private source: AudioSource | null = null;
  private frame: AudioFrame = SILENT_FRAME;

  constructor(opts: AudioEngineOptions = {}) {
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = opts.fftSize ?? 2048;
    // Near-zero: we do our own asymmetric smoothing in EnvelopeFollower.
    // The built-in smoothing is symmetric and would mute transients.
    this.analyser.smoothingTimeConstant = 0;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);
  }

  get context(): AudioContext {
    return this.ctx;
  }

  /** AudioContext starts suspended; must be resumed from a user gesture. */
  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume();
  }

  get currentLabel(): string | null {
    return this.source?.label ?? null;
  }

  /** Swap the input source. Disposes the previous one and rewires monitoring. */
  setSource(source: AudioSource): void {
    if (this.source) {
      this.source.node.disconnect();
      this.source.dispose();
    }
    this.analyser.disconnect();

    this.source = source;
    source.node.connect(this.analyser);
    // Monitored sources (file, test tone) also go to the speakers; live mic
    // does not, to avoid acoustic feedback.
    if (source.monitor) this.analyser.connect(this.ctx.destination);

    this.envBass.reset();
    this.envMid.reset();
    this.envHigh.reset();
    this.envLevel.reset();
  }

  /** Read the analyser, advance envelopes by `dt` seconds, snapshot the frame. */
  tick(dt: number): AudioFrame {
    if (!this.source) {
      this.frame = SILENT_FRAME;
      return this.frame;
    }
    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);

    const raw = analyseBands(
      this.freqData,
      this.timeData,
      this.ctx.sampleRate,
      this.analyser.fftSize,
    );
    this.frame = {
      bass: this.envBass.update(raw.bass, dt),
      mid: this.envMid.update(raw.mid, dt),
      high: this.envHigh.update(raw.high, dt),
      level: this.envLevel.update(raw.level, dt),
    };
    return this.frame;
  }

  /** Last snapshot — for consumers (e.g. meters) that read between ticks. */
  getFrame(): AudioFrame {
    return this.frame;
  }

  dispose(): void {
    if (this.source) this.source.dispose();
    this.analyser.disconnect();
    void this.ctx.close();
  }
}
