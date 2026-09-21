import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { createFbo, deleteFbo, type Fbo, type FboFormat } from '../render/Framebuffer.ts';
import simVert from '../shaders/modes3d/sim.vert?raw';
import initFrag from '../shaders/modes3d/magneto-init.frag?raw';
import velFrag from '../shaders/modes3d/magneto-vel.frag?raw';
import posFrag from '../shaders/modes3d/magneto-pos.frag?raw';
import pointsVert from '../shaders/modes3d/magneto.vert?raw';
import pointsFrag from '../shaders/modes3d/magneto-points.frag?raw';
import nebulaFrag from '../shaders/modes3d/magneto-nebula.frag?raw';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import { perspective, lookAt, project, type Vec3 } from '../render/math3d.ts';

/**
 * MAGNETO — the iTunes 8 visualizer's physics, rebuilt on FLUX's own rig.
 *
 * Robert Hodgin described Magnetosphere as "a physics system which plays
 * opposing forces against each other. Some elements in the scene have an
 * attractive force, others have a repulsive force, and over time these
 * elements create dynamic compositions" — and, the part that matters most,
 * each particle is "assigned a specific frequency to pay attention to", so
 * the FFT drives individual particles rather than the swarm as a whole.
 * (roberthodgin.com/project/magnetosphere — see REFERENCES.md.)
 *
 * So: every particle carries a charge (half positive, half negative) and a
 * fixed slice of the spectrum. Four poles orbit the scene, and whether a pole
 * pulls or throws a given particle is the product of their charges — the same
 * pole grabs half the swarm and flings the other half. Nothing choreographs
 * the shapes; they're what the opposition does.
 *
 * Position and velocity live in separate ping-pong pairs, stepped by two
 * passes (velocity then position) rather than one MRT pass — simpler, and the
 * cost is one extra fullscreen draw over a small texture. Points render
 * additively with no depth buffer at all, which is the reason Hodgin moved the
 * original to additive blending too: light sums in any order, so there's
 * nothing to sort.
 */
const POLE_COUNT = 4;
/** World radius of a drawn core — it's light, so this sets its apparent size. */
const CORE_RADIUS = 0.07;

export class MagnetoMode implements CustomMode {
  readonly name = 'magneto';

  private ctx: CustomModeContext | null = null;
  private initProg: CompiledProgram | null = null;
  private velProg: CompiledProgram | null = null;
  private posProg: CompiledProgram | null = null;
  private points: CompiledProgram | null = null;
  private nebula: CompiledProgram | null = null;
  private uNebCores: WebGLUniformLocation | null = null;
  private uNebCam: WebGLUniformLocation | null = null;
  private readonly coreData = new Float32Array(POLE_COUNT * 4);

  private uInitSize: WebGLUniformLocation | null = null;
  private uInitIsVel: WebGLUniformLocation | null = null;
  private uVelPos: WebGLUniformLocation | null = null;
  private uVelVel: WebGLUniformLocation | null = null;
  private uVelPoles: WebGLUniformLocation | null = null;
  private uVelStep: WebGLUniformLocation | null = null;
  private uPosPos: WebGLUniformLocation | null = null;
  private uPosVel: WebGLUniformLocation | null = null;
  private uPosStep: WebGLUniformLocation | null = null;
  private uPtsPos: WebGLUniformLocation | null = null;
  private uPtsVel: WebGLUniformLocation | null = null;
  private uPtsProj: WebGLUniformLocation | null = null;
  private uPtsView: WebGLUniformLocation | null = null;
  private uPtsTexSize: WebGLUniformLocation | null = null;

  private posRead: Fbo | null = null;
  private posWrite: Fbo | null = null;
  private velRead: Fbo | null = null;
  private velWrite: Fbo | null = null;
  private texSize = 0;
  private simFmt: FboFormat | null = null;

  /** Pole charges, flipped on kicks so the composition keeps reorganising. */
  private poleCharge = [1, -1, 1, -1];
  private beatArmed = true;
  private lastBar = 0;
  /** Set on entry: re-read the bar count without treating it as a downbeat. */
  private resync = true;
  private readonly poleData = new Float32Array(POLE_COUNT * 4);

