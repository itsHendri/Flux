import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { createFbo, deleteFbo, type Fbo, type FboFormat } from '../render/Framebuffer.ts';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import writeFrag from '../shaders/modes2d/spec-write.frag?raw';
import drawFrag from '../shaders/modes2d/spec-draw.frag?raw';

/**
 * SPECTROGRAM — the recent past, as a picture.
 *
 * Every other mode in FLUX shows the present: this frame's spectrum, this
 * frame's waveform. A spectrogram is the first thing here that **remembers** —
 * time is one of its axes, so a phrase leaves a shape, a held note is a
 * horizontal line, a kick is a vertical stripe, and a build visibly climbs.
 *
 * It's a ring buffer of columns. Each tick stamps one column with the current
 * spectrum (only that column is rasterised — the viewport is one pixel wide),
 * and the draw pass reads the ring backwards from the write head. No history
 * is ever copied or scrolled; the picture moves because the read mapping moves.
 */
const COLUMNS = 1024;
const ROWS = 512;
/**
 * Seconds per column, fixed rather than one-per-frame: tying the time axis to
 * the frame rate would make the same music scroll at different speeds on
 * different machines, and the axis would stop meaning anything.
 */
const SECONDS_PER_COLUMN = 1 / 120;

export class SpectrogramMode implements CustomMode {
  readonly name = 'spectro';

  private ctx: CustomModeContext | null = null;
  private writeProg: CompiledProgram | null = null;
  private drawProg: CompiledProgram | null = null;
  private history: Fbo | null = null;
  private fmt: FboFormat | null = null;

  private writeCol = 0;
  private accum = 0;
  private lastDraw = -1;

  init(ctx: CustomModeContext): boolean {
    const gl = ctx.gl;
    const writeProg = ctx.buildModeProgram(`${this.name}-write`, fullscreenVert, writeFrag);
    // The visible program takes the mode's own name.
    const drawProg = ctx.buildModeProgram(this.name, fullscreenVert, drawFrag);
    if (!writeProg || !drawProg) {
      for (const p of [writeProg, drawProg]) if (p) gl.deleteProgram(p.program);
      return false; // compile errors already on the overlay
    }
    this.disposePrograms();
    this.ctx = ctx;
    this.writeProg = writeProg;
    this.drawProg = drawProg;
    // 8-bit is enough — the analyser's own output is 8-bit — so unlike the
    // other simulation modes this one needs no float support at all and runs
    // anywhere WebGL2 does.
    this.fmt = { internalFormat: gl.RGBA8, format: gl.RGBA, type: gl.UNSIGNED_BYTE };
    return true;
  }

  private ensureHistory(): void {
    const ctx = this.ctx;
    if (!ctx || !this.fmt || this.history) return;
    const gl = ctx.gl;
    this.history = createFbo(gl, COLUMNS, ROWS, this.fmt);
    // texelFetch only, and a wrapped LINEAR fetch would blend the oldest
    // column into the newest across the ring's seam.
    gl.bindTexture(gl.TEXTURE_2D, this.history.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.history.framebuffer);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  draw(state: FrameState, _w: number, _h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.writeProg || !this.drawProg) return;
    const gl = ctx.gl;
    this.ensureHistory();
    if (!this.history) return;

    // Coming back to the mode after a detour shows whatever was in the buffer
    // from before, which reads as a jump cut. Start clean instead.
    if (this.lastDraw < 0 || state.time - this.lastDraw > 0.5) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.history.framebuffer);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      this.accum = 0;
    }
    this.lastDraw = state.time;

    // Stamp however many columns this frame is worth, so the scroll speed is
    // the same at 30 fps as at 144. Capped: a long stall shouldn't redraw the
    // whole buffer in one frame.
    this.accum += Math.min(state.dt, 0.25);
    let columns = Math.floor(this.accum / SECONDS_PER_COLUMN);
    this.accum -= columns * SECONDS_PER_COLUMN;
    columns = Math.min(columns, 16);

    if (columns > 0) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.history.framebuffer);
      gl.useProgram(this.writeProg.program);
      ctx.uploadFrameUniforms(this.writeProg, state);
      for (let i = 0; i < columns; i++) {
        this.writeCol = (this.writeCol + 1) % COLUMNS;
        // One-pixel-wide viewport: the fullscreen triangle only covers this
        // column, so a "frame" costs a column.
        gl.viewport(this.writeCol, 0, 1, ROWS);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }
    }

    ctx.rebindScene();
    gl.useProgram(this.drawProg.program);
    ctx.uploadFrameUniforms(this.drawProg, state);
    const u = (n: string) => gl.getUniformLocation(this.drawProg!.program, n);
    gl.uniform2f(u('uSpecSize'), COLUMNS, ROWS);
    gl.uniform1f(u('uWriteCol'), this.writeCol);
    gl.uniform1f(u('uWaterfall'), num(state.controls['uSpecWaterfall'], 0));
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.history.texture);
    gl.uniform1i(u('uHistory'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private disposePrograms(): void {
    if (!this.ctx) return;
    const gl = this.ctx.gl;
    for (const p of [this.writeProg, this.drawProg]) if (p) gl.deleteProgram(p.program);
    this.writeProg = this.drawProg = null;
  }

  dispose(): void {
    this.disposePrograms();
    if (this.ctx && this.history) deleteFbo(this.ctx.gl, this.history);
    this.history = null;
    this.writeCol = 0;
    this.accum = 0;
  }
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}
