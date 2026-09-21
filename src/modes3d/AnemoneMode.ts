import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { perspective, lookAt, type Vec3 } from '../render/math3d.ts';
import ringVert from '../shaders/modes3d/anemone.vert?raw';
import ringFrag from '../shaders/modes3d/anemone.frag?raw';

/** Rings per arm — and so the number of bands along each one. */
const RINGS = 28;

/**
 * ANEMONE — chains of rings from one point (photism).
 *
 * Arms leave a single centre, spread evenly over the sphere, and curl on slow
 * noise that grows toward the tips; each arm is a chain of rings, and ring *n*
 * answers to band *n*, so every arm is the spectrum read outward from the root
 * — bass swelling the body, hats flickering at the tips. A kick sends a swell
 * out along all of them at once.
 *
 * Nothing is stored: every ring's place is a function of (arm, ring, time) in
 * the vertex shader, drawn as an instanced quad with no buffers. Additive
 * light, no depth.
 */
export class AnemoneMode implements CustomMode {
  readonly name = 'anemone';

  private ctx: CustomModeContext | null = null;
  private prog: CompiledProgram | null = null;

  init(ctx: CustomModeContext): boolean {
    const prog = ctx.buildModeProgram(this.name, ringVert, ringFrag);
    if (!prog) return false;
    this.dispose();
    this.ctx = ctx;
    this.prog = prog;
    return true;
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.prog) return;
    const gl = ctx.gl;
    const p = this.prog.program;
    const arms = Math.round(num(state.controls['uAnemoneArms'], 14));

    const t = state.time * 0.08;
    const dist = 5.2 - 1.6 * num(state.controls['uScale'], 0.4);
    const eye: Vec3 = [Math.sin(t) * dist, 1.2 + Math.sin(state.time * 0.05), Math.cos(t) * dist];
    const proj = perspective(0.85, w / h, 0.05, 40);
    const view = lookAt(eye, [0, 0, 0]);

    // A dark field behind it, faintly lit from the centre.
    gl.clearColor(0.004, 0.005, 0.01, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(p);
    ctx.uploadFrameUniforms(this.prog, state);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uProj'), false, proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uView'), false, view);
    gl.uniform1i(gl.getUniformLocation(p, 'uRings'), RINGS);
    gl.uniform1i(gl.getUniformLocation(p, 'uArms'), arms);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, arms * RINGS);
    gl.disable(gl.BLEND);
  }

  dispose(): void {
    if (this.ctx && this.prog) this.ctx.gl.deleteProgram(this.prog.program);
    this.prog = null;
  }
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}
