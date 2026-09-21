/**
 * Discrete hits from a decaying pulse (`uBeat` / `uOnset` in AudioFrame).
 * Shared by the modes that count events rather than follow levels.
 */

/**
 * Turns the decaying onset pulse into discrete hits: a hit when the pulse
 * crosses `threshold`, then nothing until it has fallen back below the re-arm
 * level and a minimum gap has passed — so one drum hit is one node, not one per
 * frame of its decay.
 */
export class HitGate {
  private armed = true;
  private last = -Infinity;

  constructor(private readonly minGap = 0.09) {}

  reset(): void {
    this.armed = true;
    this.last = -Infinity;
  }

  update(pulse: number, time: number, threshold: number): boolean {
    if (pulse < threshold * 0.5) this.armed = true;
    if (this.armed && pulse >= threshold && time - this.last >= this.minGap) {
      this.armed = false;
      this.last = time;
      return true;
    }
    return false;
  }
}
