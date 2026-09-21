import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { createFbo, deleteFbo, type Fbo, type FboFormat } from '../render/Framebuffer.ts';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import initFrag from '../shaders/modes2d/rd-init.frag?raw';
import simFrag from '../shaders/modes2d/rd-sim.frag?raw';
import drawFrag from '../shaders/modes2d/rd-draw.frag?raw';

/**
 * REACTION — Gray-Scott reaction-diffusion, replacing the old `plasma`.
 *
 * Every other field mode in FLUX is an expression evaluated fresh each frame:
 * noise, warped, coloured. This one is a **simulation** — two chemicals on a
 * ping-pong buffer, where what you see now is the consequence of what was
 * there a second ago. Nothing draws the coral, worms or dividing cells; they
 * are what the equations do at a given feed/kill pair. That's why it earns
 * plasma's slot: `plasma` and `flow` were both domain-warped fbm and read as
 * the same thing.
 *
 * A fragment mode can't hold state, so this is a CustomMode: it owns its
 * buffers and steps them several times a frame (the chemistry needs many
 * small steps to move at a watchable rate), then draws the field into the
 * scene FBO for the usual HDR post chain.
 */
/** Detail control default, in simulation rows. */
const DEFAULT_DETAIL = 720;
/** The growth rate was tuned at this height; iteration counts scale from it. */
const REFERENCE_HEIGHT = 512;

export class ReactionMode implements CustomMode {
  readonly name = 'reaction';

  private ctx: CustomModeContext | null = null;
  private initProg: CompiledProgram | null = null;
  private sim: CompiledProgram | null = null;
  private draw3: CompiledProgram | null = null;

  // Mode-private uniforms (outside the standard control map).
  private uInitSize: WebGLUniformLocation | null = null;
  private uInitSeed: WebGLUniformLocation | null = null;
  private uSimState: WebGLUniformLocation | null = null;
  private uSimSize: WebGLUniformLocation | null = null;
  private uSimInject: WebGLUniformLocation | null = null;
  private uDrawState: WebGLUniformLocation | null = null;
  private uDrawSize: WebGLUniformLocation | null = null;

  private read: Fbo | null = null;
  private write: Fbo | null = null;
  private simW = 0;
  private simH = 0;
  private simFmt: FboFormat | null = null;
  /** Rising-edge latch: one injection per kick, not one per sim step. */
  private beatArmed = true;
  /** When this mode last drew — a gap means it was switched away from. */
  private lastDraw = -1;

  init(ctx: CustomModeContext): boolean {
    const gl = ctx.gl;
    const initProg = ctx.buildModeProgram(`${this.name}-init`, fullscreenVert, initFrag);
    const sim = ctx.buildModeProgram(`${this.name}-sim`, fullscreenVert, simFrag);
    const draw3 = ctx.buildModeProgram(this.name, fullscreenVert, drawFrag);
    if (!initProg || !sim || !draw3) {
      for (const p of [initProg, sim, draw3]) if (p) gl.deleteProgram(p.program);
      return false; // compile errors already on the overlay
    }
    this.disposePrograms();
    this.ctx = ctx;
    this.initProg = initProg;
    this.sim = sim;
    this.draw3 = draw3;
    this.uInitSize = gl.getUniformLocation(initProg.program, 'uSimSize');
    this.uInitSeed = gl.getUniformLocation(initProg.program, 'uSeed');
    this.uSimState = gl.getUniformLocation(sim.program, 'uState');
    this.uSimSize = gl.getUniformLocation(sim.program, 'uSimSize');
    this.uSimInject = gl.getUniformLocation(sim.program, 'uInject');
    this.uDrawState = gl.getUniformLocation(draw3.program, 'uState');
    this.uDrawSize = gl.getUniformLocation(draw3.program, 'uSimSize');

    if (!this.simFmt) {
      this.simFmt = this.probeSimFormat(gl);
      if (!this.simFmt) {
        throw new Error('reaction needs float render targets (EXT_color_buffer_float).');
      }
    }
    return true;
  }

  /**
   * 32F first: a Gray-Scott step moves concentrations by ~0.001, and half
   * float's spacing near 1.0 is about that same 0.001 — workable, but the
   * pattern creeps toward quantised edges. 16F is the fallback, not the plan.
   */
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

