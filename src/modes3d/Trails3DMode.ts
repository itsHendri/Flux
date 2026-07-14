import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { createFbo, deleteFbo, type Fbo, type FboFormat } from '../render/Framebuffer.ts';
import { perspective, lookAt, type Vec3 } from '../render/math3d.ts';
import simVert from '../shaders/modes3d/sim.vert?raw';
import curlGlsl from '../shaders/modes3d/curl.glsl?raw';
import initFrag from '../shaders/modes3d/trails3d-init.frag?raw';
import simFrag from '../shaders/modes3d/trails3d-sim.frag?raw';
import pointsVert from '../shaders/modes3d/trails3d.vert?raw';
import pointsFrag from '../shaders/modes3d/trails3d-points.frag?raw';

/**
 * TRAILS3D — the true-3D curl-noise particle mode (Phase 4; ported from the
 * spike, see spikes/curl-noise-3d.html and docs/REFERENCES.md for sources).
 *
 * Positions (xyz + age) live in a float texture ping-pong advanced by a
 * curl-noise sim pass each frame; points fetch their position by gl_VertexID
 * and draw additively behind a slow-orbiting camera into the scene FBO, so
 * the HDR post chain (bloom / trails / tonemap) composites everything.
 * Audio: bass deepens the flow, uBeat bursts the swarm radially, highs
 * sparkle the points. Controls: Particles (texture size — the perf story),
 * Flow, Turbulence, plus shared Scale (host size) and Gain.
 */
export class Trails3DMode implements CustomMode {
  readonly name = 'trails3d';

  private ctx: CustomModeContext | null = null;
  private init3: CompiledProgram | null = null;
  private sim: CompiledProgram | null = null;
  private points: CompiledProgram | null = null;

  // Mode-private uniform locations (outside the standard map).
  private simPositions: WebGLUniformLocation | null = null;
  private simDt: WebGLUniformLocation | null = null;
  private ptsPositions: WebGLUniformLocation | null = null;
  private ptsProj: WebGLUniformLocation | null = null;
  private ptsView: WebGLUniformLocation | null = null;
  private ptsTexSize: WebGLUniformLocation | null = null;

  // Position ping-pong (RGBA32F preferred, RGBA16F fallback).
  private read: Fbo | null = null;
  private write: Fbo | null = null;
  private texSize = 0;
  private simFmt: FboFormat | null = null;

  init(ctx: CustomModeContext): boolean {
    const gl = ctx.gl;
    const init3 = ctx.buildModeProgram(`${this.name}-init`, simVert, curlGlsl + initFrag);
    const sim = ctx.buildModeProgram(`${this.name}-sim`, simVert, curlGlsl + simFrag);
    const points = ctx.buildModeProgram(this.name, pointsVert, pointsFrag);
    if (!init3 || !sim || !points) {
      for (const p of [init3, sim, points]) if (p) gl.deleteProgram(p.program);
      return false; // compile errors already on the overlay
    }
    this.disposePrograms();
    this.ctx = ctx;
    this.init3 = init3;
    this.sim = sim;
    this.points = points;
    this.simPositions = gl.getUniformLocation(sim.program, 'uPositions');
    this.simDt = gl.getUniformLocation(sim.program, 'uDt3d');
    this.ptsPositions = gl.getUniformLocation(points.program, 'uPositions');
    this.ptsProj = gl.getUniformLocation(points.program, 'uProj');
    this.ptsView = gl.getUniformLocation(points.program, 'uView');
    this.ptsTexSize = gl.getUniformLocation(points.program, 'uTexSize');

    // Float sim targets: 32F for position precision, 16F where 32F isn't
    // renderable. No float at all -> the mode reports and stays unregistered.
    if (!this.simFmt) {
      this.simFmt = this.probeSimFormat(gl);
      if (!this.simFmt) {
        throw new Error('trails3d needs float render targets (EXT_color_buffer_float).');
      }
    }
    return true;
  }

  private probeSimFormat(gl: WebGL2RenderingContext): FboFormat | null {
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

  /** (Re)allocate + seed the ping-pong when the Particles control changes. */
  private ensureSim(size: number, state: FrameState): void {
    const ctx = this.ctx;
    if (!ctx || !this.simFmt || !this.init3) return;
    if (this.texSize === size && this.read && this.write) return;
    const gl = ctx.gl;
    if (this.read) deleteFbo(gl, this.read);
    if (this.write) deleteFbo(gl, this.write);
    this.read = createFbo(gl, size, size, this.simFmt);
    this.write = createFbo(gl, size, size, this.simFmt);
    // Data textures must be NEAREST: createFbo defaults to LINEAR, and RGBA32F
    // isn't filterable without OES_texture_float_linear — a LINEAR-filtered
    // 32F texture is sampling-incomplete and every texelFetch returns
    // (0,0,0,1), silently collapsing the whole sim (found the hard way).
    for (const f of [this.read, this.write]) {
      gl.bindTexture(gl.TEXTURE_2D, f.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.texSize = size;

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.read.framebuffer);
    gl.viewport(0, 0, size, size);
    gl.useProgram(this.init3.program);
    ctx.uploadFrameUniforms(this.init3, state);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sim || !this.points) return;
    const gl = ctx.gl;

    const sizeControl = state.controls['uParticles'];
    const size = typeof sizeControl === 'number' && sizeControl > 0 ? sizeControl : 256;
    this.ensureSim(size, state);
    if (!this.read || !this.write) return;

    // 1. Advance the sim one step (ping-pong).
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.write.framebuffer);
    gl.viewport(0, 0, this.texSize, this.texSize);
    gl.useProgram(this.sim.program);
    ctx.uploadFrameUniforms(this.sim, state);
    gl.uniform1f(this.simDt, Math.min(state.dt, 0.05));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.read.texture);
    gl.uniform1i(this.simPositions, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [this.read, this.write] = [this.write, this.read];

    // 2. Points → scene FBO through the orbiting camera.
    ctx.rebindScene();
    gl.clearColor(0.02, 0.023, 0.04, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(this.points.program);
    ctx.uploadFrameUniforms(this.points, state);
    const t = state.time;
    const eye: Vec3 = [
      Math.sin(t * 0.12) * 2.6,
      0.6 + Math.sin(t * 0.07) * 0.35,
      Math.cos(t * 0.12) * 2.6,
    ];
    gl.uniformMatrix4fv(this.ptsProj, false, perspective(0.9, w / h, 0.1, 20));
    gl.uniformMatrix4fv(this.ptsView, false, lookAt(eye, [0, 0, 0]));
    gl.uniform1i(this.ptsTexSize, this.texSize);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.read.texture);
    gl.uniform1i(this.ptsPositions, 0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE); // additive points read as light
    gl.drawArrays(gl.POINTS, 0, this.texSize * this.texSize);
    gl.disable(gl.BLEND);
  }

  private disposePrograms(): void {
    if (!this.ctx) return;
    const gl = this.ctx.gl;
    for (const p of [this.init3, this.sim, this.points]) if (p) gl.deleteProgram(p.program);
    this.init3 = this.sim = this.points = null;
  }

  dispose(): void {
    this.disposePrograms();
    if (this.ctx) {
      if (this.read) deleteFbo(this.ctx.gl, this.read);
      if (this.write) deleteFbo(this.ctx.gl, this.write);
    }
    this.read = this.write = null;
    this.texSize = 0;
  }
}
