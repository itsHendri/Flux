/**
 * When forge breaks, and how far it has rebuilt since.
 *
 * A kick shatters the shape — but not every kick, or at 120 bpm it would never
 * finish assembling and the mode would be permanent debris. A shatter needs
 * the beat to cross a threshold (set by Shatter: higher is touchier), the
 * detector to have re-armed (fallen back below a low level since the last
 * one), and the shape to have mostly rebuilt. Pure and clock-driven so it can
 * be tested without a GPU.
 */
export interface ForgeTick {
  /** Outward impulse to apply this frame (0 on every frame but a shatter's). */
  impulse: number;
  /** Spring strength 0..1: 0 is free debris, 1 fully assembled. */
  pull: number;
  /** True on the frame a shatter happened (the caller moves to the next shape). */
  shattered: boolean;
}

/** Debris flies free for this long before the spring starts pulling. */
export const FLIGHT_SECONDS = 0.35;
/** …and the pull reaches full strength this long after the shatter. */
export const REBUILD_SECONDS = 1.9;

export class ForgeClock {
  private lastShatter = -Infinity;
  private armed = true;

  /** Forget the last shatter: the next frame starts a clean assembly. */
  reset(time: number): void {
    // Treat entry as a shatter with no impulse, so the first shape builds
    // from the seeded cloud on the same ramp a shatter uses.
    this.lastShatter = time - FLIGHT_SECONDS;
    this.armed = true;
  }

  /**
   * @param beat        the 0..1 decaying kick pulse
   * @param sensitivity 0..1, the Shatter control; 0 never shatters
   */
  update(beat: number, time: number, sensitivity: number): ForgeTick {
    const threshold = 1.02 - sensitivity * 0.62; // 1.02 = never, 0.4 = touchy
    const since = time - this.lastShatter;
    let shattered = false;
    if (beat < 0.25) this.armed = true;
    // "Mostly rebuilt": no shattering a shape that's still flying together.
    if (this.armed && beat > threshold && since > REBUILD_SECONDS * 0.8) {
      this.lastShatter = time;
      this.armed = false;
      shattered = true;
    }
    const t = time - this.lastShatter;
    const x = Math.min(1, Math.max(0, (t - FLIGHT_SECONDS) / (REBUILD_SECONDS - FLIGHT_SECONDS)));
    return {
      impulse: shattered ? 1 : 0,
      pull: x * x * (3 - 2 * x),
      shattered,
    };
  }
}
