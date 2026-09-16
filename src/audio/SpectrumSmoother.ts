/**
 * Per-bin envelope follower for the spectrum row of the audio texture.
 *
 * Raw FFT bytes flicker frame to frame — the analyser's own smoothing is
 * switched off (`smoothingTimeConstant = 0`) because it's symmetric and would
 * mute transients. This is the same asymmetric **fast-attack / slow-release**
 * shape `EnvelopeFollower` gives the bands, applied to all 512 bins: a peak
 * appears the instant it happens, then falls away smoothly, so bars rise on
 * the beat and settle rather than buzzing.
 */
export interface SpectrumSmootherOptions {
  /** Seconds to close most of the gap on the way up. Small = snappy. */
  attack?: number;
  /** Seconds to close most of the gap on the way down. Large = graceful. */
  release?: number;
}

export class SpectrumSmoother {
  private readonly value: Float32Array;
  private readonly attack: number;
  private readonly release: number;

  constructor(size: number, opts: SpectrumSmootherOptions = {}) {
    this.value = new Float32Array(size);
    this.attack = opts.attack ?? 0.012;
    this.release = opts.release ?? 0.22;
  }

  /** Smooth `input` (bytes) in place by `dt` seconds. Same array, filtered. */
  update(input: Uint8Array, dt: number): void {
    const n = Math.min(input.length, this.value.length);
    // Exponential approach, framerate-independent: the coefficient is the
    // fraction of the remaining gap closed this frame.
    const up = 1 - Math.exp(-dt / Math.max(this.attack, 1e-4));
    const down = 1 - Math.exp(-dt / Math.max(this.release, 1e-4));
    for (let i = 0; i < n; i++) {
      const target = input[i];
      const prev = this.value[i];
      const k = target > prev ? up : down;
      const next = prev + (target - prev) * k;
      this.value[i] = next;
      input[i] = next < 0 ? 0 : next > 255 ? 255 : Math.round(next);
    }
  }

  reset(): void {
    this.value.fill(0);
  }
}
