/**
 * The music's own clock. `uTime` runs at one second per second whatever is
 * playing; `uDrive` runs at the music's pace — fast through a loud, punchy
 * passage, crawling through a quiet one, stopped in silence. A shader that
 * moves by `uDrive` (a zoom, a flight, a scroll) moves *with* the track, which
 * `uTime * (1 + uBass)` can't do: that jumps backwards whenever the bass drops,
 * because it scales the whole of elapsed time rather than the current step.
 * Integration is the difference, and it has to happen on the CPU.
 */

/** Drive per second for one frame's analysis (all inputs 0..1). */
export function driveRate(bass: number, level: number, beat: number): number {
  return bass * 1.4 + level * 0.6 + beat * 1.2;
}