  init(ctx: CustomModeContext): boolean {
    const gl = ctx.gl;
    const initProg = ctx.buildModeProgram(`${this.name}-init`, simVert, initFrag);
    const velProg = ctx.buildModeProgram(`${this.name}-vel`, simVert, velFrag);
    const posProg = ctx.buildModeProgram(`${this.name}-pos`, simVert, posFrag);
    const points = ctx.buildModeProgram(this.name, pointsVert, pointsFrag);
    const nebula = ctx.buildModeProgram(`${this.name}-nebula`, fullscreenVert, nebulaFrag);
    if (!initProg || !velProg || !posProg || !points || !nebula) {
      for (const p of [initProg, velProg, posProg, points, nebula]) if (p) gl.deleteProgram(p.program);
      return false; // compile errors already on the overlay
    }
    this.disposePrograms();
    this.ctx = ctx;
    this.initProg = initProg;
    this.velProg = velProg;
    this.posProg = posProg;
    this.points = points;
    this.nebula = nebula;
    this.uNebCores = gl.getUniformLocation(nebula.program, 'uCores');
    this.uNebCam = gl.getUniformLocation(nebula.program, 'uCamAngle');

    this.uInitSize = gl.getUniformLocation(initProg.program, 'uStateSize');
    this.uInitIsVel = gl.getUniformLocation(initProg.program, 'uIsVelocity');
    this.uVelPos = gl.getUniformLocation(velProg.program, 'uPosTex');
    this.uVelVel = gl.getUniformLocation(velProg.program, 'uVelTex');
    this.uVelPoles = gl.getUniformLocation(velProg.program, 'uPoles');
    this.uVelStep = gl.getUniformLocation(velProg.program, 'uStep');
    this.uPosPos = gl.getUniformLocation(posProg.program, 'uPosTex');
    this.uPosVel = gl.getUniformLocation(posProg.program, 'uVelTex');
    this.uPosStep = gl.getUniformLocation(posProg.program, 'uStep');
    this.uPtsPos = gl.getUniformLocation(points.program, 'uPositions');
    this.uPtsVel = gl.getUniformLocation(points.program, 'uVelocities');
    this.uPtsProj = gl.getUniformLocation(points.program, 'uProj');
    this.uPtsView = gl.getUniformLocation(points.program, 'uView');
    this.uPtsTexSize = gl.getUniformLocation(points.program, 'uTexSize');

    if (!this.simFmt) {
      this.simFmt = this.probeSimFormat(gl);
      if (!this.simFmt) {
        throw new Error('magneto needs float render targets (EXT_color_buffer_float).');
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

  private ensureSim(size: number, state: FrameState): void {
    const ctx = this.ctx;
    if (!ctx || !this.simFmt || !this.initProg) return;
    if (this.texSize === size && this.posRead && this.velRead) return;
    const gl = ctx.gl;
    for (const f of [this.posRead, this.posWrite, this.velRead, this.velWrite]) {
      if (f) deleteFbo(gl, f);
    }
    this.posRead = createFbo(gl, size, size, this.simFmt);
    this.posWrite = createFbo(gl, size, size, this.simFmt);
    this.velRead = createFbo(gl, size, size, this.simFmt);
    this.velWrite = createFbo(gl, size, size, this.simFmt);
    // NEAREST, always: a LINEAR-filtered float texture is sampling-incomplete
    // without OES_texture_float_linear and every texelFetch silently returns
    // zero — the bug that collapsed trails3d to the origin.
    for (const f of [this.posRead, this.posWrite, this.velRead, this.velWrite]) {
      gl.bindTexture(gl.TEXTURE_2D, f.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    }
    gl.bindTexture(gl.TEXTURE_2D, null);
    this.texSize = size;

    // Seed both halves of the state with one program, twice.
    gl.useProgram(this.initProg.program);
    ctx.uploadFrameUniforms(this.initProg, state);
    gl.uniform2f(this.uInitSize, size, size);
    for (const [target, isVel] of [
      [this.posRead, 0],
      [this.velRead, 1],
    ] as const) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, size, size);
      gl.uniform1f(this.uInitIsVel, isVel);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
  }

  /**
   * Orbit the poles, and flip one's charge: on each downbeat while the beat
   * tracker is locked (so the swarm re-sorts on the one), else on each kick.
   */
  private updatePoles(state: FrameState): void {
    const t = state.time * (0.15 + 0.5 * num(state.controls['uMagSpin'], 0.4));
    const beat = state.audio.beat;
    const bar = state.audio.barCount;
    const onBar = bar !== this.lastBar && !this.resync;
    this.lastBar = bar;
    this.resync = false;
    const locked = state.audio.lock > 0.5;
    if (locked ? onBar : beat > 0.6 && this.beatArmed) {
      // Flip one pole per kick, not all of them: flipping everything at once
      // just mirrors the scene, while flipping one re-sorts which half of the
      // swarm each pole owns.
      const i = Math.floor(Math.random() * POLE_COUNT);
      this.poleCharge[i] *= -1;
      this.beatArmed = false;
    } else if (beat < 0.25) {
      this.beatArmed = true;
    }

    const radius = 0.9 + 0.5 * num(state.controls['uScale'], 0.4);
    for (let i = 0; i < POLE_COUNT; i++) {
      const phase = t + (i * Math.PI * 2) / POLE_COUNT;
      this.poleData[i * 4 + 0] = Math.cos(phase) * radius;
      this.poleData[i * 4 + 1] = Math.sin(phase * 0.7 + i) * radius * 0.6;
      this.poleData[i * 4 + 2] = Math.sin(phase) * radius;
      this.poleData[i * 4 + 3] = this.poleCharge[i];
    }
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.velProg || !this.posProg || !this.points) return;
    const gl = ctx.gl;

    const size = num(state.controls['uParticles'], 256);
    this.ensureSim(size, state);
    if (!this.posRead || !this.posWrite || !this.velRead || !this.velWrite) return;

    this.updatePoles(state);
    const step = Math.min(state.dt, 0.033);

    // 1. Velocity: forces from the poles, scaled by each particle's own band.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.velWrite.framebuffer);
    gl.viewport(0, 0, this.texSize, this.texSize);
    gl.useProgram(this.velProg.program);
    ctx.uploadFrameUniforms(this.velProg, state);
    gl.uniform4fv(this.uVelPoles, this.poleData);
    gl.uniform1f(this.uVelStep, step);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posRead.texture);
    gl.uniform1i(this.uVelPos, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velRead.texture);
    gl.uniform1i(this.uVelVel, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [this.velRead, this.velWrite] = [this.velWrite, this.velRead];

    // 2. Position: integrate with the velocity just written.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.posWrite.framebuffer);
    gl.viewport(0, 0, this.texSize, this.texSize);
    gl.useProgram(this.posProg.program);
    ctx.uploadFrameUniforms(this.posProg, state);
    gl.uniform1f(this.uPosStep, step);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posRead.texture);
    gl.uniform1i(this.uPosPos, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velRead.texture);
    gl.uniform1i(this.uPosVel, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    [this.posRead, this.posWrite] = [this.posWrite, this.posRead];

    const t = state.time;
    const camAngle = t * 0.09;
    const eye: Vec3 = [
      Math.sin(camAngle) * 3.2,
      0.5 + Math.sin(t * 0.05) * 0.6,
      Math.cos(camAngle) * 3.2,
    ];
    const fovY = 0.9;
    const proj = perspective(fovY, w / h, 0.1, 30);
    const view = lookAt(eye, [0, 0, 0]);

    // 3. Background: nebula, rays and cores, in place of a flat clear. The
    // cores are projected here so the screen-space pass can light the clouds
    // around them; one behind the camera is flagged off (w = 0) rather than
    // drawn mirrored.
    ctx.rebindScene();
    const f = 1 / Math.tan(fovY / 2);
    for (let i = 0; i < POLE_COUNT; i++) {
      const o = i * 4;
      const sp = project(proj, view, [this.poleData[o], this.poleData[o + 1], this.poleData[o + 2]]);
      this.coreData[o] = sp ? sp.u : 0;
      this.coreData[o + 1] = sp ? sp.v : 0;
      // Apparent radius in screen heights: world radius * focal / depth, halved
      // because NDC spans two units per screen height.
      this.coreData[o + 2] = sp ? ((CORE_RADIUS * f) / sp.w) * 0.5 : 0;
      this.coreData[o + 3] = sp ? this.poleCharge[i] : 0;
    }
    gl.useProgram(this.nebula!.program);
    ctx.uploadFrameUniforms(this.nebula!, state);
    gl.uniform4fv(this.uNebCores, this.coreData);
    gl.uniform1f(this.uNebCam, camAngle);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 4. Points → scene FBO, additive over the background, no depth.
    gl.useProgram(this.points.program);
    ctx.uploadFrameUniforms(this.points, state);
    gl.uniformMatrix4fv(this.uPtsProj, false, proj);
    gl.uniformMatrix4fv(this.uPtsView, false, view);
    gl.uniform1i(this.uPtsTexSize, this.texSize);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.posRead.texture);
    gl.uniform1i(this.uPtsPos, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.velRead.texture);
    gl.uniform1i(this.uPtsVel, 1);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.POINTS, 0, this.texSize * this.texSize);
    gl.disable(gl.BLEND);
  }

  /** Back to this mode: the downbeats that passed while away aren't events. */
  enter(): void {
    this.resync = true;
  }

  private disposePrograms(): void {
    if (!this.ctx) return;
    const gl = this.ctx.gl;
    for (const p of [this.initProg, this.velProg, this.posProg, this.points, this.nebula]) {
      if (p) gl.deleteProgram(p.program);
    }
    this.initProg = this.velProg = this.posProg = this.points = this.nebula = null;
  }

  dispose(): void {
    this.disposePrograms();
    if (this.ctx) {
      for (const f of [this.posRead, this.posWrite, this.velRead, this.velWrite]) {
        if (f) deleteFbo(this.ctx.gl, f);
      }
    }
    this.posRead = this.posWrite = this.velRead = this.velWrite = null;
    this.texSize = 0;
  }
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}