  /**
   * Allocate the pair and seed it. The sim is a fixed height with the screen's
   * aspect, so the pattern's cells stay round instead of stretching into ovals
   * on a wide display.
   */
  private ensureSim(w: number, h: number, state: FrameState): void {
    const ctx = this.ctx;
    if (!ctx || !this.simFmt || !this.initProg) return;
    const detail = state.controls['uRdDetail'];
    const simH = Math.round(typeof detail === 'number' && detail > 0 ? detail : DEFAULT_DETAIL);
    const aspect = w / Math.max(h, 1);
    const simW = Math.max(256, Math.min(2048, Math.round(simH * aspect)));
    // A width a texel or two off is the aspect's rounding moving (a render-
    // scale step, a sub-pixel resize), not a new size: keep the pattern.
    if (this.simH === simH && Math.abs(this.simW - simW) <= 2 && this.read && this.write) return;

    const gl = ctx.gl;
    if (this.read) deleteFbo(gl, this.read);
    if (this.write) deleteFbo(gl, this.write);
    this.read = createFbo(gl, simW, simH, this.simFmt);
    this.write = createFbo(gl, simW, simH, this.simFmt);
    // Data textures must be NEAREST — a LINEAR-filtered float texture is
    // sampling-incomplete without OES_texture_float_linear, and every fetch
    // silently returns (0,0,0,1). Learned on trails3d; the same trap here.
    for (const f of [this.read, this.write]) {
      gl.bindTexture(gl.TEXTURE_2D, f.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.simW = simW;
    this.simH = simH;
    this.seed(state);
  }

  /** Fill with chemical A and a scattering of B for the pattern to grow from. */
  private seed(state: FrameState): void {
    const ctx = this.ctx;
    if (!ctx || !this.initProg || !this.read) return;
    const gl = ctx.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.read.framebuffer);
    gl.viewport(0, 0, this.simW, this.simH);
    gl.useProgram(this.initProg.program);
    ctx.uploadFrameUniforms(this.initProg, state);
    gl.uniform2f(this.uInitSize, this.simW, this.simH);
    gl.uniform1f(this.uInitSeed, state.time);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.sim || !this.draw3) return;
    const gl = ctx.gl;

    this.ensureSim(w, h, state);
    if (!this.read || !this.write) return;

    // Coming back to this mode starts a fresh pattern rather than resuming the
    // one left behind. Two reasons: the growth is the interesting part and a
    // settled maze is the dull end of it, and at some feed/kill pairs the
    // reaction dies out entirely — without this, re-entering would leave a
    // black screen with no way to restart it.
    if (this.lastDraw < 0 || state.time - this.lastDraw > 0.5) {
      this.seed(state);
      this.beatArmed = true;
    }
    this.lastDraw = state.time;

    // One Euler step barely moves; the pattern needs many per frame to grow at
    // a watchable rate. This is the mode's perf story, like Particles is
    // trails3d's.
    // More detail means each cell is smaller on screen, so the same number of
    // steps grows the pattern visibly slower. Scaling iterations by the height
    // ratio keeps Growth meaning the same thing at every Detail setting.
    const iterControl = state.controls['uRdSpeed'];
    const growth = typeof iterControl === 'number' ? iterControl : 12;
    const iterations = Math.max(1, Math.round(growth * (this.simH / REFERENCE_HEIGHT)));

    // One spray per kick: latch on the way up, rearm when the pulse decays.
    const beat = state.audio.beat;
    let inject = 0;
    if (beat > 0.6 && this.beatArmed) {
      inject = 1;
      this.beatArmed = false;
    } else if (beat < 0.25) {
      this.beatArmed = true;
    }

    gl.useProgram(this.sim.program);
    ctx.uploadFrameUniforms(this.sim, state);
    gl.uniform2f(this.uSimSize, this.simW, this.simH);
    for (let i = 0; i < iterations; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.write.framebuffer);
      gl.viewport(0, 0, this.simW, this.simH);
      // Inject on the first step only — spraying on every one would flood it.
      gl.uniform1f(this.uSimInject, i === 0 ? inject : 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.read.texture);
      gl.uniform1i(this.uSimState, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      [this.read, this.write] = [this.write, this.read];
    }

    ctx.rebindScene();
    gl.useProgram(this.draw3.program);
    ctx.uploadFrameUniforms(this.draw3, state);
    gl.uniform2f(this.uDrawSize, this.simW, this.simH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.read.texture);
    gl.uniform1i(this.uDrawState, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private disposePrograms(): void {
    if (!this.ctx) return;
    const gl = this.ctx.gl;
    for (const p of [this.initProg, this.sim, this.draw3]) if (p) gl.deleteProgram(p.program);
    this.initProg = this.sim = this.draw3 = null;
  }

  dispose(): void {
    this.disposePrograms();
    if (this.ctx) {
      if (this.read) deleteFbo(this.ctx.gl, this.read);
      if (this.write) deleteFbo(this.ctx.gl, this.write);
    }
    this.read = this.write = null;
    this.simW = this.simH = 0;
  }
}
