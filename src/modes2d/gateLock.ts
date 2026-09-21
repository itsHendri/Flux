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
 * should be in the gate cycle given the beat phase, minus where it is, taken
 * the short way round, eased over a quarter second so a new lock glides in
 * rather than jumping.
 */
export function beatCorrection(
  travel: number,
  spacing: number,
  beatPhase: number,
  perBeat: number,
  dt: number,
): number {
  const want = (beatPhase * perBeat) % 1;
  const at = (((travel / spacing) % 1) + 1) % 1;
  let err = want - at;
  err -= Math.round(err);
  return err * spacing * Math.min(1, dt * 4);
}
