import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import gateFrag from '../shaders/modes2d/gate.frag?raw';
import { HitGate } from '../core/hitGate.ts';
import { beatCorrection, gatesPerBeat } from './gateLock.ts';

/**
 * GATE — falling through a corridor of gates (photism).
 *
 * The picture is one raymarched fullscreen pass (gate.frag); this class exists
 * for the two things a shader can't do. **Distance flown**: speed follows the
 * bass — or, locked to the beat, is steered so a gate passes on each beat —
 * and position is the integral of speed, so it's accumulated here and handed
 * over as uTravel. **Which gate a kick lit**: the next gate ahead at the
 * moment of the kick, remembered so it keeps glowing as you fly through it.
 */
export class GateMode implements CustomMode {
  readonly name = 'gate';

  private ctx: CustomModeContext | null = null;
  private prog: CompiledProgram | null = null;
  private travel = 0;
  private litGate = -1e6;
  private litAt = -1e6;
  private lastBar = 0;
  /** Set on entry: re-read the bar count without treating it as a downbeat. */
  private resync = true;
  /** Units per second, eased, so gaining or losing the lock doesn't lurch. */
  private speed = 1.2;
  private readonly kicks = new HitGate(0.15);

  init(ctx: CustomModeContext): boolean {
    const prog = ctx.buildModeProgram(this.name, fullscreenVert, gateFrag);
    if (!prog) return false;
    this.dispose();
    this.ctx = ctx;
    this.prog = prog;
    return true;
  }

  draw(state: FrameState, _w: number, _h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.prog) return;
    const gl = ctx.gl;
    const p = this.prog.program;
    const a = state.audio;

    const dt = Math.min(state.dt, 0.1);
    const speedCtl = num(state.controls['uGateSpeed'], 1);
    const spacing = num(state.controls['uGateSpacing'], 3);
    const locked = a.lock > 0.5;
    const onBar = a.barCount !== this.lastBar && !this.resync;
    this.lastBar = a.barCount;
    this.resync = false;

    let target: number;
    if (locked) {
      // On the beat: gates pass at a whole number per beat (Speed picks one
      // every other beat, one per beat, or two), and the flight is steered so
      // the camera crosses a gate exactly on the beat.
      const perBeat = gatesPerBeat(speedCtl);
      target = (perBeat * spacing * a.bpm) / 60;
      this.travel += beatCorrection(this.travel, spacing, a.barPhase * 4, perBeat, dt * this.speed);
    } else {
      // Reacting: a steady drift even in silence, pushed by the bass, surged
      // by a kick.
      target = speedCtl * (1.2 + a.bass * 4.5 + a.beat * 3);
    }
    this.speed += (target - this.speed) * (1 - Math.exp(-dt / 0.4));
    this.travel += dt * this.speed;

    // Light the next gate ahead: on each downbeat while locked, else on a kick.
    const kick = this.kicks.update(a.beat, state.time, 0.6);
    if (locked ? onBar : kick) {
      this.litGate = Math.floor(this.travel / spacing + 0.5) + 1;
      this.litAt = state.time;
    }

    gl.useProgram(p);
    ctx.uploadFrameUniforms(this.prog, state);
    gl.uniform1f(gl.getUniformLocation(p, 'uTravel'), this.travel);
    gl.uniform1f(gl.getUniformLocation(p, 'uLitGate'), this.litGate);
    gl.uniform1f(gl.getUniformLocation(p, 'uLitAge'), state.time - this.litAt);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Back to this mode: the downbeats that passed while away aren't events. */
  enter(): void {
    this.resync = true;
  }

  dispose(): void {
    if (this.ctx && this.prog) this.ctx.gl.deleteProgram(this.prog.program);
    this.prog = null;
  }
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}
