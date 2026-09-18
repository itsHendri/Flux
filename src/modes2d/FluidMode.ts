import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { createFbo, deleteFbo, type Fbo, type FboFormat } from '../render/Framebuffer.ts';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import advectFrag from '../shaders/modes2d/fluid-advect.frag?raw';
import divergenceFrag from '../shaders/modes2d/fluid-divergence.frag?raw';
import curlFrag from '../shaders/modes2d/fluid-curl.frag?raw';
import vorticityFrag from '../shaders/modes2d/fluid-vorticity.frag?raw';
import pressureFrag from '../shaders/modes2d/fluid-pressure.frag?raw';
import gradientFrag from '../shaders/modes2d/fluid-gradient.frag?raw';
import splatFrag from '../shaders/modes2d/fluid-splat.frag?raw';
import drawFrag from '../shaders/modes2d/fluid-draw.frag?raw';

/**
 * FLUID — an incompressible fluid the music stirs.
 *
 * Jos Stam's stable-fluids solver, the GPU arrangement everyone uses since
 * GPU Gems: advect the velocity along itself, put back the small eddies the
 * grid smeared away (vorticity confinement), measure how much the field is
 * compressing, solve for the pressure that cancels it, subtract that
 * pressure's gradient, then carry the dye along the result. Every pass is a
 * full-screen draw over a pair of float textures.
 * (Stam 1999, https://www.dgp.toronto.edu/public_user/stam/reality/Research/pdf/ns.pdf;
 * Pavel Dobryakov's WebGL fluid demo is the reference implementation this
 * pipeline is modelled on — see REFERENCES.md.)
 *
 * The music only ever enters through the splats: kicks shove the fluid and
 * inject ink, the level keeps a slow stir alive so it never goes still. The
 * rest is the fluid carrying on with what it was given, which is exactly why
 * it looks alive rather than animated.
 */
const DEFAULT_DETAIL = 384;
/** Jacobi iterations for the pressure solve — the expensive number here. */
const PRESSURE_ITERATIONS = 18;

interface Splat {
  x: number;
  y: number;
  radius: number;
  dx: number;
  dy: number;
  r: number;
  g: number;
  b: number;
}

export class FluidMode implements CustomMode {
  readonly name = 'fluid';

  private ctx: CustomModeContext | null = null;
  private advect: CompiledProgram | null = null;
  private divergence: CompiledProgram | null = null;
  private curl: CompiledProgram | null = null;
  private vorticity: CompiledProgram | null = null;
  private pressure: CompiledProgram | null = null;
  private gradient: CompiledProgram | null = null;
  private splat: CompiledProgram | null = null;
  private draw3: CompiledProgram | null = null;

  private velRead: Fbo | null = null;
  private velWrite: Fbo | null = null;
  private dyeRead: Fbo | null = null;
  private dyeWrite: Fbo | null = null;
  private pressRead: Fbo | null = null;
  private pressWrite: Fbo | null = null;
  private divTex: Fbo | null = null;
  private curlTex: Fbo | null = null;

  private simW = 0;
  private simH = 0;
  private fmt: FboFormat | null = null;
  private beatArmed = true;

  /** Scratch, refilled per frame — no allocation in the render loop. */
  private readonly splats: Splat[] = [];
  private readonly posBuf = new Float32Array(16);
  private readonly dataBuf = new Float32Array(16);

  init(ctx: CustomModeContext): boolean {
    const gl = ctx.gl;
    const build = (name: string, src: string) =>
      ctx.buildModeProgram(`${this.name}-${name}`, fullscreenVert, src);
    const advect = build('advect', advectFrag);
    const divergence = build('divergence', divergenceFrag);
    const curl = build('curl', curlFrag);
    const vorticity = build('vorticity', vorticityFrag);
    const pressure = build('pressure', pressureFrag);
    const gradient = build('gradient', gradientFrag);
    const splat = build('splat', splatFrag);
    // The visible program takes the mode's own name, so the switcher and the
    // control scoping find it.
    const draw3 = ctx.buildModeProgram(this.name, fullscreenVert, drawFrag);
    const all = [advect, divergence, curl, vorticity, pressure, gradient, splat, draw3];
    if (all.some((p) => !p)) {
      for (const p of all) if (p) gl.deleteProgram(p.program);
      return false; // compile errors already on the overlay
    }
    this.disposePrograms();
    this.ctx = ctx;
    this.advect = advect;
    this.divergence = divergence;
    this.curl = curl;
    this.vorticity = vorticity;
    this.pressure = pressure;
    this.gradient = gradient;
    this.splat = splat;
    this.draw3 = draw3;

    if (!this.fmt) {
      this.fmt = this.probeFormat(gl);
      if (!this.fmt) {
        throw new Error('fluid needs float render targets (EXT_color_buffer_float).');
      }
    }
    return true;
  }

