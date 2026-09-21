import { HitGate } from '../core/hitGate.ts';
import { TempoEstimator } from './tempo.ts';

/**
 * Where we are in the beat and the bar — predicted, not detected.
 *
 * `AudioFrame.beat` fires *after* a kick is heard; a picture driven by it is
 * always a little late and falls silent through a fill. This is a
 * phase-locked loop: a beat counter that runs on at the measured tempo between
 * kicks, and is pulled toward each kick it hears — gently once locked, so a
 * stray hit can't yank it, harder while it's still finding the beat. Being a
 * prediction, it lands *on* the beat, and keeps time through a fill or a
 * dropped kick.
 *
 * Locked means: a measured tempo, and the last several kicks landed close to
 * where the counter said beats would be. The lock drops after four bars
 * without a kick, and modes fall back to reacting.
 *
 * The bar is counted from the first kick heard, so its downbeat is a guess —
 * right for most dance music, where the first thing after silence is the one.
 */
const LOCK_KICKS = 4;
/** A kick within this fraction of a beat of the prediction counts as on time. */
const ON_TIME = 0.15;

export class BeatTracker {
  private readonly kicks = new HitGate(0.2);
  private tempo = new TempoEstimator();
  private time = 0;
  /** Beats since the first kick; fractional part = phase through the beat. */
  private beats = 0;
  private started = false;
  private onTime = 0;
  /** Highest whole beat reached; phase correction can nudge `beats` back. */
  private topBeat = 0;
  private lockedBeatCount = 0;
  private lockedBarCount = 0;
  /** The bar turn for shaders: see `barTurn`. */
  private turn = 0;

  /**
   * A new source: forget the beat, the tempo and the lock — a new track has
   * its own grid, and holding the old one would fire downbeats off it. The
   * locked counts keep climbing (modes compare them frame to frame; going
   * back to 0 would read as an event).
   */
  reset(): void {
    this.tempo = new TempoEstimator();
    this.kicks.reset();
    this.started = false;
    this.beats = 0;
    this.topBeat = 0;
    this.onTime = 0;
  }

  /**
   * Advance by `dt` seconds (real time — a predictor that loses time drifts
   * off the beat) with this frame's kick pulse.
   */
  update(dt: number, beat: number): void {
    this.time += dt;
    if (this.started) this.beats += dt / this.tempo.period;
    if (this.kicks.update(beat, this.time, 0.5)) {
      // After four bars of no kicks the grid is gone: the next kick heard is
      // a fresh start (the first thing after a breakdown is usually the one).
      if (this.started && this.tempo.since(this.time) > 16 * this.tempo.period) {
        this.started = false;
      }
      this.tempo.kick(this.time);
      if (!this.started) {
        this.started = true;
        this.beats = 0;
        this.topBeat = 0;
      } else {
        // How far this kick is from the nearest predicted beat, in beats.
        const err = Math.round(this.beats) - this.beats;
        this.beats += err * (this.locked ? 0.25 : 0.6);
        this.onTime = Math.abs(err) < ON_TIME ? Math.min(this.onTime + 1, 8) : Math.max(this.onTime - 2, 0);
      }
    }
    if (this.tempo.since(this.time) > 16 * this.tempo.period) this.onTime = 0;

    // Count beats and downbeats passed while locked. Counting the highest beat
    // reached (not the current floor) means a correction that nudges the
    // counter back across a beat can't count that beat twice.
    const whole = Math.floor(this.beats);
    while (this.started && whole > this.topBeat) {
      this.topBeat++;
      if (this.locked) {
        this.lockedBeatCount++;
        if (this.topBeat % 4 === 0) this.lockedBarCount++;
      }
    }
    // The bar turn: the locked downbeat count plus an ease into the next
    // downbeat, smoothed, so it never jumps — not when the lock arrives
    // late in a bar, not when it leaves mid-ease.
    const ease = this.locked ? smoothstep(0.75, 1, this.barPhase) : 0;
    const target = this.lockedBarCount + ease;
    this.turn += (target - this.turn) * (1 - Math.exp(-dt / 0.12));
  }

  /**
   * Downbeats passed while locked, as a smooth, never-jumping value that eases
   * into each downbeat — for anything that turns a step per bar.
   */
  get barTurn(): number {
    return this.turn;
  }

  /**
   * Beats passed while locked. A mode that acts on the beat compares this with
   * last frame's: a change is a beat, and it never changes while unlocked.
   */
  get lockedBeats(): number {
    return this.lockedBeatCount;
  }

  /** Downbeats passed while locked (see lockedBeats). */
  get lockedBars(): number {
    return this.lockedBarCount;
  }

  get locked(): boolean {
    return this.tempo.measured && this.onTime >= LOCK_KICKS;
  }

  get bpm(): number {
    return this.tempo.bpm;
  }

  /** 0 on the beat, rising to 1 just before the next. */
  get beatPhase(): number {
    return this.beats - Math.floor(this.beats);
  }

  /** 0 on the bar's first beat, rising to 1 just before the next bar. */
  get barPhase(): number {
    const b = this.beats / 4;
    return b - Math.floor(b);
  }

}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
