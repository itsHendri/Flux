import type { FrameState } from '../core/state.ts';
import { buildProgram } from './shaderProgram.ts';
import { createFbo, resizeFbo, deleteFbo, type Fbo } from './Framebuffer.ts';
import vertSource from '../shaders/fullscreen.vert?raw';
import commonSource from '../shaders/common.glsl?raw';

/** A shader mode: a name and the source of its fragment `render()` function. */
export interface ShaderMode {
  name: string;
  fragSource: string;
}

/**
 * A post-processing pass. Like a mode, it provides a `vec3 render(vec2 uv)`
 * body — but it also gets the scene texture (`uSource`) and the previous frame's
 * final output (`uPrevFrame`, for feedback) bound as samplers. Passes run in an
 * ordered, individually-toggleable chain after the mode is drawn.
 */
export interface PostPass {
  name: string;
  fragSource: string;
}

export interface ShaderError {
  mode: string;
  log: string;
}

interface CompiledProgram {
  name: string;
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

const BUILTIN_UNIFORMS = ['uTime', 'uResolution', 'uBass', 'uMid', 'uHigh', 'uLevel'];
/** Sampler uniforms only post-passes declare. */
const PASS_SAMPLERS = ['uSource', 'uPrevFrame'];

/**
 * WebGL2 renderer with a multi-pass pipeline. The active mode renders into an
 * off-screen framebuffer; an ordered chain of toggleable post-passes then runs
 * across a ping-pong texture pair (so any pass can sample the previous pass, and
 * `uPrevFrame` exposes last frame's result for feedback effects). The final
 * texture is blitted to the screen. With an empty pass chain the mode's texture
 * is presented unchanged. Consumes only FrameState — no AudioEngine/UI knowledge.
 */
export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly canvas: HTMLCanvasElement;
  private readonly vao: WebGLVertexArrayObject;
  private readonly controlUniforms: string[];

  private readonly modes = new Map<string, CompiledProgram>();
  private current: CompiledProgram | null = null;

  // Post-pass registry — mirrors the mode registry. `passOrder` is the fixed
  // chain order; `enabled` selects which run this frame.
  private readonly passes = new Map<string, CompiledProgram>();
  private readonly passOrder: string[] = [];
  private readonly enabled = new Set<string>();

  // Render targets. `scene` holds the mode output; `ping`/`pong` are the
  // post-chain ping-pong pair; `history` keeps last frame's final output so
  // feedback passes can sample it via uPrevFrame.
  private scene: Fbo | null = null;
  private ping: Fbo | null = null;
  private pong: Fbo | null = null;
  private history: Fbo | null = null;
  private historyValid = false;

  private errorCb: (e: ShaderError) => void = () => {};
  private successCb: (mode: string) => void = () => {};

