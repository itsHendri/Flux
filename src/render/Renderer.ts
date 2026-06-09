import type { FrameState } from '../core/state.ts';
import { buildProgram } from './shaderProgram.ts';
import vertSource from '../shaders/fullscreen.vert?raw';
import commonSource from '../shaders/common.glsl?raw';

/** A shader mode: a name and the source of its fragment `render()` function. */
export interface ShaderMode {
  name: string;
  fragSource: string;
}

export interface ShaderError {
  mode: string;
  log: string;
}

interface CompiledMode {
  name: string;
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

const BUILTIN_UNIFORMS = ['uTime', 'uResolution', 'uBass', 'uMid', 'uHigh', 'uLevel'];

/**
 * WebGL2 renderer. Draws a fullscreen triangle; the active mode's fragment
 * shader does all the visual work. Consumes only FrameState — it has no
 * knowledge of AudioEngine or the UI.
 */
export class Renderer {
  private readonly gl: WebGL2RenderingContext;
  private readonly canvas: HTMLCanvasElement;
  private readonly vao: WebGLVertexArrayObject;
  private readonly controlUniforms: string[];
  private readonly modes = new Map<string, CompiledMode>();
  private current: CompiledMode | null = null;
  private errorCb: (e: ShaderError) => void = () => {};
  private successCb: (mode: string) => void = () => {};

  /**
   * @param controlUniforms glslNames of every control-schema uniform. Declared
   *   in the shader header and uploaded each frame from FrameState.controls.
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

  /** Called when a mode (re)compiles cleanly — used to clear stale errors. */
  onCompileSuccess(cb: (mode: string) => void): void {
    this.successCb = cb;
  }

  /** Assemble the full fragment source from the header + common + mode body. */
  private composeFragment(modeSource: string): string {
    const controlDecls = this.controlUniforms
      .map((n) => `uniform float ${n};`)
      .join('\n');
    const header = [
      '#version 300 es',
      'precision highp float;',
      'in vec2 vUv;',
      'out vec4 outColor;',
      ...BUILTIN_UNIFORMS.map((n) =>
        n === 'uResolution' ? `uniform vec2 ${n};` : `uniform float ${n};`,
      ),
      controlDecls,
      commonSource,
    ].join('\n');
    // #line resets numbering so compile errors point at the mode file.
    return `${header}\n#line 1\n${modeSource}\nvoid main() {\n  outColor = vec4(render(vUv), 1.0);\n}\n`;
  }

  /**
   * Compile a mode. On failure the error is reported and any previously
   * compiled version of this mode is kept, so the app stays running.
   */
  registerMode(mode: ShaderMode): boolean {
    const result = buildProgram(
      this.gl,
      vertSource,
      this.composeFragment(mode.fragSource),
    );
    if (!result.ok) {
      this.errorCb({ mode: mode.name, log: result.log });
      return false;
    }

    const uniforms = new Map<string, WebGLUniformLocation | null>();
    for (const name of [...BUILTIN_UNIFORMS, ...this.controlUniforms]) {
      uniforms.set(name, this.gl.getUniformLocation(result.program, name));
    }

    const previous = this.modes.get(mode.name);
    if (previous) this.gl.deleteProgram(previous.program);

    const compiled: CompiledMode = { name: mode.name, program: result.program, uniforms };
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

  /** Resize the drawing buffer to match the canvas in device pixels. */
  resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr));
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr));
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
  }

  render(state: FrameState): void {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);

    const mode = this.current;
    if (!mode) {
      gl.clearColor(0.04, 0.045, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    gl.useProgram(mode.program);
    gl.bindVertexArray(this.vao);

    const u = mode.uniforms;
    gl.uniform1f(u.get('uTime') ?? null, state.time);
    gl.uniform2f(u.get('uResolution') ?? null, this.canvas.width, this.canvas.height);
    gl.uniform1f(u.get('uBass') ?? null, state.audio.bass);
    gl.uniform1f(u.get('uMid') ?? null, state.audio.mid);
    gl.uniform1f(u.get('uHigh') ?? null, state.audio.high);
    gl.uniform1f(u.get('uLevel') ?? null, state.audio.level);
    for (const name of this.controlUniforms) {
      gl.uniform1f(u.get(name) ?? null, state.controls[name] ?? 0);
    }

    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  dispose(): void {
    for (const mode of this.modes.values()) this.gl.deleteProgram(mode.program);
    this.modes.clear();
    this.gl.deleteVertexArray(this.vao);
  }
}
