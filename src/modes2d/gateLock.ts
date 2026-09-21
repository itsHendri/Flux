/**
 * Gate's flight while locked to the beat: how many gates pass per beat, and
 * the nudge that steers the camera onto a gate exactly on the beat.
 */

/** Speed control → gates per beat: one every other beat, one, or two. */
export function gatesPerBeat(speedControl: number): number {
  return speedControl < 0.6 ? 0.5 : speedControl < 1.5 ? 1 : 2;
}

/**
 * The correction to add to distance flown this frame (units): where the flight
 * should be in the gate cycle, minus where it is, taken the short way round.
 *
 * `beatInBar` is the position in the bar in beats (0..4). Using the bar, not
 * the beat, is what makes half rate work: a gate every *other* beat needs to
 * know which beat of the pair it's on, which the beat phase alone can't say.
 *
 * Capped to a fraction of this frame's own travel (`step`), so the correction
 * can slow the flight or speed it up but never stop or reverse it — gaining
 * the lock, or a big error, glides in over a few beats instead of lurching.
 */
export function beatCorrection(
  travel: number,
  spacing: number,
  beatInBar: number,
  perBeat: number,
  step: number,
): number {
  const cycle = beatInBar * perBeat;
  const want = cycle - Math.floor(cycle);
  const at = (((travel / spacing) % 1) + 1) % 1;
  let err = want - at;
  err -= Math.round(err);
  const cap = Math.abs(step) * 0.6;
  return Math.max(-cap, Math.min(cap, err * spacing));
}
