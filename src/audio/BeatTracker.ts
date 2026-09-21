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
  private readonly tempo = new TempoEstimator();
  private time = 0;
  /** Beats since the first kick; fractional part = phase through the beat. */
  private beats = 0;
  private started = false;
  private onTime = 0;

  /** Advance by `dt` seconds with this frame's kick pulse. */
  update(dt: number, beat: number): void {
    this.time += dt;
    if (this.started) this.beats += dt / this.tempo.period;
    if (this.kicks.update(beat, this.time, 0.5)) {
      this.tempo.kick(this.time);
      if (!this.started) {
        this.started = true;
        this.beats = 0;
      } else {
        // How far this kick is from the nearest predicted beat, in beats.
        const err = Math.round(this.beats) - this.beats;
        this.beats += err * (this.locked ? 0.25 : 0.6);
        this.onTime = Math.abs(err) < ON_TIME ? Math.min(this.onTime + 1, 8) : Math.max(this.onTime - 2, 0);
      }
    }
    if (this.tempo.since(this.time) > 16 * this.tempo.period) this.onTime = 0;
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

  /** Whole beats counted (for modes that act once per beat or bar). */
  get beatCount(): number {
    return Math.floor(this.beats);
  }
}
