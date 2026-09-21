/**
 * The performance governor: watch frame time, and step quality down when the
 * machine can't keep up — and back up when it can.
 *
 * Two parts. `FrameGovernor` is pure timing: it takes frame times and answers
 * "step down", "step up" or "hold", with the hysteresis that keeps it from
 * flapping. `QualityGovernor` owns what a step *means* for the mode on screen
 * (see `qualityLadder`) and writes it through callbacks, so neither needs a GPU
 * or a DOM to be tested.
 */

/** Frames slower than this (median) are "struggling": below ~48 fps. */
export const SLOW_FRAME = 1 / 48;
/**
 * Frames at least this fast (median) are "holding": ~55 fps or better. Not a
 * headroom test — on a vsync-capped 60 Hz display a frame never reports faster
 * than 16.7 ms however idle the GPU is — which is why stepping up is a probe
 * (see `FrameGovernor`).
 */
export const GOOD_FRAME = 1 / 55;

export type Step = -1 | 0 | 1;

export interface GovernorTiming {
  /** Seconds of sustained slow frames before stepping down. */
  downAfter: number;
  /** Seconds of sustained good frames before probing a step up. */
  upAfter: number;
  /** A step up that has to be undone within this long counts as failed. */
  probeWindow: number;
  /** Longest the up-wait can back off to after repeated failed probes. */
  maxUpAfter: number;
  /** Frames ignored after any step, while the new setting settles. */
  settle: number;
}

export const DEFAULT_TIMING: GovernorTiming = {
  downAfter: 1.2,
  upAfter: 5,
  probeWindow: 6,
  maxUpAfter: 120,
  settle: 0.5,
};

const WINDOW = 31;
/**
 * A frame this long, on its own, is a hitch (GC, a hidden tab), not a verdict
 * on the GPU. Several in a row are: a machine managing 3 fps is exactly the
 * one that needs help, and discarding every frame would leave it at the top.
 */
const HITCH = 0.25;
const HITCH_RUN = 3;
/**
 * A step down that improves the median frame by less than this was useless:
 * the frames were being held back by something other than the GPU — a 30 Hz
 * display, Energy Saver or Low Power Mode capping the frame rate.
 */
const USEFUL_GAIN = 0.08;

export class FrameGovernor {
  private readonly frames: number[] = [];
  private slowFor = 0;
  private goodFor = 0;
  private settleLeft = 0;
  private upAfter: number;
  /** Time since the last step up, while it's still on probation; -1 if none. */
  private probeAge = -1;
  private longRun = 0;
  /**
   * The median frame time before the last step down, while that step is being
   * judged; 0 when none is. See USEFUL_GAIN.
   */
  private judging = 0;
  /**
   * The slowest frame time learned to be a cap rather than a load (0 = none
   * known). Slow and good are judged relative to it, so a machine capped at
   * 30 fps isn't driven to the bottom rung chasing frames it can't have.
   */
  private floor = 0;

  constructor(private readonly timing: GovernorTiming = DEFAULT_TIMING) {
    this.upAfter = timing.upAfter;
  }

  /** Forget the measurements (a new setting), keep the backoff and the floor. */
  reset(): void {
    this.frames.length = 0;
    this.slowFor = 0;
    this.goodFor = 0;
    this.settleLeft = this.timing.settle;
    this.probeAge = -1;
    this.longRun = 0;
  }

  /**
   * A new mode: also forget the probe backoff, which a heavier mode may have
   * pushed to minutes, and any step still being judged. The frame-cap floor is
   * about the machine, so it stays.
   */
  resetForMode(): void {
    this.reset();
    this.upAfter = this.timing.upAfter;
    this.judging = 0;
  }

  /** The learned frame-cap floor in seconds (0 = none). */
  get capFloor(): number {
    return this.floor;
  }

  /** Median of the recent window, or 0 before there's enough to judge. */
  get median(): number {
    if (this.frames.length < 8) return 0;
    const s = [...this.frames].sort((a, b) => a - b);
    return s[s.length >> 1];
  }

  /** The current wait before a step-up probe (grows after failed probes). */
  get upWait(): number {
    return this.upAfter;
  }