  /**
   * RGBA16F, not 32F: advection samples between cells, and half-float linear
   * filtering is core WebGL2 while 32F filtering needs an extension that isn't
   * everywhere. A fluid solver reading NEAREST would stair-step every eddy.
   */
  private probeFormat(gl: WebGL2RenderingContext): FboFormat | null {
    const fmt = { internalFormat: gl.RGBA16F, format: gl.RGBA, type: gl.HALF_FLOAT };
    try {
      const probe = createFbo(gl, 4, 4, fmt);
      gl.bindFramebuffer(gl.FRAMEBUFFER, probe.framebuffer);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      deleteFbo(gl, probe);
      return ok ? fmt : null;
    } catch {
      return null;
    }
  }

  private ensureTargets(w: number, h: number, detail: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.fmt) return;
    const simH = Math.round(detail);
    const simW = Math.max(128, Math.min(1600, Math.round((simH * w) / Math.max(h, 1))));
    if (this.simW === simW && this.simH === simH && this.velRead) return;

    const gl = ctx.gl;
    for (const f of [
      this.velRead, this.velWrite, this.dyeRead, this.dyeWrite,
      this.pressRead, this.pressWrite, this.divTex, this.curlTex,
    ]) {
      if (f) deleteFbo(gl, f);
    }
    const make = () => createFbo(gl, simW, simH, this.fmt!);
    this.velRead = make();
    this.velWrite = make();
    this.dyeRead = make();
    this.dyeWrite = make();
    this.pressRead = make();
    this.pressWrite = make();
    this.divTex = make();
    this.curlTex = make();
    this.simW = simW;
    this.simH = simH;

