import { describe, it, expect } from 'vitest';
import {
  AUDIO_TEX_WIDTH,
  findTrigger,
  packAudioTexture,
  packSpectrum,
  packWaveform,
  packStereo,
  silentAudioTexture,
  silentStereoTexture,
  stereoCorrelation,
  STEREO_TEX_WIDTH,
} from '../src/audio/audioTexture.ts';

describe('packSpectrum', () => {
  it('averages the analyser bins down to exactly 512', () => {
    const freq = new Uint8Array(1024);
    // Two bins per output texel: 0,2,4,... averages to 1,3,5,...
    for (let i = 0; i < freq.length; i++) freq[i] = i % 256;
    const out = new Uint8Array(AUDIO_TEX_WIDTH);
    packSpectrum(freq, out);
    expect(out[0]).toBe(Math.round((0 + 1) / 2));
    expect(out[1]).toBe(Math.round((2 + 3) / 2));
  });

  it('keeps the top of the range instead of cropping it', () => {
    // Energy only in the highest bins must still reach the last texels —
    // taking the first 512 bins of a 2048-point FFT would lose this entirely.
    const freq = new Uint8Array(1024);
    freq.fill(200, 1000);
    const out = new Uint8Array(AUDIO_TEX_WIDTH);
    packSpectrum(freq, out);
    expect(out[AUDIO_TEX_WIDTH - 1]).toBe(200);
    expect(out[0]).toBe(0);
  });

  it('stretches when there are fewer bins than texels', () => {
    const freq = new Uint8Array(128).fill(64);
    const out = new Uint8Array(AUDIO_TEX_WIDTH);
    packSpectrum(freq, out);
    expect([...out].every((v) => v === 64)).toBe(true);
  });

  it('degrades to silence on an empty analyser', () => {
    const out = new Uint8Array(AUDIO_TEX_WIDTH).fill(77);
    packSpectrum(new Uint8Array(0), out);
    expect([...out].every((v) => v === 0)).toBe(true);
  });
});

describe('findTrigger — the oscilloscope trigger', () => {
  /** A byte-domain sine of `period` samples, phase-shifted by `shift`. */
  function sine(length: number, period: number, shift = 0): Uint8Array {
    const t = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      t[i] = Math.round(128 + 120 * Math.sin((2 * Math.PI * (i + shift)) / period));
    }
    return t;
  }

  it('lands on a rising crossing of the 128 midpoint', () => {
    const t = sine(2048, 256, 10);
    const i = findTrigger(t);
    expect(t[i - 1]).toBeLessThan(128);
    expect(t[i]).toBeGreaterThanOrEqual(128);
  });

  it('puts the same phase at the start whatever the window offset', () => {
    // The point of the trigger: two shifted captures of one signal start at
    // the same place in the cycle, so the drawn trace doesn't slide.
    const a = sine(2048, 256, 0);
    const b = sine(2048, 256, 64);
    const fa = findTrigger(a);
    const fb = findTrigger(b);
    expect(Math.abs(a[fa] - b[fb])).toBeLessThanOrEqual(2);
    expect(Math.abs(a[fa + 40] - b[fb + 40])).toBeLessThanOrEqual(3);
  });

  it('falls back to 0 rather than running off the end', () => {
    expect(findTrigger(new Uint8Array(2048).fill(128))).toBe(0); // silence
    expect(findTrigger(new Uint8Array(256))).toBe(0); // shorter than a window
    expect(findTrigger(new Uint8Array(0))).toBe(0);
  });
});

describe('packWaveform', () => {
  it('copies a contiguous window from the trigger', () => {
    const t = new Uint8Array(2048);
    for (let i = 0; i < t.length; i++) t[i] = i < 100 ? 0 : 200;
    const out = new Uint8Array(AUDIO_TEX_WIDTH);
    packWaveform(t, out);
    expect(out[0]).toBe(t[findTrigger(t)]);
    expect(out[1]).toBe(t[findTrigger(t) + 1]);
  });

  it('writes a flat midpoint line when there is no data', () => {
    const out = new Uint8Array(AUDIO_TEX_WIDTH);
    packWaveform(new Uint8Array(0), out);
    expect([...out].every((v) => v === 128)).toBe(true);
  });
});

describe('the packed texture', () => {
  it('is spectrum then waveform, 512 wide and 2 tall', () => {
    const freq = new Uint8Array(1024).fill(90);
    const time = new Uint8Array(2048).fill(200);
    const buf = silentAudioTexture();
    expect(buf.length).toBe(AUDIO_TEX_WIDTH * 2);
    packAudioTexture(freq, time, buf);
    expect(buf[0]).toBe(90);
    expect(buf[AUDIO_TEX_WIDTH - 1]).toBe(90);
    expect(buf[AUDIO_TEX_WIDTH]).toBe(200);
  });

  it('starts silent: no spectrum, a flat waveform at the midpoint', () => {
    const buf = silentAudioTexture();
    expect(buf[0]).toBe(0);
    expect(buf[AUDIO_TEX_WIDTH]).toBe(128);
  });
});

describe('packStereo — left and right, sample-aligned', () => {
  const ramp = (n: number, k: number) => Float32Array.from({ length: n }, (_, i) => (i * k) / n);

  it('puts left in row 0 and right in row 1 at the same index', () => {
    const l = ramp(STEREO_TEX_WIDTH, 1);
    const r = ramp(STEREO_TEX_WIDTH, -1);
    const out = silentStereoTexture();
    packStereo(l, r, out);
    for (const i of [0, 1, 777, STEREO_TEX_WIDTH - 1]) {
      expect(out[i]).toBe(l[i]);
      expect(out[STEREO_TEX_WIDTH + i]).toBe(r[i]);
    }
  });

  it('keeps full float precision — a quiet signal is not quantised', () => {
    const l = new Float32Array(STEREO_TEX_WIDTH).fill(0.0013);
    const out = silentStereoTexture();
    packStereo(l, l, out);
    expect(out[5]).toBeCloseTo(0.0013, 7);
  });

  it('pads a short channel with silence', () => {
    const out = silentStereoTexture().fill(9);
    packStereo(new Float32Array(10).fill(0.5), new Float32Array(0), out);
    expect(out[9]).toBe(0.5);
    expect(out[10]).toBe(0);
    expect(out[STEREO_TEX_WIDTH]).toBe(0);
  });
});

describe('stereoCorrelation — the correlation meter', () => {
  const tone = (n: number, phase = 0, gain = 1) =>
    Float32Array.from({ length: n }, (_, i) => gain * Math.sin((2 * Math.PI * i) / 64 + phase));

  it('reads +1 for mono, whatever the level difference', () => {
    expect(stereoCorrelation(tone(2048), tone(2048, 0, 0.3))).toBeCloseTo(1, 5);
  });

  it('reads −1 for one channel inverted', () => {
    expect(stereoCorrelation(tone(2048), tone(2048, Math.PI))).toBeCloseTo(-1, 5);
  });

  it('reads ~0 for channels in quadrature (a wide, unrelated pair)', () => {
    expect(Math.abs(stereoCorrelation(tone(2048), tone(2048, Math.PI / 2)))).toBeLessThan(0.01);
  });

  it('reads 0 for a hard-panned signal and +1 for silence', () => {
    const silent = new Float32Array(2048);
    expect(stereoCorrelation(tone(2048), silent)).toBe(0);
    expect(stereoCorrelation(silent, silent)).toBe(1);
  });
});
