/**
 * Tempo from the gaps between kicks: the median of the recent ones, folded
 * into 80–160 bpm so a half-time or double-time kick pattern reads as the
 * same tempo. Median, not mean, so a missed kick or a fill doesn't drag it.
 * One implementation for everything that needs a tempo (PhraseClock,
 * BeatTracker).
 */
const MIN_BPM = 80;
const MAX_BPM = 160;
/** Tempo assumed until there are enough kicks to measure one. */
export const DEFAULT_PERIOD = 0.5;
const HISTORY = 16;

export class TempoEstimator {
  private readonly gaps: number[] = [];
  private lastKick = -Infinity;

  /** A kick at `time` (seconds). Gaps outside 0.2–2 s aren't a tempo. */
  kick(time: number): void {
    const gap = time - this.lastKick;
    this.lastKick = time;
    if (gap > 0.2 && gap < 2) {
      this.gaps.push(foldPeriod(gap));
      if (this.gaps.length > HISTORY) this.gaps.shift();
    }
  }

  /** True once enough kicks have been heard to measure a tempo. */
  get measured(): boolean {
    return this.gaps.length >= 4;
  }

  /** Seconds per beat (the default until a tempo is measured). */
  get period(): number {
    if (!this.measured) return DEFAULT_PERIOD;
    const s = [...this.gaps].sort((a, b) => a - b);
    return s[s.length >> 1];
  }

  get bpm(): number {
    return 60 / this.period;
  }

  /** Seconds since the last kick. */
  since(time: number): number {
    return time - this.lastKick;
  }
}

/** A gap between kicks as a beat period in 80–160 bpm, by halving or doubling. */
export function foldPeriod(gap: number): number {
  let p = gap;
  while (p > 60 / MIN_BPM) p /= 2;
  while (p < 60 / MAX_BPM) p *= 2;
  return p;
}
