import { describe, it, expect } from 'vitest';
import {
  AUDIO_TEX_WIDTH,
  findTrigger,
  packAudioTexture,
  packSpectrum,
  packWaveform,
  silentAudioTexture,
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
