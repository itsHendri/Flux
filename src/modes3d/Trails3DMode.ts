import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { perspective, lookAt, type Vec3 } from '../render/math3d.ts';
import vertSrc from '../shaders/modes3d/trails3d.vert?raw';
import fragSrc from '../shaders/modes3d/trails3d-points.frag?raw';

const POINT_COUNT = 4096;

/**
 * TRAILS3D — the first custom-draw (true 3D) mode. Task 4-2 state: an
 * attribute-less audio-breathing point sphere behind a slow-orbiting
 * perspective camera, drawn additively into the scene FBO so the whole HDR
 * post chain (bloom, trails, tonemap) composites it like any other mode.
 * Task 4-3 replaces the static sphere with GPGPU curl-noise advected
 * particles (see spikes/curl-noise-3d.html).
 */
export class Trails3DMode implements CustomMode {
  readonly name = 'trails3d';

  private ctx: CustomModeContext | null = null;
  private prog: CompiledProgram | null = null;
  // Mode-private uniforms (not in the standard map) — same pattern as
  // BloomPipeline's uFirstMip.
  private uProj: WebGLUniformLocation | null = null;
  private uView: WebGLUniformLocation | null = null;

  init(ctx: CustomModeContext): boolean {
    const prog = ctx.buildModeProgram(this.name, vertSrc, fragSrc);
    if (!prog) return false; // compile error already on the overlay
    if (this.prog && this.ctx) this.ctx.gl.deleteProgram(this.prog.program);
    this.ctx = ctx;
    this.prog = prog;
    this.uProj = ctx.gl.getUniformLocation(prog.program, 'uProj');
    this.uView = ctx.gl.getUniformLocation(prog.program, 'uView');
    return true;
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    const prog = this.prog;
    if (!ctx || !prog) return;
    const gl = ctx.gl;

    // Custom modes own their clear (fragment modes overwrite every pixel).
    gl.clearColor(0.02, 0.023, 0.04, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(prog.program);
    ctx.uploadFrameUniforms(prog, state);

    const t = state.time;
    const eye: Vec3 = [
      Math.sin(t * 0.12) * 2.6,
      0.6 + Math.sin(t * 0.07) * 0.35,
      Math.cos(t * 0.12) * 2.6,
    ];
    gl.uniformMatrix4fv(this.uProj, false, perspective(0.9, w / h, 0.1, 20));
    gl.uniformMatrix4fv(this.uView, false, lookAt(eye, [0, 0, 0]));

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive points read as light
    gl.drawArrays(gl.POINTS, 0, POINT_COUNT);
    gl.disable(gl.BLEND);
  }

  dispose(): void {
    if (this.prog && this.ctx) this.ctx.gl.deleteProgram(this.prog.program);
    this.prog = null;
  }
}
