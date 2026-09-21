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
/** A frame this long is a hitch (GC, a hidden tab), not a verdict on the GPU. */
const HITCH = 0.25;

export class FrameGovernor {
  private readonly frames: number[] = [];
  private slowFor = 0;
  private goodFor = 0;
  private settleLeft = 0;
  private upAfter: number;
  /** Time since the last step up, while it's still on probation; -1 if none. */
  private probeAge = -1;

  constructor(private readonly timing: GovernorTiming = DEFAULT_TIMING) {
    this.upAfter = timing.upAfter;
  }

  /** Forget the measurements (a new mode, a new setting), keep the backoff. */
  reset(): void {
    this.frames.length = 0;
    this.slowFor = 0;
    this.goodFor = 0;
    this.settleLeft = this.timing.settle;
    this.probeAge = -1;
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
    if (!(dt > 0) || dt > HITCH) return 0;
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

    this.slowFor = m > SLOW_FRAME ? this.slowFor + dt : 0;
    this.goodFor = m <= GOOD_FRAME ? this.goodFor + dt : 0;

    if (canDown && this.slowFor >= this.timing.downAfter) {
      if (this.probeAge >= 0) {
        // Stepping straight back down from a probe: it failed. Wait twice as
        // long before the next one, so a machine sitting right at the edge
        // settles instead of flapping between two settings.
        this.upAfter = Math.min(this.timing.maxUpAfter, this.upAfter * 2);
      }
      this.reset();
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
export function qualityLadder(options: number[] | null, ceiling: number | null): Rung[] {
  if (!options || options.length === 0 || ceiling === null) {
    return RENDER_SCALES.map((scale) => ({ quality: null, scale }));
  }
  // The top rung is exactly the user's value, whatever it is; below it, each
  // lower option in turn.
  const lower = options.filter((v) => v < ceiling).sort((a, b) => b - a);
  const rungs: Rung[] = [ceiling, ...lower].map((quality) => ({ quality, scale: 1 }));
  const floor = lower.length > 0 ? lower[lower.length - 1] : ceiling;
  for (const scale of RENDER_SCALES.slice(1)) rungs.push({ quality: floor, scale });
  return rungs;
}

export interface QualityHost {
  /** The quality lever for a mode: its uniform and option values, or null. */
  leverFor(mode: string): { glslName: string; options: number[] } | null;
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
  private lever: { glslName: string; options: number[] } | null = null;
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
    this.ladder = qualityLadder(this.lever?.options ?? null, this.ceiling);
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
export const QUALITY_LEVERS: Record<string, string> = {
  bulb: 'uBulbQuality',
  lattice: 'uLatticeQuality',
  fluid: 'uFluidDetail',
  reaction: 'uRdDetail',
  magneto: 'uParticles',
  trails3d: 'uParticles',
  forge: 'uForgeCount',
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
