import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { createFbo, deleteFbo, type Fbo, type FboFormat } from '../render/Framebuffer.ts';
import { perspective, lookAt, type Vec3 } from '../render/math3d.ts';
import { ForgeClock } from './forgeClock.ts';
import simVert from '../shaders/modes3d/sim.vert?raw';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import studioGlsl from '../shaders/modes3d/studio.glsl?raw';
import shapesGlsl from '../shaders/modes3d/forge-shapes.glsl?raw';
import initFrag from '../shaders/modes3d/forge-init.frag?raw';
import velFrag from '../shaders/modes3d/forge-vel.frag?raw';
import posFrag from '../shaders/modes3d/forge-pos.frag?raw';
import beadVert from '../shaders/modes3d/forge.vert?raw';
import beadFrag from '../shaders/modes3d/forge-points.frag?raw';
import bgFrag from '../shaders/modes3d/forge-bg.frag?raw';

/** How many target shapes `shapeHome` knows (sphere, torus, knot, cube, helix). */
export const FORGE_SHAPES = 5;

/**
 * FORGE — a chrome swarm that builds a shape and breaks it apart (photism).
 *
 * Magneto's GPGPU rig (position + velocity ping-pong, stepped by two passes)
 * with a different law: every particle has a home on a target shape and an
 * underdamped spring pulling it there. A kick shatters it — one frame of
 * outward impulse, then the spring ramps back from nothing — and the debris
 * builds the *next* shape. ForgeClock decides which kicks count.
 *
 * Where magneto is light (additive points, no depth), forge is matter: each
 * particle is a chrome bead, a depth-tested point sprite shaded as a sphere
 * that reflects the same procedural studio as `chrome` — and the backdrop is
 * that studio too, so the beads mirror the room they're in.
 */
export class ForgeMode implements CustomMode {
  readonly name = 'forge';
  readonly needsDepth = true;

  private ctx: CustomModeContext | null = null;
  private initProg: CompiledProgram | null = null;
  private velProg: CompiledProgram | null = null;
  private posProg: CompiledProgram | null = null;
  private beadProg: CompiledProgram | null = null;
  private bgProg: CompiledProgram | null = null;

  private posRead: Fbo | null = null;
  private posWrite: Fbo | null = null;
  private velRead: Fbo | null = null;
  private velWrite: Fbo | null = null;
  private texSize = 0;
  private simFmt: FboFormat | null = null;

  private readonly clock = new ForgeClock();
  private shape = 0;
  private lastDraw = -1;

  init(ctx: CustomModeContext): boolean {
    const gl = ctx.gl;
    const sim = (frag: string) => `${shapesGlsl}\n${frag}`;
    const initProg = ctx.buildModeProgram(`${this.name}-init`, simVert, initFrag);
    const velProg = ctx.buildModeProgram(`${this.name}-vel`, simVert, sim(velFrag));
    const posProg = ctx.buildModeProgram(`${this.name}-pos`, simVert, posFrag);
    const beadProg = ctx.buildModeProgram(this.name, beadVert, `${studioGlsl}\n${beadFrag}`);
    const bgProg = ctx.buildModeProgram(`${this.name}-bg`, fullscreenVert, `${studioGlsl}\n${bgFrag}`);
    const all = [initProg, velProg, posProg, beadProg, bgProg];
    if (all.some((p) => !p)) {
      for (const p of all) if (p) gl.deleteProgram(p.program);
      return false; // compile errors already on the overlay
    }
    this.disposePrograms();
    this.ctx = ctx;
    [this.initProg, this.velProg, this.posProg, this.beadProg, this.bgProg] = all;

    if (!this.simFmt) {
      this.simFmt = probeFloatFormat(gl);
      if (!this.simFmt) throw new Error('forge needs float render targets (EXT_color_buffer_float).');
    }
    return true;
  }

