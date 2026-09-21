import { AudioFrame, SILENT_FRAME } from '../core/state.ts';
import { EnvelopeFollower } from './EnvelopeFollower.ts';
import { analyseBands } from './bands.ts';
import { OnsetDetector } from './OnsetDetector.ts';
import type { AudioSource } from './sources.ts';
import {
  AUDIO_TEX_WIDTH,
  packAudioTexture,
  packStereo,
  silentAudioTexture,
  silentStereoTexture,
  stereoCorrelation,
} from './audioTexture.ts';
import { SpectrumSmoother } from './SpectrumSmoother.ts';

export interface AudioEngineOptions {
  fftSize?: number;
}

/**
 * Owns a single AudioContext and its analysers. The current source is
 * swappable; everything downstream (analysis, smoothing) is identical no matter
 * where the audio came from.
 *
 * The main analyser sees the source mixed to mono — everything musical (bands,
 * beats, the spectrum) is read there. Beside it, a splitter feeds one analyser
 * per channel for the stereo picture (goniometer, width).
 */
export class AudioEngine {
  private readonly ctx: AudioContext;
  private readonly analyser: AnalyserNode;
  private readonly freqData: Uint8Array<ArrayBuffer>;
  private readonly timeData: Uint8Array<ArrayBuffer>;

  // Stereo: source → upmix → splitter → one analyser per channel. The upmix
  // is what makes a mono source (most microphones) arrive in *both* channels —
  // a splitter alone splits discretely, and a mono input would land in the
  // left only and draw as a hard-panned signal.
  private readonly stereoIn: GainNode;
  private readonly analyserL: AnalyserNode;
  private readonly analyserR: AnalyserNode;
  private readonly leftData: Float32Array<ArrayBuffer>;
  private readonly rightData: Float32Array<ArrayBuffer>;
  private readonly stereoTex = silentStereoTexture();
  // Width is a property of the mix, not a transient: slow both ways, or
  // every drum hit (near-mono in most mixes) would flick it toward zero.
  private readonly envWidth = new EnvelopeFollower(0.15, 0.4);

  private readonly envBass = new EnvelopeFollower();
  private readonly envMid = new EnvelopeFollower();
  private readonly envHigh = new EnvelopeFollower();
  private readonly envLevel = new EnvelopeFollower();

  // Spectral-flux transient detectors: beat = bass band (kick), onset = full
  // spectrum. Both emit decaying 0..1 pulses (see OnsetDetector).
  private readonly beatDetector = new OnsetDetector({ loHz: 20, hiHz: 250 });
  private readonly onsetDetector = new OnsetDetector();

  private source: AudioSource | null = null;
  private frame: AudioFrame = SILENT_FRAME;
  // The 512x2 spectrum+waveform texture data, refilled in place each tick —
  // one allocation for the life of the app rather than one per frame.
  private readonly audioTex = silentAudioTexture();
  // The spectrum row gets the same fast-attack/slow-release treatment the
  // bands get — raw FFT bytes flicker, and a flickering spectrum draws badly.
  private readonly spectrumSmoother = new SpectrumSmoother(AUDIO_TEX_WIDTH);

  constructor(opts: AudioEngineOptions = {}) {
    this.ctx = new AudioContext();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = opts.fftSize ?? 2048;
    // Near-zero: we do our own asymmetric smoothing in EnvelopeFollower.
    // The built-in smoothing is symmetric and would mute transients.
    this.analyser.smoothingTimeConstant = 0;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.timeData = new Uint8Array(this.analyser.fftSize);

    this.stereoIn = this.ctx.createGain();
    this.stereoIn.channelCount = 2;
    this.stereoIn.channelCountMode = 'explicit';
    this.stereoIn.channelInterpretation = 'speakers';
    const splitter = this.ctx.createChannelSplitter(2);
    this.stereoIn.connect(splitter);
    this.analyserL = this.ctx.createAnalyser();
    this.analyserR = this.ctx.createAnalyser();
    for (const [i, a] of [this.analyserL, this.analyserR].entries()) {
      a.fftSize = this.analyser.fftSize;
      a.smoothingTimeConstant = 0;
      splitter.connect(a, i);
    }
    this.leftData = new Float32Array(this.analyserL.fftSize);
    this.rightData = new Float32Array(this.analyserR.fftSize);
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
    source.node.connect(this.stereoIn);
    // A monitored source also goes to the speakers. A dropped file must be (once
    // its element is captured, the graph is its only route out); the live mic
    // must not be, or it would feed back through the room.
    if (source.monitor) this.analyser.connect(this.ctx.destination);

    this.envBass.reset();
    this.envMid.reset();
    this.envHigh.reset();
    this.envLevel.reset();
    this.envWidth.reset();
    this.stereoTex.fill(0);
    this.beatDetector.reset();
    this.onsetDetector.reset();
    this.spectrumSmoother.reset();
  }

  /**
   * The raw spectrum + waveform for shaders (512x2, Shadertoy's layout).
   * Refilled by `tick`; silent until a source is armed.
   */
  get textureData(): Uint8Array {
    return this.audioTex;
  }

  /**
   * Left and right waveforms for shaders (2048×2 floats, sample-aligned; see
   * `packStereo`). Refilled by `tick`; silent until a source is armed.
   */
  get stereoData(): Float32Array {
    return this.stereoTex;
  }

  /** Read the analyser, advance envelopes by `dt` seconds, snapshot the frame. */
  tick(dt: number): AudioFrame {
    if (!this.source) {
      this.frame = SILENT_FRAME;
      return this.frame;
    }
    this.analyserL.getFloatTimeDomainData(this.leftData);
    this.analyserR.getFloatTimeDomainData(this.rightData);
    packStereo(this.leftData, this.rightData, this.stereoTex);
    const correlation = stereoCorrelation(this.leftData, this.rightData);
    this.analyser.getByteFrequencyData(this.freqData);
    this.analyser.getByteTimeDomainData(this.timeData);
    packAudioTexture(this.freqData, this.timeData, this.audioTex);
    this.spectrumSmoother.update(this.audioTex.subarray(0, AUDIO_TEX_WIDTH), dt);

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
      width: this.envWidth.update(Math.max(0, Math.min(1, 1 - correlation)), dt),
      beat: this.beatDetector.update(this.freqData, dt, this.ctx.sampleRate, this.analyser.fftSize),
      onset: this.onsetDetector.update(
        this.freqData,
        dt,
        this.ctx.sampleRate,
        this.analyser.fftSize,
      ),
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
