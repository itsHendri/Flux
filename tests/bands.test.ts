import { describe, it, expect } from 'vitest';
import { analyseBands } from '../src/audio/bands.ts';

const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const BIN_COUNT = FFT_SIZE / 2;
const HZ_PER_BIN = SAMPLE_RATE / FFT_SIZE;

/** A flat (silent) time-domain buffer sits at the 128 midpoint. */
function silentTime(): Uint8Array {
  return new Uint8Array(FFT_SIZE).fill(128);
}

/** Fill the freq bins covering [loHz, hiHz] with `value` (0..255). */
function freqWithBand(loHz: number, hiHz: number, value: number): Uint8Array {
  const freq = new Uint8Array(BIN_COUNT);
  const lo = Math.floor(loHz / HZ_PER_BIN);
  const hi = Math.ceil(hiHz / HZ_PER_BIN);
  for (let i = lo; i <= hi && i < BIN_COUNT; i++) freq[i] = value;
  return freq;
}

describe('analyseBands', () => {
  it('reports near-zero for a silent frame', () => {
    const r = analyseBands(new Uint8Array(BIN_COUNT), silentTime(), SAMPLE_RATE, FFT_SIZE);
    expect(r.bass).toBe(0);
    expect(r.mid).toBe(0);
    expect(r.high).toBe(0);
    expect(r.level).toBe(0);
  });

  it('normalises a full-scale band to ~1', () => {
    const freq = freqWithBand(20, 250, 255); // bass range, max magnitude
    const r = analyseBands(freq, silentTime(), SAMPLE_RATE, FFT_SIZE);
    expect(r.bass).toBeGreaterThan(0.9);
  });

  it('routes energy to the correct band (bass vs high)', () => {
    const bassy = analyseBands(freqWithBand(20, 250, 255), silentTime(), SAMPLE_RATE, FFT_SIZE);
    expect(bassy.bass).toBeGreaterThan(bassy.high);

    const trebly = analyseBands(
      freqWithBand(2000, 16000, 255),
      silentTime(),
      SAMPLE_RATE,
      FFT_SIZE,
    );
    expect(trebly.high).toBeGreaterThan(trebly.bass);
  });

  it('keeps every band within 0..1', () => {
    const freq = new Uint8Array(BIN_COUNT).fill(255); // all bins maxed
    const r = analyseBands(freq, silentTime(), SAMPLE_RATE, FFT_SIZE);
    for (const v of [r.bass, r.mid, r.high, r.level]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('derives level from the time-domain waveform and clamps to 1', () => {
    // A loud square-ish wave: alternate extremes around the 128 midpoint.
    const time = new Uint8Array(FFT_SIZE);
    for (let i = 0; i < time.length; i++) time[i] = i % 2 === 0 ? 255 : 0;
    const r = analyseBands(new Uint8Array(BIN_COUNT), time, SAMPLE_RATE, FFT_SIZE);
    expect(r.level).toBe(1); // RMS ~1 * 3, clamped
  });
});