  private ensureSim(size: number, state: FrameState): void {
    const ctx = this.ctx;
    if (!ctx || !this.simFmt || !this.initProg) return;
    if (this.texSize === size && this.posRead && this.velRead) return;
    const gl = ctx.gl;
    for (const f of [this.posRead, this.posWrite, this.velRead, this.velWrite]) if (f) deleteFbo(gl, f);
    this.posRead = createFbo(gl, size, size, this.simFmt);
    this.posWrite = createFbo(gl, size, size, this.simFmt);
    this.velRead = createFbo(gl, size, size, this.simFmt);
    this.velWrite = createFbo(gl, size, size, this.simFmt);
    // NEAREST: float textures aren't filterable everywhere (see MagnetoMode).
    for (const f of [this.posRead, this.posWrite, this.velRead, this.velWrite]) {
      gl.bindTexture(gl.TEXTURE_2D, f.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.texSize = size;
    this.seed(state);
  }

  /** Scatter the swarm into a loose cloud and start a fresh assembly. */
  private seed(state: FrameState): void {
    const ctx = this.ctx;
    if (!ctx || !this.initProg || !this.posRead || !this.velRead) return;
    const gl = ctx.gl;
    gl.useProgram(this.initProg.program);
    ctx.uploadFrameUniforms(this.initProg, state);
    gl.uniform2f(gl.getUniformLocation(this.initProg.program, 'uStateSize'), this.texSize, this.texSize);
    const isVel = gl.getUniformLocation(this.initProg.program, 'uIsVelocity');
    for (const [target, v] of [
      [this.posRead, 0],
      [this.velRead, 1],
    ] as const) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, this.texSize, this.texSize);
      gl.uniform1f(isVel, v);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    this.clock.reset(state.time);
  }

  /** Which shape to build: a fixed one, or the next in turn after each shatter. */
  private pickShape(control: number, shattered: boolean): void {
    if (control >= 0) {
      this.shape = Math.min(FORGE_SHAPES - 1, Math.round(control));
    } else if (shattered) {
      this.shape = (this.shape + 1) % FORGE_SHAPES;
    }
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.velProg || !this.posProg || !this.beadProg || !this.bgProg) return;
    const gl = ctx.gl;

    const size = num(state.controls['uForgeCount'], 128);
    this.ensureSim(size, state);
    if (!this.posRead || !this.posWrite || !this.velRead || !this.velWrite) return;
    // Back after a detour: build again from debris rather than resuming mid-air.
    if (this.lastDraw >= 0 && state.time - this.lastDraw > 0.5) this.seed(state);
    this.lastDraw = state.time;

    const tick = this.clock.update(state.audio.beat, state.time, num(state.controls['uForgeShatter'], 0.6));
    this.pickShape(num(state.controls['uForgeShape'], -1), tick.shattered);
    const step = Math.min(state.dt, 0.033);

    // 1. Velocity.
    const vp = this.velProg.program;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velWrite.framebuffer);
    gl.viewport(0, 0, this.texSize, this.texSize);
    gl.useProgram(vp);
    ctx.uploadFrameUniforms(this.velProg, state);
    gl.uniform1f(gl.getUniformLocation(vp, 'uStep'), step);
    gl.uniform1f(gl.getUniformLocation(vp, 'uShape'), this.shape);
    gl.uniform1f(gl.getUniformLocation(vp, 'uPull'), tick.pull);
    gl.uniform1f(gl.getUniformLocation(vp, 'uShatter'), tick.impulse * (0.6 + state.audio.bass * 0.8));
    gl.uniform1f(gl.getUniformLocation(vp, 'uSpin'), state.time * 0.25);
    this.bindState(vp, 'uPosTex', 'uVelTex');
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [this.velRead, this.velWrite] = [this.velWrite, this.velRead];

