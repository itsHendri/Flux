import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { perspective, lookAt, project, type Vec3 } from '../render/math3d.ts';
import { HitGate } from '../core/hitGate.ts';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import dustVert from '../shaders/modes3d/wisp.vert?raw';
import dustFrag from '../shaders/modes3d/wisp.frag?raw';
import glowFrag from '../shaders/modes3d/wisp-glow.frag?raw';

const TRAIL = 48;
/** Seconds between trail samples: 48 of them is about 1.4 s of tail. */
const TRAIL_STEP = 0.03;

/**
 * WISP — a dust world with one bright wanderer (photism).
 *
 * The dust is placed analytically (see wisp.vert) and is dark except where the
 * wanderer's light reaches it, by inverse square — so the picture is made by
 * the light moving, not by the dust. The wanderer is steered here: a damped
 * spring toward a target that drifts on its own and **jumps on a kick**, with
 * the music's level setting how eagerly it goes. Its recent path is kept as a
 * trail and drawn as a tail of fading light, and the camera follows it loosely.
 */
export class WispMode implements CustomMode {
  readonly name = 'wisp';

  private ctx: CustomModeContext | null = null;
  private dust: CompiledProgram | null = null;
  private glow: CompiledProgram | null = null;

  private readonly pos: Vec3 = [0, 0, 0];
  private readonly vel: Vec3 = [0, 0, 0];
  private readonly target: Vec3 = [1.5, 0.3, 0];
  private readonly look: Vec3 = [0, 0, 0];
  private readonly trail: Vec3[] = [];
  private trailClock = 0;
  private nextDrift = 0;
  private readonly kicks = new HitGate(0.2);
  private readonly trailData = new Float32Array(TRAIL * 4);

  init(ctx: CustomModeContext): boolean {
    const gl = ctx.gl;
    const dust = ctx.buildModeProgram(this.name, dustVert, dustFrag);
    const glow = ctx.buildModeProgram(`${this.name}-glow`, fullscreenVert, glowFrag);
    if (!dust || !glow) {
      for (const p of [dust, glow]) if (p) gl.deleteProgram(p.program);
      return false;
    }
    this.dispose();
    this.ctx = ctx;
    this.dust = dust;
    this.glow = glow;
    return true;
  }

  enter(): void {
    this.trail.length = 0;
    this.vel.fill(0);
  }

  /** A new place to go: somewhere in the slab, not too near where it is. */
  private retarget(far: boolean): void {
    const r = far ? 3.2 : 2.0;
    for (let tries = 0; tries < 6; tries++) {
      const t: Vec3 = [(Math.random() * 2 - 1) * r, (Math.random() * 2 - 1) * 1.1, (Math.random() * 2 - 1) * r];
      if (Math.hypot(t[0] - this.pos[0], t[1] - this.pos[1], t[2] - this.pos[2]) > (far ? 2.5 : 1)) {
        this.target[0] = t[0];
        this.target[1] = t[1];
        this.target[2] = t[2];
        return;
      }
    }
  }

  private steer(state: FrameState): void {
    const a = state.audio;
    const dt = Math.min(state.dt, 0.05);
    const wander = num(state.controls['uWispWander'], 1);
    if (this.kicks.update(a.beat, state.time, 0.6)) {
      // A kick: dart somewhere well away.
      this.retarget(true);
    } else if (state.time > this.nextDrift) {
      this.retarget(false);
      this.nextDrift = state.time + 2.5 + Math.random() * 3;
    }
    // Damped spring toward the target; louder music, keener chase.
    const k = (2.5 + a.level * 6 + a.beat * 10) * wander;
    const damp = 2 * Math.sqrt(k) * 0.8;
    for (let i = 0; i < 3; i++) {
      this.vel[i] += ((this.target[i] - this.pos[i]) * k - this.vel[i] * damp) * dt;
      this.pos[i] += this.vel[i] * dt;
      this.look[i] += (this.pos[i] * 0.6 - this.look[i]) * (1 - Math.exp(-dt / 1.2));
    }
    this.trailClock += dt;
    if (this.trail.length === 0 || this.trailClock >= TRAIL_STEP) {
      this.trailClock = 0;
      this.trail.unshift([this.pos[0], this.pos[1], this.pos[2]]);
      if (this.trail.length > TRAIL) this.trail.pop();
    }
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.dust || !this.glow) return;
    const gl = ctx.gl;
    this.steer(state);

    const orbit = state.time * 0.05;
    const dist = 7.5 - 2.5 * num(state.controls['uScale'], 0.4);
    const eye: Vec3 = [
      this.look[0] + Math.sin(orbit) * dist,
      this.look[1] + 1.6,
      this.look[2] + Math.cos(orbit) * dist,
    ];
    const fovY = 0.9;
    const proj = perspective(fovY, w / h, 0.05, 60);
    const view = lookAt(eye, this.look);

    gl.clearColor(0.002, 0.002, 0.004, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    const dp = this.dust.program;
    gl.useProgram(dp);
    ctx.uploadFrameUniforms(this.dust, state);
    gl.uniformMatrix4fv(gl.getUniformLocation(dp, 'uProj'), false, proj);
    gl.uniformMatrix4fv(gl.getUniformLocation(dp, 'uView'), false, view);
    gl.uniform3f(gl.getUniformLocation(dp, 'uWanderer'), this.pos[0], this.pos[1], this.pos[2]);
    gl.drawArrays(gl.POINTS, 0, Math.round(num(state.controls['uWispDust'], 65536)));

    // The wanderer and its tail, projected to the screen for the glow pass.
    const f = 1 / Math.tan(fovY / 2);
    this.trailData.fill(0);
    this.trail.forEach((p, i) => {
      const sp = project(proj, view, p);
      const o = i * 4;
      if (!sp) {
        this.trailData[o + 3] = -1;
        return;
      }
      this.trailData[o] = sp.u;
      this.trailData[o + 1] = sp.v;
      // Apparent radius (screen heights) of a light 0.05 across.
      this.trailData[o + 2] = ((0.05 * f) / sp.w) * 0.5 * (i === 0 ? 1 : 0.8);
      this.trailData[o + 3] = i / TRAIL;
    });
    const gp = this.glow.program;
    gl.useProgram(gp);
    ctx.uploadFrameUniforms(this.glow, state);
    gl.uniform4fv(gl.getUniformLocation(gp, 'uTrail'), this.trailData);
    gl.uniform1i(gl.getUniformLocation(gp, 'uTrailCount'), this.trail.length);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  dispose(): void {
    if (!this.ctx) return;
    const gl = this.ctx.gl;
    for (const p of [this.dust, this.glow]) if (p) gl.deleteProgram(p.program);
    this.dust = this.glow = null;
  }
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}