  /**
   * Feed one frame. `canUp`/`canDown` say whether the ladder has room either
   * way. Returns the step to take now, if any.
   */
  update(dt: number, canUp: boolean, canDown: boolean): Step {
    if (!(dt > 0)) return 0;
    if (dt > HITCH) {
      // One long frame is a hitch; a run of them is the machine.
      if (++this.longRun < HITCH_RUN) return 0;
      dt = Math.min(dt, 1);
    } else {
      this.longRun = 0;
    }
    if (this.settleLeft > 0) {
      this.settleLeft -= dt;
      return 0;
    }
    this.frames.push(dt);
    if (this.frames.length > WINDOW) this.frames.shift();
    const m = this.median;
    if (m === 0) return 0;

    if (this.probeAge >= 0) {
      this.probeAge += dt;
      if (this.probeAge > this.timing.probeWindow) {
        // The probe held: the next one can come at the normal pace.
        this.probeAge = -1;
        this.upAfter = this.timing.upAfter;
      }
    }

    // Judge the last step down once there's a full window after it: if it
    // bought nothing, the frames are capped, not loaded. Undo it and learn the
    // cap, so neither this step nor the ones below it are taken again for it.
    if (this.judging > 0 && this.frames.length >= 16) {
      const before = this.judging;
      this.judging = 0;
      if (m > before * (1 - USEFUL_GAIN)) {
        this.floor = Math.max(this.floor, before);
        this.reset();
        return 1;
      }
    }
    // A median well under the floor means the cap has gone (Energy Saver off,
    // a faster display): stop excusing slow frames.
    if (this.floor > 0 && m < this.floor * 0.8) this.floor = 0;

    const slow = Math.max(SLOW_FRAME, this.floor * 1.2);
    const good = Math.max(GOOD_FRAME, this.floor * 1.1);
    this.slowFor = m > slow ? this.slowFor + dt : 0;
    this.goodFor = m <= good ? this.goodFor + dt : 0;

    if (canDown && this.slowFor >= this.timing.downAfter) {
      if (this.probeAge >= 0) {
        // Stepping straight back down from a probe: it failed. Wait twice as
        // long before the next one, so a machine sitting right at the edge
        // settles instead of flapping between two settings.
        this.upAfter = Math.min(this.timing.maxUpAfter, this.upAfter * 2);
      }
      const before = m;
      this.reset();
      this.judging = before;
      return -1;
    }
    if (canUp && this.goodFor >= this.upAfter) {
      this.reset();
      this.probeAge = 0;
      return 1;
    }
    return 0;
  }
}

/** One rung: the mode's own quality value (if it has a lever) and a render scale. */
export interface Rung {
  quality: number | null;
  scale: number;
}

/** Render scales to fall back on once a mode's own quality is at its floor. */
export const RENDER_SCALES = [1, 0.75, 0.5];

/**
 * The ladder for one mode, best first: the user's own value (their choice is
 * the ceiling; the governor only ever takes away), each lower option in turn,
 * then the lowest at smaller render scales. A mode with no quality lever has
 * just the scales.
 */
export function qualityLadder(
  options: number[] | null,
  ceiling: number | null,
  scaleFirst = false,
): Rung[] {
  if (!options || options.length === 0 || ceiling === null) {
    return RENDER_SCALES.map((scale) => ({ quality: null, scale }));
  }
  // The top rung is exactly the user's value, whatever it is; below it, each
  // lower option in turn.
  const lower = options.filter((v) => v < ceiling).sort((a, b) => b - a);
  const qualities = [ceiling, ...lower];
  const smallest = RENDER_SCALES[RENDER_SCALES.length - 1];
  if (scaleFirst) {
    // For a lever that reallocates a simulation (and so wipes it), spend the
    // resolution rungs first — they cost sharpness, not the pattern.
    return [
      ...RENDER_SCALES.map((scale) => ({ quality: ceiling, scale })),
      ...lower.map((quality) => ({ quality, scale: smallest })),
    ];
  }
  const rungs: Rung[] = qualities.map((quality) => ({ quality, scale: 1 }));
  const floor = qualities[qualities.length - 1];
  for (const scale of RENDER_SCALES.slice(1)) rungs.push({ quality: floor, scale });
  return rungs;
}

/** A mode's quality control, as the governor sees it. */
export interface Lever {
  glslName: string;
  /** Option values, any order; higher = costlier. */
  options: number[];
  /** Changing it reallocates (and wipes) the mode's simulation. */
  scaleFirst?: boolean;
}

export interface QualityHost {
  /** The quality lever for a mode, or null. */
  leverFor(mode: string): Lever | null;
  getValue(glslName: string): number;
  /** Write a quality value. The governor's own writes, not the user's. */
  setValue(glslName: string, v: number): void;
  setRenderScale(scale: number): void;
}

