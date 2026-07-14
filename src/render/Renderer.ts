import type { ControlDef, FrameState } from '../core/state.ts';
import { isColor, passToggleUniform } from '../core/state.ts';
import { buildProgram } from './shaderProgram.ts';
import {
  createFbo,
  resizeFbo,
  deleteFbo,
  detectFboFormat,
  type Fbo,
  type FboFormat,
} from './Framebuffer.ts';
import { BloomPipeline } from './BloomPipeline.ts';
import type { CustomMode, CustomModeContext } from './CustomMode.ts';
import vertSource from '../shaders/fullscreen.vert?raw';
import commonSource from '../shaders/common.glsl?raw';
import presentSource from '../shaders/present.frag?raw';
import blueNoiseUrl from '../assets/blue-noise-128.png';

/** A shader mode: a name and the source of its fragment `render()` function. */
export interface ShaderMode {
  name: string;
  fragSource: string;
}

/**
 * A post-processing pass. Like a mode, each stage provides a `vec3 render(vec2
 * uv)` body — but it also gets samplers: `uSource` (previous stage), `uPrevFrame`
 * (last frame, for feedback) and `uScene` (this pass's input). Most passes are a
 * single fragment (`fragSource`); set `stages` instead for a multi-stage effect
 * (e.g. a separable blur) that runs back-to-back under one toggle. Passes run in
 * an ordered, individually-toggleable chain after the mode is drawn.
 */
export interface PostPass {
  name: string;
  fragSource?: string;
  stages?: string[];
}

export interface ShaderError {
  mode: string;
  log: string;
}

export interface CompiledProgram {
  name: string;
  program: WebGLProgram;
  uniforms: Map<string, WebGLUniformLocation | null>;
}

/** A compiled post-pass: one or more stage programs run back-to-back. */
interface CompiledPass {
  name: string;
  stages: CompiledProgram[];
}

const BUILTIN_UNIFORMS = [
  'uTime',
  'uResolution',
  'uBass',
  'uMid',
  'uHigh',
  'uLevel',
  // Decaying 0..1 transient pulses (spectral flux): uBeat = bass band (kick),
  // uOnset = full spectrum. 1.0 on a hit, exponential decay after.
  'uBeat',
  'uOnset',
  // Uploaded-logo aspect ratio (w/h); 0 until an image is set (see setLogo).
  'uLogoAspect',
];

/**
 * Samplers every mode declares. `uLogo` is the uploaded image (Logo section),
 * bound on unit 4 for modes and passes alike — transparent black until set.
 */
const MODE_SAMPLERS = ['uLogo'];
/**
 * Sampler uniforms only post-passes declare. `uSource` = previous stage,
 * `uPrevFrame` = last frame (feedback), `uScene` = this pass's own input
 * (fixed across a multi-stage pass, so a final stage can composite onto it),
 * `uBlueNoise` = a tileable 128×128 blue-noise threshold texture (Christoph
 * Peters, momentsingraphics.de, CC0), bound for every pass like the others —
 * unused declarations cost nothing, matching the controls convention. Passes
 * additionally get the MODE_SAMPLERS (the uploaded logo).
 */