  /**
   * @param controlUniforms glslNames of every control-schema uniform. Declared
   *   in every program header (modes and passes) and uploaded each frame.
   */
  constructor(canvas: HTMLCanvasElement, controlUniforms: string[]) {
    this.canvas = canvas;
    this.controlUniforms = controlUniforms;
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      throw new Error('WebGL2 is not available in this browser.');
    }
    this.gl = gl;

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create vertex array object.');
    this.vao = vao;

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.errorCb({ mode: '*', log: 'WebGL context lost.' });
    });
  }

  /** Drawing-buffer size in device pixels. */
  get resolution(): [number, number] {
    return [this.canvas.width, this.canvas.height];
  }

  onError(cb: (e: ShaderError) => void): void {
    this.errorCb = cb;
  }

  /** Called when a program (re)compiles cleanly — used to clear stale errors. */
  onCompileSuccess(cb: (mode: string) => void): void {
    this.successCb = cb;
  }

  /** Control-uniform declarations shared by every mode and pass header. */
  private controlDecls(): string {
    return this.controlUniforms.map((n) => `uniform float ${n};`).join('\n');
  }

  /** Assemble a mode's full fragment source: header + common + mode body. */
  private composeMode(modeSource: string): string {
    const header = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 outColor;',
      ...BUILTIN_UNIFORMS.map((n) =>
        n === 'uResolution' ? `uniform vec2 ${n};` : `uniform float ${n};`,
      ),
      this.controlDecls(),
      commonSource,
    ].join('\n');
    // #line resets numbering so compile errors point at the mode file.
    return `${header}\n#line 1\n${modeSource}\nvoid main() {\n  outColor = vec4(render(vUv), 1.0);\n}\n`;
  }

  /**
   * Assemble a post-pass's full fragment source. Same header as a mode, plus the
   * sampler uniforms (`uSource` = previous stage, `uPrevFrame` = last frame).
   */
  private composePass(passSource: string): string {
    const header = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 outColor;',
      ...BUILTIN_UNIFORMS.map((n) =>
        n === 'uResolution' ? `uniform vec2 ${n};` : `uniform float ${n};`,
      ),
      ...PASS_SAMPLERS.map((n) => `uniform sampler2D ${n};`),
      this.controlDecls(),
      commonSource,
    ].join('\n');
    return `${header}\n#line 1\n${passSource}\nvoid main() {\n  outColor = vec4(render(vUv), 1.0);\n}\n`;
  }

  private compile(name: string, fragSource: string, samplers: string[]): CompiledProgram | null {
    const result = buildProgram(this.gl, vertSource, fragSource);
    if (!result.ok) {
      this.errorCb({ mode: name, log: result.log });
      return null;
    }
    const uniforms = new Map<string, WebGLUniformLocation | null>();
    for (const n of [...BUILTIN_UNIFORMS, ...samplers, ...this.controlUniforms]) {
      uniforms.set(n, this.gl.getUniformLocation(result.program, n));
    }
    return { name, program: result.program, uniforms };
  }

  /**
   * Compile a mode. On failure the error is reported and any previously
   * compiled version of this mode is kept, so the app stays running.
   */
  registerMode(mode: ShaderMode): boolean {
    const compiled = this.compile(mode.name, this.composeMode(mode.fragSource), []);
    if (!compiled) return false;

    const previous = this.modes.get(mode.name);
    if (previous) this.gl.deleteProgram(previous.program);
    this.modes.set(mode.name, compiled);
    if (this.current?.name === mode.name) this.current = compiled;
    this.successCb(mode.name);
    return true;
  }

  setMode(name: string): void {
    const mode = this.modes.get(name);
    if (!mode) {
      this.errorCb({ mode: name, log: `Mode "${name}" is not registered.` });
      return;
    }
    this.current = mode;
  }

  /**
   * Register a post-pass. Mirrors registerMode. New passes append to the chain
   * order (and start disabled); re-registering (e.g. HMR) keeps position.
   */
  registerPass(pass: PostPass): boolean {
    const compiled = this.compile(pass.name, this.composePass(pass.fragSource), PASS_SAMPLERS);
    if (!compiled) return false;

    const previous = this.passes.get(pass.name);
    if (previous) this.gl.deleteProgram(previous.program);
    this.passes.set(pass.name, compiled);
    if (!this.passOrder.includes(pass.name)) this.passOrder.push(pass.name);
    this.successCb(pass.name);
    return true;
  }

  /** Enable or disable a registered pass in the chain. */
  setPassEnabled(name: string, on: boolean): void {
    if (on) this.enabled.add(name);
    else this.enabled.delete(name);
  }

  isPassEnabled(name: string): boolean {
    return this.enabled.has(name);
  }

  /** Registered passes in chain order. */
  get passNames(): string[] {
    return [...this.passOrder];
  }

  /** Resize the drawing buffer (and render targets) to match the canvas. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.ensureTargets(w, h);
  }

  private ensureTargets(w: number, h: number): void {
    const gl = this.gl;
    if (!this.scene) {
      this.scene = createFbo(gl, w, h);
      this.ping = createFbo(gl, w, h);
      this.pong = createFbo(gl, w, h);
      this.history = createFbo(gl, w, h);
      return;
    }
    resizeFbo(gl, this.scene, w, h);
    resizeFbo(gl, this.ping!, w, h);
    resizeFbo(gl, this.pong!, w, h);
    resizeFbo(gl, this.history!, w, h);
    this.historyValid = false; // old contents are the wrong size
  }

  /** Upload builtins + control values shared by modes and passes. */
  private uploadFrameUniforms(prog: CompiledProgram, state: FrameState): void {
    const gl = this.gl;
    const u = prog.uniforms;
    gl.uniform1f(u.get('uTime') ?? null, state.time);
    gl.uniform2f(u.get('uResolution') ?? null, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.get('uBass') ?? null, state.audio.bass);
    gl.uniform1f(u.get('uMid') ?? null, state.audio.mid);
    gl.uniform1f(u.get('uHigh') ?? null, state.audio.high);
    gl.uniform1f(u.get('uLevel') ?? null, state.audio.level);
    for (const name of this.controlUniforms) {
      gl.uniform1f(u.get(name) ?? null, state.controls[name] ?? 0);
    }
  }

  private drawFullscreen(): void {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }

  /** Blit a source framebuffer's colour into a destination (null = screen). */
  private blit(src: Fbo, dst: Fbo | null, w: number, h: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, src.framebuffer);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, dst ? dst.framebuffer : null);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null);
  }

  render(state: FrameState): void {
    const gl = this.gl;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const mode = this.current;
    if (!mode || !this.scene) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0.04, 0.045, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, w, h);

    // 1. Mode → scene FBO.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.framebuffer);
    gl.useProgram(mode.program);
    this.uploadFrameUniforms(mode, state);
    this.drawFullscreen();

    // 2. Ordered, toggleable post-pass chain across the ping-pong pair.
    const chain = this.passOrder.filter((n) => this.enabled.has(n));
    let readFbo = this.scene;
    let writeFbo = this.ping!;

    for (const name of chain) {
      const pass = this.passes.get(name);
      if (!pass) continue;
      gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo.framebuffer);
      gl.useProgram(pass.program);
      this.uploadFrameUniforms(pass, state);
      // uSource = previous stage, on unit 0; uPrevFrame = last frame, on unit 1.
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readFbo.texture);
      gl.uniform1i(pass.uniforms.get('uSource') ?? null, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, (this.historyValid ? this.history! : this.scene).texture);
      gl.uniform1i(pass.uniforms.get('uPrevFrame') ?? null, 1);
      this.drawFullscreen();

      readFbo = writeFbo;
      writeFbo = readFbo === this.ping ? this.pong! : this.ping!;
    }

    // 3. Present final texture to the screen.
    this.blit(readFbo, null, w, h);

    // 4. Keep the final result as history for next frame's feedback passes.
    if (chain.length > 0) {
      this.blit(readFbo, this.history!, w, h);
      this.historyValid = true;
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    const gl = this.gl;
    for (const m of this.modes.values()) gl.deleteProgram(m.program);
    for (const p of this.passes.values()) gl.deleteProgram(p.program);
    this.modes.clear();
    this.passes.clear();
    if (this.scene) deleteFbo(gl, this.scene);
    if (this.ping) deleteFbo(gl, this.ping);
    if (this.pong) deleteFbo(gl, this.pong);
    if (this.history) deleteFbo(gl, this.history);
    gl.deleteVertexArray(this.vao);
  }
}
