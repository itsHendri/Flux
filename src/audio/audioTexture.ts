/**
 * The audio texture: the analyser's two buffers packed into the layout
 * shaders read.
 *
 * FLUX's six scalars (bass/mid/high/level/beat/onset) are *musical* — smoothed,
 * band-summed, opinionated. They can't draw a spectrum and they can't draw a
 * waveform. This is the raw material alongside them.
 *
 * The layout is **Shadertoy's**: a 512×2 single-channel texture, row 0 the FFT
 * spectrum and row 1 the time-domain waveform, both bytes over 0..1
 * (https://www.shadertoy.com/view/Xds3Rr). Copying the convention rather than
 * inventing one means an audio-reactive Shadertoy shader ports to a FLUX mode
 * with a uniform rename, which makes the biggest library of reference material
 * in this space usable.
 */

/** Texture width — one texel per spectrum bin and per waveform sample. */
export const AUDIO_TEX_WIDTH = 512;
/** Two rows: spectrum, then waveform. */
export const AUDIO_TEX_HEIGHT = 2;

/**
 * Fold the analyser's `frequencyBinCount` bins down to exactly 512 by
 * averaging each group — so the top octave survives instead of being cropped,
 * which cropping to the first 512 bins of a 2048-point FFT would do. Fewer
 * bins than 512 are stretched.
 */
export function packSpectrum(
  freq: Uint8Array,
  out: Uint8Array,
  width = AUDIO_TEX_WIDTH,
): void {
  const bins = freq.length;
  if (bins === 0) {
    out.fill(0, 0, width);
    return;
  }
  const group = bins / width;
  for (let x = 0; x < width; x++) {
    const start = Math.floor(x * group);
    const end = Math.min(bins, Math.max(start + 1, Math.floor((x + 1) * group)));
    let sum = 0;
    for (let i = start; i < end; i++) sum += freq[i];
    out[x] = Math.round(sum / (end - start));
  }
}

/**
 * Find a rising zero crossing to start the waveform window at.
 *
 * Byte time-domain data sits at 128 for silence. Without this the trace slides
 * sideways every frame, because the analyser's window has no relationship to
 * the signal's phase — the same thing a real oscilloscope's trigger fixes. We
 * only look inside the slack (`length - width`), so there are always `width`
 * samples left to copy, and fall back to 0 when nothing crosses (silence, DC,
 * or a period longer than the slack).
 */
export function findTrigger(time: Uint8Array, width = AUDIO_TEX_WIDTH): number {
  const limit = time.length - width;
  if (limit <= 0) return 0;
  for (let i = 1; i < limit; i++) {
    if (time[i - 1] < 128 && time[i] >= 128) return i;
  }
  return 0;
}

/** Copy `width` contiguous samples starting at the trigger. */
export function packWaveform(
  time: Uint8Array,
  out: Uint8Array,
  offset = 0,
  width = AUDIO_TEX_WIDTH,
): void {
  if (time.length === 0) {
    out.fill(128, offset, offset + width);
    return;
  }
  const start = findTrigger(time, width);
  for (let x = 0; x < width; x++) {
    out[offset + x] = time[Math.min(time.length - 1, start + x)];
  }
}

/** Fill the whole 512×2 buffer: spectrum row, then waveform row. */
export function packAudioTexture(
  freq: Uint8Array,
  time: Uint8Array,
  out: Uint8Array,
): void {
  packSpectrum(freq, out);
  packWaveform(time, out, AUDIO_TEX_WIDTH);
}

/** A silent texture: no spectrum, a flat waveform at the 128 midpoint. */
export function silentAudioTexture(): Uint8Array {
  const buf = new Uint8Array(AUDIO_TEX_WIDTH * AUDIO_TEX_HEIGHT);
  buf.fill(128, AUDIO_TEX_WIDTH);
  return buf;
}

// --- Stereo ----------------------------------------------------------------
// The texture above is mono: the analyser sees the source mixed down, which is
// all a spectrum or a waveform wants. A goniometer wants the opposite — left
// and right *separately*, sample-aligned — so stereo gets its own texture
// rather than a third row in Shadertoy's layout, which would break the ports
// that layout exists for.

/**
 * One texel per time-domain sample: the analyser's full 2048-sample window,
 * about 43 ms at 48 kHz — long enough for a goniometer to draw a shape rather
 * than a fragment of one.
 */
export const STEREO_TEX_WIDTH = 2048;
/** Two rows: left, then right. */
export const STEREO_TEX_HEIGHT = 2;

/**
 * Pack left and right into rows 0 and 1, **the same sample index in both** —
 * no trigger, because a goniometer plots L against R at each instant, and
 * shifting one channel against the other would draw phase that isn't there.
 * Floats rather than bytes: 256 levels across -1..1 leaves a quiet signal on a
 * visible grid of a dozen steps. A short channel pads with silence.
 */
export function packStereo(
  left: Float32Array,
  right: Float32Array,
  out: Float32Array,
  width = STEREO_TEX_WIDTH,
): void {
  for (let x = 0; x < width; x++) {
    out[x] = x < left.length ? left[x] : 0;
    out[width + x] = x < right.length ? right[x] : 0;
  }
}

/**
 * The correlation-meter reading: +1 when the channels move together (mono),
 * 0 when they're unrelated (wide), −1 when one is the other inverted (out of
 * phase — the reading that means a mix will cancel on a mono speaker).
 * Normalised cross-correlation at lag 0, which is what hardware meters show;
 * audio is near zero-mean, so the mean isn't removed. Silence reads as +1 —
 * nothing there is, trivially, mono.
 */
export function stereoCorrelation(left: Float32Array, right: Float32Array): number {
  const n = Math.min(left.length, right.length);
  let lr = 0;
  let ll = 0;
  let rr = 0;
  for (let i = 0; i < n; i++) {
    lr += left[i] * right[i];
    ll += left[i] * left[i];
    rr += right[i] * right[i];
  }
  const denom = Math.sqrt(ll * rr);
  // −80 dBFS RMS per channel: below this the reading is noise about noise.
  const floor = n * 1e-8;
  if (ll < floor || rr < floor || denom === 0) {
    // One channel silent and the other not is maximally *un*-mono-like to a
    // listener, but a mono source panned hard reads this way too, and the meter
    // convention is 0 — unrelated.
    return ll < floor && rr < floor ? 1 : 0;
  }
  return Math.max(-1, Math.min(1, lr / denom));
}

/** A silent stereo texture: both channels at 0. */
export function silentStereoTexture(): Float32Array {
  return new Float32Array(STEREO_TEX_WIDTH * STEREO_TEX_HEIGHT);
}
