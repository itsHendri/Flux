import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { createFbo, deleteFbo, type Fbo, type FboFormat } from '../render/Framebuffer.ts';
import { STEREO_TEX_WIDTH } from '../audio/audioTexture.ts';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import beamVert from '../shaders/modes2d/vector.vert?raw';
import beamFrag from '../shaders/modes2d/vector-beam.frag?raw';
import fadeFrag from '../shaders/modes2d/vector-fade.frag?raw';
import drawFrag from '../shaders/modes2d/vector-draw.frag?raw';

/**
 * VECTOR — left against right: the goniometer, or an X/Y oscilloscope.
 *
 * Every other mode reads the music as one signal. This one reads the space
 * between the speakers: plot each instant's left sample against its right, and
 * a mono signal is a line, a hard-panned one lies on an axis, a wide stereo pad
 * blooms into a cloud, and phase trouble shows up as a shape turning sideways.
 * In X/Y it's also an oscilloscope — "oscilloscope music" written for exactly
 * this display draws its pictures here.
 *
 * The beam is woscope's (m1el, github.com/m1el/woscope, MIT): a quad per
 * segment, a Gaussian spot integrated along it, energy per unit time so where
 * the beam lingers it burns. It lands in a phosphor buffer that fades in place
 * (a multiply-blend, no ping-pong) as an exponential moving average — the same
 * steady brightness at any persistence and any frame rate.
 */
export class VectorMode implements CustomMode {
  readonly name = 'vector';

  private ctx: CustomModeContext | null = null;
  private beamProg: CompiledProgram | null = null;
  private fadeProg: CompiledProgram | null = null;
  private drawProg: CompiledProgram | null = null;
  private phosphor: Fbo | null = null;
  private fmt: FboFormat | null = null;
  private size: [number, number] = [0, 0];
  private autoGain = 1;
  private lastDraw = -1;

  init(ctx: CustomModeContext): boolean {
    const gl = ctx.gl;
    const beamProg = ctx.buildModeProgram(`${this.name}-beam`, beamVert, beamFrag);
    const fadeProg = ctx.buildModeProgram(`${this.name}-fade`, fullscreenVert, fadeFrag);
    const drawProg = ctx.buildModeProgram(this.name, fullscreenVert, drawFrag);
    if (!beamProg || !fadeProg || !drawProg) {
      for (const p of [beamProg, fadeProg, drawProg]) if (p) gl.deleteProgram(p.program);
      return false;
    }
    this.disposePrograms();
    this.ctx = ctx;
    this.beamProg = beamProg;
    this.fadeProg = fadeProg;
    this.drawProg = drawProg;
    // The HDR format when there is one: thousands of overlapping segments
    // accumulate, and an 8-bit buffer would clip the hot core flat. It still
    // works in 8-bit, just with a harder edge.
    this.fmt = ctx.fboFormat;
    return true;
  }

  private ensurePhosphor(w: number, h: number): boolean {
    const ctx = this.ctx;
    if (!ctx || !this.fmt) return false;
    if (this.phosphor && this.size[0] === w && this.size[1] === h) return true;
    const gl = ctx.gl;
    if (this.phosphor) deleteFbo(gl, this.phosphor);
    this.phosphor = createFbo(gl, w, h, this.fmt);
    this.size = [w, h];
    this.clearPhosphor();
    return true;
  }

  private clearPhosphor(): void {
    if (!this.ctx || !this.phosphor) return;
    const gl = this.ctx.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.phosphor.framebuffer);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /**
   * Automatic gain, like a scope's AGC: a quiet signal shouldn't be a dot in
   * the middle of the screen. Up to 8× zoom, dropping fast when the signal
   * gets loud and recovering slowly, so a quiet bar doesn't pump.
   */
  private updateGain(stereo: Float32Array, dt: number): void {
    let peak = 0;
    for (let i = 0; i < stereo.length; i++) {
      const a = Math.abs(stereo[i]);
      if (a > peak) peak = a;
    }
    const target = 1 / Math.min(1, Math.max(peak, 1 / 8));
    const tau = target < this.autoGain ? 0.05 : 1.2;
    this.autoGain += (target - this.autoGain) * (1 - Math.exp(-Math.min(dt, 0.1) / tau));
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.beamProg || !this.fadeProg || !this.drawProg) return;
    if (!this.ensurePhosphor(w, h) || !this.phosphor) return;
    const gl = ctx.gl;

    // Back after a detour: start from a dark screen, not a stale trace.
    if (this.lastDraw < 0 || state.time - this.lastDraw > 0.5) {
      this.clearPhosphor();
      this.autoGain = 1;
    }
    this.lastDraw = state.time;
    this.updateGain(state.stereoTexture, state.dt);

    // Persistence 0..1 → a half-life from 5 ms (a sharp trace) to 0.6 s (a
    // long green smear). The fade and the new frame's weight are the two
    // halves of one moving average, so brightness doesn't depend on either
    // the setting or the frame rate.
    const persist = num(state.controls['uScopePersist'], 0.5);
    const halfLife = 0.005 * Math.pow(120, persist);
    const fade = Math.pow(0.5, Math.max(state.dt, 1 / 240) / halfLife);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.phosphor.framebuffer);
    gl.viewport(0, 0, w, h);
    gl.enable(gl.BLEND);

    // 1. Fade what's there: dst *= fade, then, on 8-bit buffers, dst -= a hair
    // (see vector-fade.frag — without it they never quite go dark).
    const fp = this.fadeProg.program;
    gl.useProgram(fp);
    gl.uniform1f(gl.getUniformLocation(fp, 'uFade'), fade);
    gl.uniform1f(gl.getUniformLocation(fp, 'uFloor'), 0);
    gl.blendFunc(gl.ZERO, gl.SRC_ALPHA);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (this.fmt?.type === gl.UNSIGNED_BYTE) {
      gl.uniform1f(gl.getUniformLocation(fp, 'uFloor'), 1.5 / 255);
      gl.blendEquation(gl.FUNC_REVERSE_SUBTRACT);
      gl.blendFunc(gl.ONE, gl.ONE);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.blendEquation(gl.FUNC_ADD);
    }

    // 2. Lay the new window of samples on top, additively.
    gl.blendFunc(gl.ONE, gl.ONE);
    const bp = this.beamProg.program;
    gl.useProgram(bp);
    ctx.uploadFrameUniforms(this.beamProg, state);
    gl.uniform1f(gl.getUniformLocation(bp, 'uAutoGain'), this.autoGain);
    gl.uniform1f(gl.getUniformLocation(bp, 'uFrameWeight'), (1 - fade) * 0.2);
    gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, STEREO_TEX_WIDTH - 1);
    gl.disable(gl.BLEND);

    // 3. Show it.
    ctx.rebindScene();
    const dp = this.drawProg.program;
    gl.useProgram(dp);
    ctx.uploadFrameUniforms(this.drawProg, state);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.phosphor.texture);
    gl.uniform1i(gl.getUniformLocation(dp, 'uPhosphor'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private disposePrograms(): void {
    if (!this.ctx) return;
    const gl = this.ctx.gl;
    for (const p of [this.beamProg, this.fadeProg, this.drawProg]) if (p) gl.deleteProgram(p.program);
    this.beamProg = this.fadeProg = this.drawProg = null;
  }

  dispose(): void {
    this.disposePrograms();
    if (this.ctx && this.phosphor) deleteFbo(this.ctx.gl, this.phosphor);
    this.phosphor = null;
    this.size = [0, 0];
  }
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}
