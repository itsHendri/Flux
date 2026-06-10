import { createFbo, deleteFbo, type Fbo, type FboFormat } from './Framebuffer.ts';
import type { CompiledProgram } from './Renderer.ts';

/**
 * Mip-chain bloom (Jimenez, SIGGRAPH 2014 "Next Generation Post Processing in
 * Call of Duty: Advanced Warfare"; see also the LearnOpenGL "Phys. Based Bloom"
 * guest article). A pyramid of half-res FBOs: progressive 13-tap downsample
 * (Karis luma-weighted on the first mip to suppress fireflies), then a
 * progressive 3×3 tent upsample accumulated with additive blending, and a final
 * full-res composite. The glow's width tracks the pyramid, not the output
 * resolution — unlike the old fixed-radius separable Gaussian.
 *
 * This is the one pass whose execution doesn't fit the Renderer's full-res
 * ping-pong stage model, so the Renderer special-cases the pass named 'bloom'
 * to this pipeline. It still registers through `PASSES` (toggle, chain order,
 * control scoping, .frag HMR all work unchanged).
 */

export const MAX_BLOOM_LEVELS = 6;
export const MIN_BLOOM_DIM = 8;

/** Pyramid level sizes for a w×h source: level i is the source halved i+1
 *  times, capped at MAX_BLOOM_LEVELS and stopping before any level's smaller
 *  dimension would drop below MIN_BLOOM_DIM. Always returns ≥1 level. */
export function computeMipSizes(w: number, h: number): { w: number; h: number }[] {
  const sizes: { w: number; h: number }[] = [];
  let lw = w;
  let lh = h;
  while (sizes.length < MAX_BLOOM_LEVELS) {
    lw = Math.max(1, lw >> 1);
    lh = Math.max(1, lh >> 1);
    if (sizes.length > 0 && Math.min(lw, lh) < MIN_BLOOM_DIM) break;
    sizes.push({ w: lw, h: lh });
  }
  return sizes;
}

/** Stage order in the PASSES registry entry. */
const STAGE_NAMES = ['bloom-down', 'bloom-up', 'bloom-composite'];

export class BloomPipeline {
  private readonly gl: WebGL2RenderingContext;
  private readonly compile: (name: string, body: string) => CompiledProgram | null;

  private down: CompiledProgram | null = null;
  private up: CompiledProgram | null = null;
  private composite: CompiledProgram | null = null;
  // uFirstMip is declared inside bloom-down.frag's body (not the shared
  // header), so its location is resolved here rather than by the Renderer.
  private firstMipLoc: WebGLUniformLocation | null = null;

  private levels: Fbo[] = [];
  private levelsW = 0;
  private levelsH = 0;
  private levelsFmt: FboFormat | null = null;

  constructor(
    gl: WebGL2RenderingContext,
    compile: (name: string, body: string) => CompiledProgram | null,
  ) {
    this.gl = gl;
    this.compile = compile;
  }

  /**
   * (Re)compile the three stages from their sources [down, up, composite].
   * Mirrors Renderer.registerPass: on any failure the previous programs are
   * kept so the app (and HMR) stays running. Returns overall success.
   */
  register(sources: string[]): boolean {
    if (sources.length !== 3) return false;
    const compiled: CompiledProgram[] = [];
    for (let i = 0; i < 3; i++) {
      const prog = this.compile(STAGE_NAMES[i], sources[i]);
      if (!prog) return false; // error already reported; keep previous version
      compiled.push(prog);
    }
    for (const old of [this.down, this.up, this.composite]) {
      if (old) this.gl.deleteProgram(old.program);
    }
    [this.down, this.up, this.composite] = compiled;
    this.firstMipLoc = this.gl.getUniformLocation(this.down!.program, 'uFirstMip');
    return true;
  }

  get ready(): boolean {
    return this.down !== null && this.up !== null && this.composite !== null;
  }

  /** Lazily (re)allocate the pyramid for a w×h source — no VRAM while bloom is
   *  off, and resizes fall out of the size comparison. */
  private ensureLevels(w: number, h: number, fmt: FboFormat): void {
    if (this.levelsW === w && this.levelsH === h && this.levelsFmt === fmt) return;
    for (const l of this.levels) deleteFbo(this.gl, l);
    this.levels = computeMipSizes(w, h).map((s) => createFbo(this.gl, s.w, s.h, fmt));
    this.levelsW = w;
    this.levelsH = h;
    this.levelsFmt = fmt;
  }

  /**
   * Run the pyramid: srcTex (full-res chain texture) → dst FBO. The caller
   * provides uploadUniforms (frame builtins + control values) and is owed the
   * viewport restored to w×h and blending left disabled.
   */
  run(
    srcTex: WebGLTexture,
    dst: Fbo,
    w: number,
    h: number,
    fmt: FboFormat,
    uploadUniforms: (prog: CompiledProgram) => void,
  ): void {
    const gl = this.gl;
    if (!this.down || !this.up || !this.composite) return;
    this.ensureLevels(w, h, fmt);
    const levels = this.levels;

    const bindSource = (prog: CompiledProgram, tex: WebGLTexture) => {
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(prog.uniforms.get('uSource') ?? null, 0);
    };

    // 1. Progressive downsample: src → level 0 → level 1 → …
    gl.useProgram(this.down.program);
    uploadUniforms(this.down);
    for (let i = 0; i < levels.length; i++) {
      gl.uniform1f(this.firstMipLoc, i === 0 ? 1 : 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, levels[i].framebuffer);
      gl.viewport(0, 0, levels[i].width, levels[i].height);
      bindSource(this.down, i === 0 ? srcTex : levels[i - 1].texture);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // 2. Progressive tent upsample, accumulated additively onto the
    //    downsampled content each larger level already holds.
    gl.useProgram(this.up.program);
    uploadUniforms(this.up);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = levels.length - 2; i >= 0; i--) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, levels[i].framebuffer);
      gl.viewport(0, 0, levels[i].width, levels[i].height);
      bindSource(this.up, levels[i + 1].texture);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);

    // 3. Full-res composite into the chain: uScene = pass input, uSource =
    //    the finished pyramid top (LINEAR sampling does the final upsample).
    gl.bindFramebuffer(gl.FRAMEBUFFER, dst.framebuffer);
    gl.viewport(0, 0, w, h);
    gl.useProgram(this.composite.program);
    uploadUniforms(this.composite);
    bindSource(this.composite, levels[0].texture);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, srcTex);
    gl.uniform1i(this.composite.uniforms.get('uScene') ?? null, 2);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  dispose(): void {
    for (const p of [this.down, this.up, this.composite]) {
      if (p) this.gl.deleteProgram(p.program);
    }
    this.down = this.up = this.composite = null;
    for (const l of this.levels) deleteFbo(this.gl, l);
    this.levels = [];
    this.levelsW = this.levelsH = 0;
    this.levelsFmt = null;
  }
}
