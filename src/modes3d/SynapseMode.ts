import type { CustomMode, CustomModeContext } from '../render/CustomMode.ts';
import type { CompiledProgram } from '../render/Renderer.ts';
import type { FrameState } from '../core/state.ts';
import { perspective, lookAt, type Vec3 } from '../render/math3d.ts';
import { Constellation, hitBand, packEdges, packNodes } from './constellation.ts';
import { HitGate } from '../core/hitGate.ts';
import fullscreenVert from '../shaders/fullscreen.vert?raw';
import edgeVert from '../shaders/modes3d/synapse-edge.vert?raw';
import edgeFrag from '../shaders/modes3d/synapse-edge.frag?raw';
import nodeVert from '../shaders/modes3d/synapse-node.vert?raw';
import nodeFrag from '../shaders/modes3d/synapse-node.frag?raw';
import bgFrag from '../shaders/modes3d/synapse-bg.frag?raw';

/**
 * SYNAPSE — every hit adds a star to a growing constellation (photism).
 *
 * The first mode in FLUX that **accumulates**: everything else redraws the
 * present, and even `spectro` only scrolls a window of it. Here each onset adds
 * a node, linked to the graph, so over a track the music leaves a structure —
 * a busy passage a dense cluster, a sparse one a long filament — and when the
 * memory is full the oldest stars fade out as new ones arrive.
 *
 * The graph lives on the CPU (`constellation.ts`, tested); each frame it's
 * packed into two small float textures, and edges and nodes are drawn as
 * instanced screen-space quads that read them — no vertex buffers. Additive
 * light, no depth, like magneto: stars sum in any order.
 */
export class SynapseMode implements CustomMode {
  readonly name = 'synapse';

  private ctx: CustomModeContext | null = null;
  private edgeProg: CompiledProgram | null = null;
  private nodeProg: CompiledProgram | null = null;
  private bgProg: CompiledProgram | null = null;
  private nodeTex: WebGLTexture | null = null;
  private edgeTex: WebGLTexture | null = null;
  private nodeData = new Float32Array(0);
  private edgeData = new Float32Array(0);

  private graph = new Constellation(128);
  private readonly hits = new HitGate(0.09);
  private readonly fires = new HitGate(0.2);
  private entered = true;
  private camDist = 3;
  private readonly camTarget: Vec3 = [0, 0, 0];

  init(ctx: CustomModeContext): boolean {
    const gl = ctx.gl;
    const edgeProg = ctx.buildModeProgram(`${this.name}-edge`, edgeVert, edgeFrag);
    const nodeProg = ctx.buildModeProgram(this.name, nodeVert, nodeFrag);
    const bgProg = ctx.buildModeProgram(`${this.name}-bg`, fullscreenVert, bgFrag);
    if (!edgeProg || !nodeProg || !bgProg) {
      for (const p of [edgeProg, nodeProg, bgProg]) if (p) gl.deleteProgram(p.program);
      return false;
    }
    this.disposeGl();
    this.ctx = ctx;
    this.edgeProg = edgeProg;
    this.nodeProg = nodeProg;
    this.bgProg = bgProg;
    return true;
  }

  /** (Re)build the graph and its textures for a memory size. */
  private ensureMemory(max: number, time: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (this.nodeTex && this.graph.maxNodes === max) return;
    const gl = ctx.gl;
    this.graph = new Constellation(max);
    this.graph.reset(time);
    this.hits.reset();
    this.fires.reset();
    this.nodeData = new Float32Array(max * 2 * 4);
    this.edgeData = new Float32Array(this.graph.maxEdges * 2 * 4);
    for (const t of [this.nodeTex, this.edgeTex]) if (t) gl.deleteTexture(t);
    this.nodeTex = makeFloatTexture(gl, max, 2);
    this.edgeTex = makeFloatTexture(gl, this.graph.maxEdges, 2);
  }

  draw(state: FrameState, w: number, h: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.edgeProg || !this.nodeProg || !this.bgProg) return;
    const gl = ctx.gl;
    const t = state.time;