const PASS_SAMPLERS = ['uSource', 'uPrevFrame', 'uScene', 'uBlueNoise', ...MODE_SAMPLERS];

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
  private readonly controls: ControlDef[];
  private readonly controlNames: string[];

  private readonly modes = new Map<string, CompiledProgram>();
  private current: CompiledProgram | null = null;

  // Custom-draw modes (true 3D): draw callbacks into the scene FBO instead
  // of fullscreen fragments — see CustomMode.ts. At most one of `current` /
  // `currentCustom` is active.
  private readonly customModes = new Map<string, CustomMode>();
  private currentCustom: CustomMode | null = null;
  private sceneNeedsDepth = false;

  // Post-pass registry — mirrors the mode registry. `passOrder` is the fixed
  // chain order; which passes run this frame is read from FrameState.controls
  // (the `uFx*` pass-toggle values — see passToggleDefs), so enable state has
  // exactly one home: the serialisable control store.
  private readonly passes = new Map<string, CompiledPass>();
  private readonly passOrder: string[] = [];

  // Render targets. `scene` holds the mode output; `ping`/`pong` are the
  // post-chain ping-pong pair; `history` keeps last frame's final output so
  // feedback passes can sample it via uPrevFrame; `passInput` snapshots a
  // multi-stage pass's input so its final stage can composite (uScene).
  private scene: Fbo | null = null;
  private ping: Fbo | null = null;
  private pong: Fbo | null = null;
  private history: Fbo | null = null;
  private passInput: Fbo | null = null;
  private historyValid = false;

  // RGBA16F where renderable (HDR headroom for bloom/trails), RGBA8 fallback.
  private readonly fboFormat: FboFormat;
  // Final draw to the default framebuffer (tonemap + clamp). Not in the pass
  // registry — it always runs, and never appears in the Effects panel.
  private present: CompiledProgram | null = null;

  // The 'bloom' pass runs on a half-res mip pyramid, which doesn't fit the
  // full-res ping-pong stage model — registerPass and the chain loop route it
  // here instead (it still toggles/orders/HMRs like any pass).
  private bloom: BloomPipeline | null = null;

  // Blue-noise threshold texture (uBlueNoise, unit 3). Starts as 1×1 mid-grey
  // so the option degrades gracefully until the async PNG decode lands.
  private blueNoise: WebGLTexture | null = null;

  // Uploaded logo (uLogo, unit 4): 1×1 transparent black until setLogo.
  private logo: WebGLTexture | null = null;
  private logoAspect = 0;

  private errorCb: (e: ShaderError) => void = () => {};
  private successCb: (mode: string) => void = () => {};

  /**
   * @param controls the control schema. Each control's uniform is declared in
   *   every program header (modes and passes) — `vec3` for `color`, else
   *   `float` — and uploaded from FrameState.controls each frame.
   */
  constructor(canvas: HTMLCanvasElement, controls: ControlDef[]) {
    this.canvas = canvas;
    this.controls = controls;
    this.controlNames = controls.map((c) => c.glslName);
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
    });
    if (!gl) {
      throw new Error('WebGL2 is not available in this browser.');
    }
    this.gl = gl;
    this.fboFormat = detectFboFormat(gl);
    this.bloom = new BloomPipeline(gl, (name, body) =>
      this.compile(name, this.composePass(body), PASS_SAMPLERS),
    );
    this.blueNoise = this.createBlueNoiseTexture();
    this.logo = this.createLogoTexture();

    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create vertex array object.');
    this.vao = vao;

    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.errorCb({ mode: '*', log: 'WebGL context lost.' });
    });
  }

  /**
   * Blue-noise threshold texture for the dither pass: 128×128 tileable, from
   * Christoph Peters' CC0 set (momentsingraphics.de/BlueNoise.html). NEAREST
   * (thresholds must stay exact) + REPEAT (tiling for free in the shader).
   * Allocated immediately as 1×1 mid-grey; the PNG decodes in asynchronously.
   */
  private createBlueNoiseTexture(): WebGLTexture | null {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([128, 128, 128, 255]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const img = new Image();
    img.src = blueNoiseUrl;
    img
      .decode()
      .then(() => {
        if (!this.blueNoise) return; // disposed before the decode finished
        gl.bindTexture(gl.TEXTURE_2D, this.blueNoise);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, img);
        gl.bindTexture(gl.TEXTURE_2D, null);
      })
      .catch((e: unknown) => {
        this.errorCb({ mode: 'dither', log: `Blue-noise texture failed to load: ${String(e)}` });
      });
    return tex;
  }

  /** 1×1 transparent-black placeholder for the uploaded logo. */
  private createLogoTexture(): WebGLTexture | null {
    const gl = this.gl;
    const tex = gl.createTexture();
    if (!tex) return null;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      1,
      1,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0]),
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
  }

  /**
   * Upload a rasterised logo (caller decodes/rasterises — see main.ts). The
   * texture flips vertically on upload so shader UVs (origin bottom-left)
   * read it upright; uLogoAspect goes non-zero, which modes use as "loaded".
   */
  setLogo(source: HTMLCanvasElement | HTMLImageElement | ImageBitmap): void {
    const gl = this.gl;
    if (!this.logo) return;
    gl.bindTexture(gl.TEXTURE_2D, this.logo);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, source);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.logoAspect = source.width / Math.max(1, source.height);
  }

  /** Drawing-buffer size in device pixels. */
  get resolution(): [number, number] {
    return [this.canvas.width, this.canvas.height];
  }

  /** True when render targets are float (RGBA16F) — values can exceed 1.0. */
  get isHdr(): boolean {
    return this.fboFormat.type !== this.gl.UNSIGNED_BYTE;
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
    return this.controls
      .map((c) => `uniform ${isColor(c) ? 'vec3' : 'float'} ${c.glslName};`)
      .join('\n');
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
      ...MODE_SAMPLERS.map((n) => `uniform sampler2D ${n};`),
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

  /** Standard uniform preamble + a verbatim body that supplies its own
   *  ins/outs and main() — for custom-mode fragments (points, meshes). */
  private composeCustomFragment(src: string): string {
    const header = [
      '#version 300 es',
      'precision highp float;',
      ...BUILTIN_UNIFORMS.map((n) =>
        n === 'uResolution' ? `uniform vec2 ${n};` : `uniform float ${n};`,
      ),
      ...MODE_SAMPLERS.map((n) => `uniform sampler2D ${n};`),
      this.controlDecls(),
      commonSource,
    ].join('\n');
    return `${header}\n#line 1\n${src}`;
  }

  private compile(
    name: string,
    fragSource: string,
    samplers: string[],
    vert: string = vertSource,
  ): CompiledProgram | null {
    const result = buildProgram(this.gl, vert, fragSource);
    if (!result.ok) {
      this.errorCb({ mode: name, log: result.log });
      return null;
    }
    const uniforms = new Map<string, WebGLUniformLocation | null>();
    for (const n of [...BUILTIN_UNIFORMS, ...samplers, ...this.controlNames]) {
      uniforms.set(n, this.gl.getUniformLocation(result.program, n));
    }
    return { name, program: result.program, uniforms };
  }

  /**
   * Compile a mode. On failure the error is reported and any previously
   * compiled version of this mode is kept, so the app stays running.
   */
  registerMode(mode: ShaderMode): boolean {
    const compiled = this.compile(mode.name, this.composeMode(mode.fragSource), MODE_SAMPLERS);
    if (!compiled) return false;

    const previous = this.modes.get(mode.name);
    if (previous) this.gl.deleteProgram(previous.program);
    this.modes.set(mode.name, compiled);
    if (this.current?.name === mode.name) this.current = compiled;
    this.successCb(mode.name);
    return true;
  }

  setMode(name: string): void {
    const custom = this.customModes.get(name);
    if (custom) {
      this.currentCustom = custom;
      this.current = null;
      return;
    }
    const mode = this.modes.get(name);
    if (!mode) {
      this.errorCb({ mode: name, log: `Mode "${name}" is not registered.` });
      return;
    }
    this.current = mode;
    this.currentCustom = null;
  }

  /** The GL services a CustomMode gets at init — see CustomMode.ts. */
  private customModeContext(): CustomModeContext {
    return {
      gl: this.gl,
      fboFormat: this.fboFormat,
      buildModeProgram: (name, vertSrc, fragBody) =>
        this.compile(name, this.composeCustomFragment(fragBody), MODE_SAMPLERS, vertSrc),
      uploadFrameUniforms: (prog, state) => this.uploadFrameUniforms(prog, state),
      rebindScene: () => {
        const gl = this.gl;
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene ? this.scene.framebuffer : null);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      },
    };
  }

  /**
   * Register a custom-draw (3D) mode. Mirrors registerMode's contract:
   * failures are reported and leave any previous registration usable. If the
   * mode needs depth and the scene FBO already exists without one, the scene
   * is recreated in place.
   */
  registerCustomMode(mode: CustomMode): boolean {
    try {
      if (!mode.init(this.customModeContext())) return false;
    } catch (e) {
      this.errorCb({ mode: mode.name, log: e instanceof Error ? e.message : String(e) });
      return false;
    }
    this.customModes.set(mode.name, mode);
    if (mode.needsDepth && !this.sceneNeedsDepth) {
      this.sceneNeedsDepth = true;
      if (this.scene) {
        const { width, height } = this.scene;
        deleteFbo(this.gl, this.scene);
        this.scene = createFbo(this.gl, width, height, this.fboFormat, true);
      }
    }
    this.successCb(mode.name);
    return true;
  }

  /**
   * Register a post-pass. Mirrors registerMode. New passes append to the chain
   * order (and start disabled); re-registering (e.g. HMR) keeps position. A
   * multi-stage pass compiles all stages; if any stage fails the pass is left
   * unchanged so the app keeps running.
   */
  registerPass(pass: PostPass): boolean {
    const sources = pass.stages ?? (pass.fragSource ? [pass.fragSource] : []);
    if (sources.length === 0) {
      this.errorCb({ mode: pass.name, log: `Pass "${pass.name}" has no stages.` });
      return false;
    }

    // 'bloom' compiles into the mip-pyramid pipeline, not the generic stage
    // chain. Same contract: keep-previous-on-failure, keep chain position.
    if (pass.name === 'bloom' && this.bloom) {
      if (!this.bloom.register(sources)) return false;
      if (!this.passOrder.includes(pass.name)) this.passOrder.push(pass.name);
      this.successCb(pass.name);
      return true;
    }

    const stages: CompiledProgram[] = [];
    for (let i = 0; i < sources.length; i++) {
      const label = sources.length > 1 ? `${pass.name}[${i}]` : pass.name;
      const compiled = this.compile(label, this.composePass(sources[i]), PASS_SAMPLERS);
      if (!compiled) return false; // error already reported; keep previous version
      stages.push(compiled);
    }

    const previous = this.passes.get(pass.name);
    if (previous) for (const s of previous.stages) this.gl.deleteProgram(s.program);
    this.passes.set(pass.name, { name: pass.name, stages });
    if (!this.passOrder.includes(pass.name)) this.passOrder.push(pass.name);
    this.successCb(pass.name);
    return true;
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
      this.scene = createFbo(gl, w, h, this.fboFormat, this.sceneNeedsDepth);
      this.ping = createFbo(gl, w, h, this.fboFormat);
      this.pong = createFbo(gl, w, h, this.fboFormat);
      this.history = createFbo(gl, w, h, this.fboFormat);
      this.passInput = createFbo(gl, w, h, this.fboFormat);
      return;
    }
    resizeFbo(gl, this.scene, w, h);
    resizeFbo(gl, this.ping!, w, h);
    resizeFbo(gl, this.pong!, w, h);
    resizeFbo(gl, this.history!, w, h);
    resizeFbo(gl, this.passInput!, w, h);
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
    gl.uniform1f(u.get('uBeat') ?? null, state.audio.beat);
    gl.uniform1f(u.get('uOnset') ?? null, state.audio.onset);
    gl.uniform1f(u.get('uLogoAspect') ?? null, this.logoAspect);
    for (const c of this.controls) {
      const loc = u.get(c.glslName) ?? null;
      const v = state.controls[c.glslName];
      if (isColor(c)) {
        const rgb = Array.isArray(v) ? v : [1, 1, 1];
        gl.uniform3f(loc, rgb[0] ?? 1, rgb[1] ?? 1, rgb[2] ?? 1);
      } else {
        gl.uniform1f(loc, typeof v === 'number' ? v : 0);
      }
    }
  }

  private drawFullscreen(): void {
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 3);
  }

  private presentTried = false;

  /**
   * Compile the present program on first use — lazily, so a compile failure
   * lands after the app has wired onError and stays visible in the overlay.
   */
  private ensurePresent(): CompiledProgram | null {
    if (!this.present && !this.presentTried) {
      this.presentTried = true;
      this.present = this.compile('present', this.composePass(presentSource), PASS_SAMPLERS);
      if (this.present) this.successCb('present');
    }
    return this.present;
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
    if ((!mode && !this.currentCustom) || !this.scene) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0.04, 0.045, 0.05, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return;
    }

    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, w, h);

    // 1. Mode → scene FBO. Custom (3D) modes draw for themselves (and own
    // clearing); fragment modes are a fullscreen draw. The logo sampler
    // rides on unit 4 (same as passes).
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.scene.framebuffer);
    if (this.currentCustom) {
      this.currentCustom.draw(state, w, h);
      // The mode may have bound its own VAO / left an FBO bound internally.
      gl.bindVertexArray(this.vao);
      gl.viewport(0, 0, w, h);
    } else if (mode) {
      gl.useProgram(mode.program);
      this.uploadFrameUniforms(mode, state);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this.logo);
      gl.uniform1i(mode.uniforms.get('uLogo') ?? null, 4);
      this.drawFullscreen();
    }

    // 2. Ordered, toggleable post-pass chain across the ping-pong pair. Enable
    // state comes from the control store (uFx* toggle values).
    const chain = this.passOrder.filter((n) => {
      const v = state.controls[passToggleUniform(n)];
      return typeof v === 'number' && v >= 0.5;
    });
    let readFbo = this.scene;
    let writeFbo = this.ping!;

    const prevTex = (this.historyValid ? this.history! : this.scene).texture;

    for (const name of chain) {
      // 'bloom' executes on its mip pyramid (see BloomPipeline); it consumes
      // and advances the ping-pong like a single generic stage.
      if (name === 'bloom') {
        if (this.bloom?.ready) {
          this.bloom.run(readFbo.texture, writeFbo, w, h, this.fboFormat, (p) =>
            this.uploadFrameUniforms(p, state),
          );
          readFbo = writeFbo;
          writeFbo = readFbo === this.ping ? this.pong! : this.ping!;
        }
        continue;
      }

      const pass = this.passes.get(name);
      if (!pass) continue;

      // uScene = this pass's input, fixed across its stages. For a multi-stage
      // pass, snapshot the input so its final stage can composite onto it even
      // after the ping-pong has cycled back over the input FBO.
      const sceneTex =
        pass.stages.length > 1
          ? (this.blit(readFbo, this.passInput!, w, h), this.passInput!.texture)
          : readFbo.texture;

      for (const stage of pass.stages) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, writeFbo.framebuffer);
        gl.useProgram(stage.program);
        this.uploadFrameUniforms(stage, state);
        // uSource = previous stage (unit 0); uPrevFrame = last frame (unit 1);
        // uScene = this pass's input (unit 2).
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, readFbo.texture);
        gl.uniform1i(stage.uniforms.get('uSource') ?? null, 0);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, prevTex);
        gl.uniform1i(stage.uniforms.get('uPrevFrame') ?? null, 1);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, sceneTex);
        gl.uniform1i(stage.uniforms.get('uScene') ?? null, 2);
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.blueNoise);
        gl.uniform1i(stage.uniforms.get('uBlueNoise') ?? null, 3);
        gl.activeTexture(gl.TEXTURE4);
        gl.bindTexture(gl.TEXTURE_2D, this.logo);
        gl.uniform1i(stage.uniforms.get('uLogo') ?? null, 4);
        this.drawFullscreen();

        readFbo = writeFbo;
        writeFbo = readFbo === this.ping ? this.pong! : this.ping!;
      }
    }

    // 3. Present final texture to the screen via the present program (tonemap
    // + clamp). A draw, not a blit: ES 3.0 forbids blitting a float read buffer
    // to the fixed-point default framebuffer, and the same path serves the
    // RGBA8 fallback. Falls back to a blit only if `present` failed to compile
    // (error already surfaced; blit is exact on the RGBA8 path).
    const present = this.ensurePresent();
    if (present) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.useProgram(present.program);
      this.uploadFrameUniforms(present, state);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, readFbo.texture);
      gl.uniform1i(present.uniforms.get('uSource') ?? null, 0);
      this.drawFullscreen();
    } else {
      this.blit(readFbo, null, w, h);
    }

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
    for (const m of this.customModes.values()) m.dispose();
    this.customModes.clear();
    this.currentCustom = null;
    for (const p of this.passes.values()) for (const s of p.stages) gl.deleteProgram(s.program);
    if (this.present) gl.deleteProgram(this.present.program);
    this.present = null;
    this.bloom?.dispose();
    this.bloom = null;
    if (this.blueNoise) gl.deleteTexture(this.blueNoise);
    this.blueNoise = null;
    if (this.logo) gl.deleteTexture(this.logo);
    this.logo = null;
    this.modes.clear();
    this.passes.clear();
    if (this.scene) deleteFbo(gl, this.scene);
    if (this.ping) deleteFbo(gl, this.ping);
    if (this.pong) deleteFbo(gl, this.pong);
    if (this.history) deleteFbo(gl, this.history);
    if (this.passInput) deleteFbo(gl, this.passInput);
    gl.deleteVertexArray(this.vao);
  }
}