    // Start from rest: an empty tank, no ink.
    for (const f of [this.velRead, this.velWrite, this.dyeRead, this.dyeWrite,
                     this.pressRead, this.pressWrite]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, f.framebuffer);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
  }

  /** Where the music pushes the fluid this frame. */
  private buildSplats(state: FrameState): void {
    this.splats.length = 0;
    const t = state.time;
    const force = num(state.controls['uFluidForce'], 0.5);
    const theme = (i: number): [number, number, number] => {
      const v = state.controls[['uThemeA', 'uThemeB', 'uThemeC'][i]];
      return Array.isArray(v) ? [v[0] ?? 1, v[1] ?? 1, v[2] ?? 1] : [1, 1, 1];
    };

    // A slow stirring finger, always there, so a quiet passage still moves.
    const stirAngle = t * 0.35;
    const stir = 0.25 + state.audio.level * 0.9;
    this.splats.push({
      x: 0.5 + Math.cos(stirAngle) * 0.26,
      y: 0.5 + Math.sin(stirAngle * 1.3) * 0.26,
      radius: 0.0009,
      // Tangential, so it winds the fluid up rather than blowing it apart.
      dx: -Math.sin(stirAngle) * 260 * stir * force,
      dy: Math.cos(stirAngle * 1.3) * 260 * stir * force,
      ...rgb(theme(0), 0.055 + state.audio.level * 0.12),
    });

    // A kick throws ink in from a fresh spot: one splat per hit, latched on
    // the rising edge, or every frame of the pulse would flood the tank.
    const beat = state.audio.beat;
    if (beat > 0.55 && this.beatArmed) {
      this.beatArmed = false;
      const a = Math.random() * Math.PI * 2;
      const rad = 0.18 + Math.random() * 0.22;
      const x = 0.5 + Math.cos(a) * rad;
      const y = 0.5 + Math.sin(a) * rad;
      // Aimed at the centre: the burst meets the stir and folds.
      this.splats.push({
        x,
        y,
        radius: 0.004,
        dx: (0.5 - x) * 2200 * force,
        dy: (0.5 - y) * 2200 * force,
        ...rgb(theme(1 + (Math.random() < 0.5 ? 0 : 1)), 0.5),
      });
    } else if (beat < 0.2) {
      this.beatArmed = true;
    }

    // Highs sprinkle small bright drops, so detail keeps arriving.
    if (state.audio.high > 0.35) {
      const a = t * 2.1 + state.audio.high * 9.0;
      this.splats.push({
        x: 0.5 + Math.cos(a) * 0.34,
        y: 0.5 + Math.sin(a * 1.7) * 0.34,
        radius: 0.0006,
        dx: Math.cos(a * 3.0) * 180 * force,
        dy: Math.sin(a * 2.0) * 180 * force,
        ...rgb(theme(2), state.audio.high * 0.22),
      });
    }
  }

  /** One splat pass over `target`: velocity (push) or dye (colour). */
  private runSplats(state: FrameState, velocityPass: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.splat || this.splats.length === 0) return;
    const gl = ctx.gl;
    const read = velocityPass ? this.velRead! : this.dyeRead!;
    const write = velocityPass ? this.velWrite! : this.dyeWrite!;

    const count = Math.min(4, this.splats.length);
    for (let i = 0; i < count; i++) {
      const s = this.splats[i];
      this.posBuf[i * 4] = s.x;
      this.posBuf[i * 4 + 1] = s.y;
      this.posBuf[i * 4 + 2] = s.radius;
      this.posBuf[i * 4 + 3] = 0;
      this.dataBuf[i * 4] = velocityPass ? s.dx : s.r;
      this.dataBuf[i * 4 + 1] = velocityPass ? s.dy : s.g;
      this.dataBuf[i * 4 + 2] = velocityPass ? 0 : s.b;
      this.dataBuf[i * 4 + 3] = 0;
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, write.framebuffer);
    gl.viewport(0, 0, this.simW, this.simH);
    gl.useProgram(this.splat.program);
    ctx.uploadFrameUniforms(this.splat, state);
    const u = (n: string) => gl.getUniformLocation(this.splat!.program, n);
    gl.uniform1f(u('uAspect'), this.simW / Math.max(this.simH, 1));
    gl.uniform1i(u('uSplatCount'), count);
    gl.uniform4fv(u('uSplatPos'), this.posBuf);
    gl.uniform4fv(u('uSplatData'), this.dataBuf);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, read.texture);
    gl.uniform1i(u('uTarget'), 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    if (velocityPass) [this.velRead, this.velWrite] = [this.velWrite, this.velRead];
    else [this.dyeRead, this.dyeWrite] = [this.dyeWrite, this.dyeRead];
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.advect || !this.draw3) return;
    const gl = ctx.gl;

    const detail = num(state.controls['uFluidDetail'], DEFAULT_DETAIL);
    this.ensureTargets(w, h, detail);
    if (!this.velRead || !this.dyeRead || !this.pressRead || !this.divTex || !this.curlTex) return;

    const texel: [number, number] = [1 / this.simW, 1 / this.simH];
    // Clamped: a long frame (a tab coming back to life) would otherwise
    // advect the field halfway across the tank in one step.
    const dt = Math.min(state.dt, 0.033);
    const setTexel = (prog: CompiledProgram) => {
      gl.uniform2f(gl.getUniformLocation(prog.program, 'uTexel'), texel[0], texel[1]);
    };
    const bind = (prog: CompiledProgram, name: string, tex: WebGLTexture, unit: number) => {
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.uniform1i(gl.getUniformLocation(prog.program, name), unit);
    };
    const target = (fbo: Fbo) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo.framebuffer);
      gl.viewport(0, 0, this.simW, this.simH);
    };

    // 1. Advect the velocity along itself, then the dye along the velocity.
    for (const isVelocity of [true, false]) {
      const read = isVelocity ? this.velRead! : this.dyeRead!;
      const write = isVelocity ? this.velWrite! : this.dyeWrite!;
      target(write);
      gl.useProgram(this.advect.program);
      ctx.uploadFrameUniforms(this.advect, state);
      setTexel(this.advect);
      gl.uniform1f(gl.getUniformLocation(this.advect.program, 'uDtSim'), dt);
      gl.uniform1f(
        gl.getUniformLocation(this.advect.program, 'uDissipation'),
        isVelocity ? 0.22 : mix(0.05, 1.6, num(state.controls['uFluidFade'], 0.4)),
      );
      bind(this.advect, 'uVelocity', this.velRead!.texture, 0);
      bind(this.advect, 'uSource', read.texture, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (isVelocity) [this.velRead, this.velWrite] = [this.velWrite, this.velRead];
      else [this.dyeRead, this.dyeWrite] = [this.dyeWrite, this.dyeRead];
    }

    // 2. The music goes in.
    this.buildSplats(state);
    this.runSplats(state, true);
    this.runSplats(state, false);

    // 3. Put the lost eddies back.
    target(this.curlTex);
    gl.useProgram(this.curl!.program);
    ctx.uploadFrameUniforms(this.curl!, state);
    setTexel(this.curl!);
    bind(this.curl!, 'uVelocity', this.velRead!.texture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    target(this.velWrite!);
    gl.useProgram(this.vorticity!.program);
    ctx.uploadFrameUniforms(this.vorticity!, state);
    setTexel(this.vorticity!);
    gl.uniform1f(gl.getUniformLocation(this.vorticity!.program, 'uDtSim'), dt);
    gl.uniform1f(
      gl.getUniformLocation(this.vorticity!.program, 'uVorticityAmount'),
      mix(0.0, 45.0, num(state.controls['uFluidSwirl'], 0.6)),
    );
    bind(this.vorticity!, 'uVelocity', this.velRead!.texture, 0);
    bind(this.vorticity!, 'uCurl', this.curlTex.texture, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [this.velRead, this.velWrite] = [this.velWrite, this.velRead];

    // 4. Make it incompressible: measure the outflow, solve for the pressure
    //    that cancels it, subtract that pressure's gradient.
    target(this.divTex);
    gl.useProgram(this.divergence!.program);
    ctx.uploadFrameUniforms(this.divergence!, state);
    setTexel(this.divergence!);
    bind(this.divergence!, 'uVelocity', this.velRead!.texture, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.useProgram(this.pressure!.program);
    ctx.uploadFrameUniforms(this.pressure!, state);
    setTexel(this.pressure!);
    for (let i = 0; i < PRESSURE_ITERATIONS; i++) {
      target(this.pressWrite!);
      bind(this.pressure!, 'uPressure', this.pressRead!.texture, 0);
      bind(this.pressure!, 'uDivergence', this.divTex.texture, 1);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      [this.pressRead, this.pressWrite] = [this.pressWrite, this.pressRead];
    }

    target(this.velWrite!);
    gl.useProgram(this.gradient!.program);
    ctx.uploadFrameUniforms(this.gradient!, state);
    setTexel(this.gradient!);
    bind(this.gradient!, 'uPressure', this.pressRead!.texture, 0);
    bind(this.gradient!, 'uVelocity', this.velRead!.texture, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [this.velRead, this.velWrite] = [this.velWrite, this.velRead];

    // 5. Show the ink.
    ctx.rebindScene();
    gl.useProgram(this.draw3.program);
    ctx.uploadFrameUniforms(this.draw3, state);
    gl.uniform2f(gl.getUniformLocation(this.draw3.program, 'uTexel'), texel[0], texel[1]);
    bind(this.draw3, 'uDye', this.dyeRead!.texture, 0);
    bind(this.draw3, 'uVelocity', this.velRead!.texture, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private disposePrograms(): void {
    if (!this.ctx) return;
    const gl = this.ctx.gl;
    for (const p of [
      this.advect, this.divergence, this.curl, this.vorticity,
      this.pressure, this.gradient, this.splat, this.draw3,
    ]) {
      if (p) gl.deleteProgram(p.program);
    }
    this.advect = this.divergence = this.curl = this.vorticity = null;
    this.pressure = this.gradient = this.splat = this.draw3 = null;
  }

  dispose(): void {
    this.disposePrograms();
    if (this.ctx) {
      for (const f of [
        this.velRead, this.velWrite, this.dyeRead, this.dyeWrite,
        this.pressRead, this.pressWrite, this.divTex, this.curlTex,
      ]) {
        if (f) deleteFbo(this.ctx.gl, f);
      }
    }
    this.velRead = this.velWrite = this.dyeRead = this.dyeWrite = null;
    this.pressRead = this.pressWrite = this.divTex = this.curlTex = null;
    this.simW = this.simH = 0;
  }
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t));
}

/** A theme colour scaled to an ink amount. */
function rgb(c: [number, number, number], amount: number): { r: number; g: number; b: number } {
  return { r: c[0] * amount, g: c[1] * amount, b: c[2] * amount };
}
