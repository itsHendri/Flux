import { describe, it, expect } from 'vitest';
import { OnsetDetector } from '../src/audio/OnsetDetector.ts';

const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;
const BIN_COUNT = FFT_SIZE / 2;
const HZ_PER_BIN = SAMPLE_RATE / FFT_SIZE;
const DT = 1 / 60;

function spectrum(value: number): Uint8Array {
  return new Uint8Array(BIN_COUNT).fill(value);
}

/** A spectrum that is `value` only within [loHz, hiHz], quiet elsewhere. */
function bandSpectrum(value: number, loHz: number, hiHz: number, quiet = 8): Uint8Array {
  const s = new Uint8Array(BIN_COUNT).fill(quiet);
  for (let i = Math.floor(loHz / HZ_PER_BIN); i <= Math.ceil(hiHz / HZ_PER_BIN); i++) {
    s[i] = value;
  }
  return s;
}

/** Feed `n` frames of the same spectrum (warms up history; flux settles to 0). */
function warmUp(d: OnsetDetector, s: Uint8Array, n = 20): void {
  for (let i = 0; i < n; i++) d.update(s, DT, SAMPLE_RATE, FFT_SIZE);
}

describe('OnsetDetector', () => {
  it('stays silent on silence', () => {
    const d = new OnsetDetector();
    for (let i = 0; i < 60; i++) {
      expect(d.update(spectrum(0), DT, SAMPLE_RATE, FFT_SIZE)).toBe(0);
    }
  });

  it('does not trigger on a steady tone', () => {
    const d = new OnsetDetector();
    warmUp(d, spectrum(180), 60);
    expect(d.pulse).toBe(0);
  });

  it('fires a full pulse on a sudden broadband jump', () => {
    const d = new OnsetDetector();
    warmUp(d, spectrum(10));
    expect(d.update(spectrum(200), DT, SAMPLE_RATE, FFT_SIZE)).toBe(1);
  });

  it('decays exponentially after a hit', () => {
    const d = new OnsetDetector();
    warmUp(d, spectrum(10));
    d.update(spectrum(200), DT, SAMPLE_RATE, FFT_SIZE);
    let prev = 1;
    for (let i = 0; i < 10; i++) {
      const p = d.update(spectrum(200), DT, SAMPLE_RATE, FFT_SIZE);
      expect(p).toBeLessThan(prev);
      prev = p;
    }
    expect(prev).toBeGreaterThan(0); // still decaying, not snapped to 0
  });

  it('refractory gap blocks an immediate re-trigger', () => {
    const d = new OnsetDetector({ minGap: 0.12 });
    warmUp(d, spectrum(10));
    expect(d.update(spectrum(200), DT, SAMPLE_RATE, FFT_SIZE)).toBe(1);
    // Drop back to quiet, then jump again one frame later (~17 ms < 120 ms).
    d.update(spectrum(10), DT, SAMPLE_RATE, FFT_SIZE);
    const p = d.update(spectrum(200), DT, SAMPLE_RATE, FFT_SIZE);
    expect(p).toBeLessThan(1);
  });

  it('re-triggers once the refractory gap has passed', () => {
    const d = new OnsetDetector({ minGap: 0.12 });
    warmUp(d, spectrum(10));
    d.update(spectrum(200), DT, SAMPLE_RATE, FFT_SIZE);
    warmUp(d, spectrum(10), 20); // ~0.33 s of quiet
    expect(d.update(spectrum(200), DT, SAMPLE_RATE, FFT_SIZE)).toBe(1);
  });

  it('a bass-limited detector ignores high-band transients', () => {
    const bass = new OnsetDetector({ loHz: 20, hiHz: 250 });
    const full = new OnsetDetector();
    const quiet = spectrum(8);
    warmUp(bass, quiet);
    warmUp(full, quiet);
    const hat = bandSpectrum(220, 4000, 12000); // a hi-hat-ish transient
    expect(bass.update(hat, DT, SAMPLE_RATE, FFT_SIZE)).toBe(0);
    expect(full.update(hat, DT, SAMPLE_RATE, FFT_SIZE)).toBe(1);
  });

  it('reset clears history and pulse', () => {
    const d = new OnsetDetector();
    warmUp(d, spectrum(10));
    d.update(spectrum(200), DT, SAMPLE_RATE, FFT_SIZE);
    d.reset();
    expect(d.pulse).toBe(0);
    // Needs to warm up again before it can trigger.
    expect(d.update(spectrum(200), DT, SAMPLE_RATE, FFT_SIZE)).toBe(0);
  });
});
