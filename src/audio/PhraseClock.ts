import { HitGate } from '../core/hitGate.ts';

/**
 * When a phrase ends — the moment a set would change picture.
 *
 * Built on the kick pulse (`AudioFrame.beat`):
 *
 * - **Tempo** from inter-onset intervals: the median of the recent gaps
 *   between kicks, folded into 80–160 bpm so a half-time or double-time kick
 *   pattern reads as the same tempo. Median, not mean, so a missed kick or a
 *   fill doesn't drag it.
 * - **Phrases** every `bars` bars of 4/4 at that tempo, and the boundary is
 *   taken *on a kick*: once the phrase is due, the next kick ends it. That puts
 *   a change on the downbeat rather than wherever the clock happens to land.
 *   With no kick for a bar past due (a breakdown with no drums), it ends on
 *   time anyway.
 * - **Early boundaries** when the energy changes sharply — a drop, or the floor
 *   falling out into a breakdown — measured as a fast level average against a
 *   slow one, because that's where a DJ would change the picture regardless
 *   of the bar count.
 *
 * Pure and clock-driven, so it's tested without audio.
 */
const MIN_BPM = 80;
const MAX_BPM = 160;
/** Tempo assumed until there are enough kicks to measure one. */
const DEFAULT_PERIOD = 0.5;
const HISTORY = 16;

export class PhraseClock {
  private readonly kicks = new HitGate(0.2);
  private readonly gaps: number[] = [];
  private lastKick = -Infinity;
  private phraseStart = 0;
  private fast = 0;
  private slow = 0;
  private lastTime = -1;
  /** The energy rule fires once per change, then waits for the level to settle. */
  private energyArmed = true;
  private silent = true;

  /** Seconds per beat (the default until a tempo is measured). */
  get period(): number {
    if (this.gaps.length < 4) return DEFAULT_PERIOD;
    const s = [...this.gaps].sort((a, b) => a - b);
    return s[s.length >> 1];
  }

  /** True once enough kicks have been heard to measure a tempo. */
  get measured(): boolean {
    return this.gaps.length >= 4;
  }

  get bpm(): number {
    return 60 / this.period;
  }

  /** Bars since the current phrase began. */
  barsAt(time: number): number {
    return (time - this.phraseStart) / (this.period * 4);
  }

  /** Start counting a new phrase now (a manual change, or entering auto). */
  restart(time: number): void {
    this.phraseStart = time;
  }

  /**
   * Feed one frame. Returns true on the frame a phrase ends (the caller
   * changes picture); the next phrase starts counting from there.
   */
  update(time: number, beat: number, level: number, bars: number): boolean {
    if (this.lastTime < 0) {
      // Seed both averages from the first frame, or the fast one racing up
      // from zero would read as a drop two bars in.
      this.fast = this.slow = level;
      this.phraseStart = time;
    }
    const dt = this.lastTime < 0 ? 0 : Math.min(time - this.lastTime, 0.1);
    this.lastTime = time;
    // Energy: a 1 s and an 8 s average of the level.
    this.fast += (level - this.fast) * (1 - Math.exp(-dt / 1));
    this.slow += (level - this.slow) * (1 - Math.exp(-dt / 8));

    const kick = this.kicks.update(beat, time, 0.5);
    if (kick) {
      const gap = time - this.lastKick;
      this.lastKick = time;
      if (gap > 0.2 && gap < 2) {
        this.gaps.push(foldPeriod(gap));
        if (this.gaps.length > HISTORY) this.gaps.shift();
      }
    }

    // Silence isn't a set, and it doesn't count toward a phrase: a phrase
    // that aged through silence (before the music, or paused) would end the
    // moment sound arrived. The count and the energy averages start fresh
    // when it does.
    if (level < 0.01 && this.fast < 0.02) {
      this.silent = true;
      this.phraseStart = time;
      return false;
    }
    if (this.silent) {
      this.silent = false;
      this.fast = this.slow = level;
      this.phraseStart = time;
      this.energyArmed = true;
    }

    const elapsed = this.barsAt(time);
    // A sharp change of energy, at least two bars into the phrase — once per
    // change: a drop keeps the fast average climbing for a while, and without
    // re-arming it would fire again two bars later.
    if (this.slow > 0.03) {
      const ratio = this.fast / this.slow;
      if (!this.energyArmed && ratio > 0.8 && ratio < 1.25) this.energyArmed = true;
      if (this.energyArmed && elapsed >= 2 && (ratio > 1.8 || ratio < 0.45)) {
        this.energyArmed = false;
        return this.boundary(time);
      }
    }
    // Due: take it on the next kick, or a bar late with no kick at all.
    if (elapsed >= bars - 0.125 && kick) return this.boundary(time);
    if (elapsed >= bars + 1) return this.boundary(time);
    return false;
  }

  private boundary(time: number): boolean {
    this.phraseStart = time;
    return true;
  }
}

/** A gap between kicks as a beat period in 80–160 bpm, by halving or doubling. */
export function foldPeriod(gap: number): number {
  let p = gap;
  while (p > 60 / MIN_BPM) p /= 2;
  while (p < 60 / MAX_BPM) p *= 2;
  return p;
}
