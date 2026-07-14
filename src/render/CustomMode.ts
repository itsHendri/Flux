import type { FrameState } from '../core/state.ts';
import type { CompiledProgram } from './Renderer.ts';
import type { FboFormat } from './Framebuffer.ts';

/**
 * The custom-draw mode seam. A fragment mode is a `vec3 render(vec2 uv)`
 * fullscreen shader; a CustomMode instead receives the GL context and draws
 * whatever it wants (geometry, GPGPU passes, points) into the scene FBO the
 * Renderer binds for it — true 3D without touching the fragment-mode path.
 * Mirrors the BloomPipeline pattern: the Renderer special-cases these by
 * name while the mode switcher, control scoping, and the whole post chain
 * (HDR bloom/trails/tonemap) keep working unchanged.
 *
 * Contract for `draw`:
 * - The scene framebuffer is bound and the viewport is set to w×h; render
 *   into it and nothing else (any internal FBO passes must rebind it —
 *   `ctx.rebindScene()` — before their final output draw).
 * - Blend/depth state may be changed but MUST be disabled again before
 *   returning; the Renderer rebinds its own VAO afterwards.
 * - Texture units 0–4 are free during the mode draw (the post chain rebinds
 *   its own each stage).
 */
export interface CustomModeContext {
  gl: WebGL2RenderingContext;
  /** The pipeline's render-target format (HDR-aware), for internal FBOs. */
  fboFormat: FboFormat;
  /**
   * Build a program from custom vertex + fragment sources. The fragment
   * source gets the standard uniform preamble (builtins `uTime`/audio/
   * `uBeat`…, every control uniform, `common.glsl`) prepended, so a custom
   * mode is steered exactly like a fragment mode; the vertex source is
   * taken verbatim (declare your own attributes/uniforms there and fetch
   * their locations from the returned program). Returns null on compile
   * failure (already reported to the error overlay).
   */
  buildModeProgram(name: string, vertSrc: string, fragBody: string): CompiledProgram | null;
  /** Upload uTime/audio/beat/control uniforms to a program built above. */
  uploadFrameUniforms(prog: CompiledProgram, state: FrameState): void;
  /** Rebind the scene FBO + full viewport (after internal FBO passes). */
  rebindScene(): void;
}

export interface CustomMode {
  readonly name: string;
  /** Ask for a depth attachment on the scene FBO (default false). */
  readonly needsDepth?: boolean;
  /**
   * Compile programs / allocate GL resources. Called once at registration
   * (and again on re-registration). Return false if unusable — report
   * details via the context's buildModeProgram or throw.
   */
  init(ctx: CustomModeContext): boolean;
  /** Draw one frame into the bound scene FBO (see contract above). */
  draw(state: FrameState, w: number, h: number): void;
  dispose(): void;
}