    // 2. Position.
    const pp = this.posProg.program;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.posWrite.framebuffer);
    gl.viewport(0, 0, this.texSize, this.texSize);
    gl.useProgram(pp);
    ctx.uploadFrameUniforms(this.posProg, state);
    gl.uniform1f(gl.getUniformLocation(pp, 'uStep'), step);
    this.bindState(pp, 'uPosTex', 'uVelTex');
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [this.posRead, this.posWrite] = [this.posWrite, this.posRead];

    // Camera: a slow orbit, a little above the equator.
    const t = state.time * 0.11;
    const dist = 5.0 - 1.4 * num(state.controls['uScale'], 0.4);
    const eye: Vec3 = [Math.sin(t) * dist, 0.9 + Math.sin(state.time * 0.07) * 0.5, Math.cos(t) * dist];
    const fovY = 0.8;
    const proj = perspective(fovY, w / h, 0.1, 40);
    const view = lookAt(eye, [0, 0, 0]);

    // 3. Backdrop: the studio through the same camera.
    ctx.rebindScene();
    gl.clear(gl.DEPTH_BUFFER_BIT);
    const bp = this.bgProg.program;
    gl.useProgram(bp);
    ctx.uploadFrameUniforms(this.bgProg, state);
    gl.uniform3f(gl.getUniformLocation(bp, 'uCamRight'), view[0], view[4], view[8]);
    gl.uniform3f(gl.getUniformLocation(bp, 'uCamUp'), view[1], view[5], view[9]);
    gl.uniform3f(gl.getUniformLocation(bp, 'uCamFwd'), -view[2], -view[6], -view[10]);
    gl.uniform1f(gl.getUniformLocation(bp, 'uTanHalfFov'), Math.tan(fovY / 2));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 4. Beads, depth-tested: opaque metal, so nearer beads hide farther ones.
    const dp = this.beadProg.program;
    gl.useProgram(dp);
    ctx.uploadFrameUniforms(this.beadProg, state);
    gl.uniformMatrix4fv(gl.getUniformLocation(dp, 'uProj'), false, proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(dp, 'uView'), false, view);
    gl.uniform1i(gl.getUniformLocation(dp, 'uTexSize'), this.texSize);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posRead.texture);
    gl.uniform1i(gl.getUniformLocation(dp, 'uPositions'), 0);
    gl.enable(gl.DEPTH_TEST);
    gl.drawArrays(gl.POINTS, 0, this.texSize * this.texSize);
    gl.disable(gl.DEPTH_TEST);
  }

  private bindState(prog: WebGLProgram, posName: string, velName: string): void {
    const gl = this.ctx!.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posRead!.texture);
    gl.uniform1i(gl.getUniformLocation(prog, posName), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velRead!.texture);
    gl.uniform1i(gl.getUniformLocation(prog, velName), 1);
  }

  private disposePrograms(): void {
    if (!this.ctx) return;
    const gl = this.ctx.gl;
    for (const p of [this.initProg, this.velProg, this.posProg, this.beadProg, this.bgProg]) {
      if (p) gl.deleteProgram(p.program);
    }
    this.initProg = this.velProg = this.posProg = this.beadProg = this.bgProg = null;
  }

  dispose(): void {
    this.disposePrograms();
    if (this.ctx) {
      for (const f of [this.posRead, this.posWrite, this.velRead, this.velWrite]) {
        if (f) deleteFbo(this.ctx.gl, f);
      }
    }
    this.posRead = this.posWrite = this.velRead = this.velWrite = null;
    this.texSize = 0;
  }
}

/** The first float format the GPU can render into, or null. */
export function probeFloatFormat(gl: WebGL2RenderingContext): FboFormat | null {
  for (const fmt of [
    { internalFormat: gl.RGBA32F, format: gl.RGBA, type: gl.FLOAT },
    { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT },
  ]) {
    try {
      const probe = createFbo(gl, 4, 4, fmt);
      gl.bindFramebuffer(gl.FRAMEBUFFER, probe.framebuffer);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      deleteFbo(gl, probe);
      if (ok) return fmt;
    } catch {
      // try the next format
    }
  }
  return null;
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}