    this.ensureMemory(num(state.controls['uSynMemory'], 128), t);
    if (!this.nodeTex || !this.edgeTex) return;
    // Switched to: a new sky. The constellation is a record of what played
    // while you were watching it, so resuming an old one would be a lie. This
    // is the explicit enter() hook rather than the frame-gap test other modes
    // use, because a sky can take a whole track to build and a single long
    // frame (a GC pause, a file decoding) mustn't wipe it.
    if (this.entered) {
      this.entered = false;
      this.graph.reset(t);
      this.hits.reset();
      this.fires.reset();
      this.camDist = 3;
      this.camTarget.fill(0);
    }

    // Grow on onsets; fire on kicks.
    const a = state.audio;
    const sense = num(state.controls['uSynSense'], 0.55);
    const threshold = 0.95 - sense * 0.7;
    if (this.hits.update(a.onset, t, threshold)) {
      this.graph.grow(t, hitBand(a.bass, a.mid, a.high), a.level, Math.random, num(state.controls['uSynSpread'], 1));
    }
    if (this.fires.update(a.beat, t, 0.6)) {
      const n = this.graph.randomLive(Math.random);
      if (n) this.graph.fire(n.order, t);
    }

    packNodes(this.graph, this.nodeData);
    packEdges(this.graph, this.edgeData);
    uploadFloat(gl, this.nodeTex, this.graph.maxNodes, 2, this.nodeData);
    uploadFloat(gl, this.edgeTex, this.graph.maxEdges, 2, this.edgeData);

    // The camera frames the sky as it grows: it drifts toward the centroid and
    // backs away as the spread widens, both slowly, so it never jumps.
    const ease = 1 - Math.exp(-Math.min(state.dt, 0.1) / 1.5);
    const c = this.graph.centroid();
    for (let i = 0; i < 3; i++) this.camTarget[i] += (c[i] - this.camTarget[i]) * ease;
    const want = Math.max(2.6, this.graph.radius(this.camTarget) * 2.0 + 1.2);
    this.camDist += (want - this.camDist) * ease;
    const orbit = t * 0.07;
    const [tx, ty, tz] = this.camTarget;
    const eye: Vec3 = [
      tx + Math.sin(orbit) * this.camDist,
      ty + Math.sin(t * 0.05) * this.camDist * 0.3,
      tz + Math.cos(orbit) * this.camDist,
    ];
    const proj = perspective(0.9, w / h, 0.05, 60);
    const view = lookAt(eye, this.camTarget);

    ctx.rebindScene();
    gl.useProgram(this.bgProg.program);
    ctx.uploadFrameUniforms(this.bgProg, state);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (const [prog, count] of [
      [this.edgeProg, this.graph.maxEdges],
      [this.nodeProg, this.graph.maxNodes],
    ] as const) {
      const p = prog.program;
      gl.useProgram(p);
      ctx.uploadFrameUniforms(prog, state);
      gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uProj'), false, proj);
      gl.uniformMatrix4fv(gl.getUniformLocation(p, 'uView'), false, view);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.nodeTex);
      gl.uniform1i(gl.getUniformLocation(p, 'uNodes'), 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.edgeTex);
      gl.uniform1i(gl.getUniformLocation(p, 'uEdges'), 1);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    }
    gl.disable(gl.BLEND);
  }

  enter(): void {
    this.entered = true;
  }

  private disposeGl(): void {
    if (!this.ctx) return;
    const gl = this.ctx.gl;
    for (const p of [this.edgeProg, this.nodeProg, this.bgProg]) if (p) gl.deleteProgram(p.program);
    for (const tex of [this.nodeTex, this.edgeTex]) if (tex) gl.deleteTexture(tex);
    this.edgeProg = this.nodeProg = this.bgProg = null;
    this.nodeTex = this.edgeTex = null;
  }

  dispose(): void {
    this.disposeGl();
    this.entered = true;
  }
}

/** An RGBA32F data texture: NEAREST (read with texelFetch), clamped. */
function makeFloatTexture(gl: WebGL2RenderingContext, w: number, h: number): WebGLTexture | null {
  const tex = gl.createTexture();
  if (!tex) return null;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, w, h, 0, gl.RGBA, gl.FLOAT, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.bindTexture(gl.TEXTURE_2D, null);
  return tex;
}

function uploadFloat(
  gl: WebGL2RenderingContext,
  tex: WebGLTexture,
  w: number,
  h: number,
  data: Float32Array,
): void {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, gl.RGBA, gl.FLOAT, data);
}

function num(v: number | number[] | undefined, fallback: number): number {
  return typeof v === 'number' ? v : fallback;
}
