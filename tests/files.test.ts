import { describe, it, expect } from 'vitest';
import { formatTime, isAudioFile, pickAudioFile } from '../src/audio/files.ts';

const f = (name: string, type = ''): { name: string; type: string } => ({ name, type });

describe('isAudioFile', () => {
  it('accepts anything the browser labels as audio', () => {
    expect(isAudioFile(f('track.mp3', 'audio/mpeg'))).toBe(true);
    expect(isAudioFile(f('loop.weird', 'audio/x-something'))).toBe(true);
  });

  it('falls back to the extension when the drop carries no MIME type', () => {
    expect(isAudioFile(f('set.wav'))).toBe(true);
    expect(isAudioFile(f('SET.FLAC'))).toBe(true);
    expect(isAudioFile(f('notes.txt'))).toBe(false);
  });

  it('rejects images and video regardless of extension', () => {
    expect(isAudioFile(f('logo.png', 'image/png'))).toBe(false);
    expect(isAudioFile(f('clip.mp4', 'video/mp4'))).toBe(false);
  });
});

describe('pickAudioFile', () => {
  it('takes the first playable file in a mixed drop', () => {
    const files = [f('readme.txt'), f('logo.png', 'image/png'), f('track.mp3', 'audio/mpeg')];
    expect(pickAudioFile(files)?.name).toBe('track.mp3');
  });

  it('returns null when nothing in the drop is audio', () => {
    expect(pickAudioFile([f('logo.png', 'image/png')])).toBeNull();
    expect(pickAudioFile([])).toBeNull();
  });
});

describe('formatTime', () => {
  it('prints m:ss with a padded seconds field', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(9)).toBe('0:09');
    expect(formatTime(75)).toBe('1:15');
    expect(formatTime(599.9)).toBe('9:59');
  });

  it('grows an hours field only when needed', () => {
    expect(formatTime(3599)).toBe('59:59');
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3725)).toBe('1:02:05');
  });

  it('reads 0:00 for an unknown duration rather than NaN', () => {
    expect(formatTime(NaN)).toBe('0:00');
    expect(formatTime(Infinity)).toBe('0:00');
    expect(formatTime(-5)).toBe('0:00');
  });
});