/**
 * Walks the active mode's ladder on the FrameGovernor's say-so. The user's
 * choice for a lever is its ceiling: when they (or a look, or MIDI) set it, the
 * governor starts again from the top of the new ladder. Switching Auto Quality
 * off puts everything back to that choice and stops.
 */
export class QualityGovernor {
  private readonly timing = new FrameGovernor();
  private mode = '';
  private ladder: Rung[] = [{ quality: null, scale: 1 }];
  private rung = 0;
  private lever: Lever | null = null;
  private ceiling: number | null = null;
  private enabled = true;
  private writing = false;

  constructor(private readonly host: QualityHost) {}

  /** Which rung is showing (0 = the user's own setting). */
  get level(): number {
    return this.rung;
  }

  get current(): Rung {
    return this.ladder[this.rung];
  }

  setMode(mode: string): void {
    if (mode === this.mode) return;
    // Leaving a mode hands its lever back at the user's setting.
    this.apply(0);
    this.mode = mode;
    this.lever = this.host.leverFor(mode);
    this.ceiling = this.lever ? this.host.getValue(this.lever.glslName) : null;
    this.timing.resetForMode();
    this.rebuild();
  }

  /** Call from the lever's change listener: tells the user's writes from ours. */
  onLeverChanged(glslName: string, v: number): void {
    if (this.writing || !this.lever || glslName !== this.lever.glslName) return;
    this.ceiling = v;
    this.rebuild();
  }

  setEnabled(on: boolean): void {
    if (on === this.enabled) return;
    this.enabled = on;
    if (!on) this.apply(0);
    this.timing.reset();
  }

  /**
   * The values as the user set them — the ceiling in place of whatever the
   * governor has stepped down to — so a preset saved mid-struggle doesn't
   * save the struggle.
   */
  userValues<T extends Record<string, number | number[]>>(values: T): T {
    if (!this.lever || this.ceiling === null) return values;
    return { ...values, [this.lever.glslName]: this.ceiling };
  }

  frame(dt: number): void {
    if (!this.enabled) return;
    const step = this.timing.update(dt, this.rung > 0, this.rung < this.ladder.length - 1);
    if (step !== 0) this.apply(this.rung - step);
  }

  private rebuild(): void {
    this.ladder = qualityLadder(this.lever?.options ?? null, this.ceiling, this.lever?.scaleFirst);
    this.rung = 0;
    this.apply(0);
    this.timing.reset();
  }

  private apply(rung: number): void {
    this.rung = Math.max(0, Math.min(this.ladder.length - 1, rung));
    const r = this.ladder[this.rung];
    if (this.lever && r.quality !== null && this.host.getValue(this.lever.glslName) !== r.quality) {
      this.writing = true;
      try {
        this.host.setValue(this.lever.glslName, r.quality);
      } finally {
        this.writing = false;
      }
    }
    this.host.setRenderScale(r.scale);
  }
}

/**
 * Which control is each mode's quality lever. Only select controls whose
 * option values rise with cost qualify; a mode missing here still gets the
 * render-scale rungs.
 */
export const QUALITY_LEVERS: Record<string, { glslName: string; scaleFirst: boolean }> = {
  // Stateless: the lever is the cheaper loss, so it goes first.
  bulb: { glslName: 'uBulbQuality', scaleFirst: false },
  lattice: { glslName: 'uLatticeQuality', scaleFirst: false },
  // Each of these reallocates its simulation when the lever moves.
  fluid: { glslName: 'uFluidDetail', scaleFirst: true },
  reaction: { glslName: 'uRdDetail', scaleFirst: true },
  magneto: { glslName: 'uParticles', scaleFirst: true },
  trails3d: { glslName: 'uParticles', scaleFirst: true },
  forge: { glslName: 'uForgeCount', scaleFirst: true },
  // Stateless — the dust is placed analytically — so fewer motes go first.
  wisp: { glslName: 'uWispDust', scaleFirst: false },
};

const PIN_KEY = 'flux.autoQuality';

/**
 * Auto Quality on/off, per machine. Deliberately not a control: controls travel
 * in presets and looks, and a look resets everything to its default, so
 * recalling one would silently switch a pinned governor back on. Whether this
 * machine needs help is a property of the machine, not of a look.
 */
export function loadAutoQuality(storage: Pick<Storage, 'getItem'> | null): boolean {
  try {
    return storage?.getItem(PIN_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveAutoQuality(storage: Pick<Storage, 'setItem'> | null, on: boolean): void {
  try {
    storage?.setItem(PIN_KEY, on ? 'on' : 'off');
  } catch {
    // Private mode or blocked storage: the setting just won't persist.
  }
}
