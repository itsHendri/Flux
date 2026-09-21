import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import gateFrag from '../shaders/modes2d/gate.frag?raw';
import { HitGate } from '../core/hitGate.ts';

/**
 * GATE — falling through a corridor of gates (photism).
 *
 * The picture is one raymarched fullscreen pass (gate.frag); this class exists
 * for the two things a shader can't do. **Distance flown**: speed follows the
 * bass, and position is the integral of speed, so it's accumulated here and
 * handed over as uTravel. **Which gate a kick lit**: the next gate ahead at the
 * moment of the kick, remembered so it keeps glowing as you fly through it.
 */
export class GateMode implements CustomMode {
  readonly name = 'gate';

  private ctx: CustomModeContext | null = null;
  private prog: CompiledProgram | null = null;
  private travel = 0;
  private litGate = -1e6;
  private litAt = -1e6;
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

    // Units per second: a steady drift even in silence, pushed by the bass,
    // surged by a kick.
    const speed = num(state.controls['uGateSpeed'], 1);
    this.travel += Math.min(state.dt, 0.1) * speed * (1.2 + a.bass * 4.5 + a.beat * 3);

    const spacing = num(state.controls['uGateSpacing'], 3);
    if (this.kicks.update(a.beat, state.time, 0.6)) {
      // The next gate ahead of the camera — close enough to reach while it's lit.
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

  dispose(): void {
    if (this.ctx && this.prog) this.ctx.gl.deleteProgram(this.prog.program);
    this.prog = null;
  }
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}
