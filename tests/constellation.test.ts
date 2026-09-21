import { describe, it, expect } from 'vitest';
import {
  Constellation,
  FADE_SPAN,
  HitGate,
  hitBand,
  packEdges,
  packNodes,
} from '../src/modes3d/constellation.ts';

/** Deterministic rng (mulberry32) so growth is reproducible. */
function rng(seed = 1): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('Constellation — every hit adds a node', () => {
  it('starts from one star at the centre', () => {
    const c = new Constellation(64);
    c.reset(0);
    expect(c.size).toBe(1);
    expect(c.liveNodes()[0]).toMatchObject({ x: 0, y: 0, z: 0 });
    expect(c.liveEdges()).toHaveLength(0);
  });

  it('connects each new node to the graph', () => {
    const c = new Constellation(64);
    c.reset(0);
    const r = rng();
    for (let i = 0; i < 30; i++) c.grow(i, 0.5, 0.5, r);
    expect(c.size).toBe(31);
    // Every node but the seed has at least its parent link, so the graph is
    // one piece: walk it from the seed.
    const adj = new Map<number, number[]>();
    for (const e of c.liveEdges()) {
      adj.set(e.a, [...(adj.get(e.a) ?? []), e.b]);
      adj.set(e.b, [...(adj.get(e.b) ?? []), e.a]);
    }
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) for (const n of adj.get(stack.pop()!) ?? []) if (!seen.has(n)) seen.add(n), stack.push(n);
    expect(seen.size).toBe(31);
  });

  it('keeps growing past its memory, reusing the oldest slots', () => {
    const c = new Constellation(32);
    c.reset(0);
    const r = rng(7);
    for (let i = 0; i < 100; i++) c.grow(i, 0.3, 0.5, r);
    expect(c.size).toBe(32);
    expect(c.total).toBe(101);
    expect(c.byOrder(0)).toBeNull(); // the seed's slot was reused
    expect(c.byOrder(100)).not.toBeNull();
    // No edge survives to a reused slot.
    for (const e of c.liveEdges()) {
      expect(c.byOrder(e.a)).not.toBeNull();
      expect(c.byOrder(e.b)).not.toBeNull();
    }
  });

  it('fades the oldest nodes ahead of reuse, newest fully present', () => {
    const c = new Constellation(64);
    c.reset(0);
    const r = rng(3);
    for (let i = 0; i < 80; i++) c.grow(i, 0.5, 0.5, r);
    const newest = c.total - 1;
    const oldest = c.total - 64;
    expect(c.presence(newest)).toBe(1);
    expect(c.presence(oldest)).toBe(0);
    expect(c.presence(oldest + c.fadeSpan / 2)).toBeCloseTo(0.5, 5);
    expect(c.fadeSpan).toBeLessThanOrEqual(FADE_SPAN);
  });

  it('a small memory does not fade nodes that are nowhere near reuse', () => {
    const c = new Constellation(8);
    c.reset(0);
    c.grow(1, 0.5, 0.5, rng());
    expect(c.presence(0)).toBe(1);
    expect(c.presence(1)).toBe(1);
  });

  it('stays inside the sky however long it grows', () => {
    const c = new Constellation(256);
    c.reset(0);
    const r = rng(11);
    for (let i = 0; i < 1000; i++) c.grow(i, i % 7 === 0 ? 0 : 0.8, 1, r);
    expect(c.radius()).toBeLessThanOrEqual(2.6 + 1e-6);
  });

  it('firing a node sends a pulse out along its edges', () => {
    const c = new Constellation(16);
    c.reset(0);
    const n = c.grow(1, 0.5, 0.5, rng());
    c.fire(0, 5);
    const e = c.liveEdges().find((x) => x.a === 0 || x.b === 0)!;
    expect(e.fired).toBe(5);
    expect(e.fromA).toBe(e.a === 0);
    expect(c.byOrder(0)!.fired).toBe(5);
    expect(n.order).toBe(1);
  });
});

describe('packing for the GPU', () => {
  it('writes each node into its slot column and marks empty slots absent', () => {
    const c = new Constellation(8);
    c.reset(2);
    c.grow(3, 0.25, 1, rng());
    const buf = new Float32Array(8 * 2 * 4);
    packNodes(c, buf);
    const n1 = c.byOrder(1)!;
    expect(buf[4]).toBeCloseTo(n1.x);
    expect(buf[7]).toBe(3); // born
    expect(buf[(8 + 1) * 4]).toBe(0.25); // band
    expect(buf[(8 + 1) * 4 + 2]).toBe(-1e6); // never fired → finite "long ago"
    expect(buf[(8 + 1) * 4 + 3]).toBe(1); // present
    expect(buf[(8 + 5) * 4 + 3]).toBe(0); // empty slot
  });

  it('writes live edges as slot pairs', () => {
    const c = new Constellation(8);
    c.reset(0);
    c.grow(1, 0.5, 0.5, rng());
    const buf = new Float32Array(c.maxEdges * 2 * 4);
    packEdges(c, buf);
    expect([buf[0], buf[1]].sort()).toEqual([0, 1]);
    expect(buf[(c.maxEdges + 0) * 4 + 1]).toBe(1); // presence
    expect(buf[(c.maxEdges + 1) * 4 + 1]).toBe(0); // no second edge
  });
});

describe('HitGate — one hit, one node', () => {
  it('fires once per pulse, not on every frame of its decay', () => {
    const g = new HitGate();
    const hits = [1, 0.8, 0.6, 0.45, 0.2, 0.1].map((p, i) => g.update(p, i * 0.016, 0.4));
    expect(hits.filter(Boolean)).toHaveLength(1);
  });

  it('fires again after the pulse re-arms and the gap has passed', () => {
    const g = new HitGate(0.09);
    expect(g.update(1, 0, 0.4)).toBe(true);
    expect(g.update(0.1, 0.05, 0.4)).toBe(false);
    expect(g.update(1, 0.06, 0.4)).toBe(false); // too soon
    expect(g.update(1, 0.2, 0.4)).toBe(true);
  });
});

describe('hitBand', () => {
  it('reads bass-heavy hits low and bright ones high', () => {
    expect(hitBand(1, 0, 0)).toBe(0);
    expect(hitBand(0, 0, 1)).toBe(1);
    expect(hitBand(0, 0, 0)).toBe(0.5);
  });
});

describe('Constellation framing', () => {
  it('centroid follows the stars, not the origin', () => {
    const c = new Constellation(64);
    c.reset(0);
    const r = rng(5);
    for (let i = 0; i < 12; i++) c.grow(i, 0.2, 0.5, r);
    const [x, y, z] = c.centroid();
    const nodes = c.liveNodes();
    const mean = nodes.reduce((a, n) => a + n.x, 0) / nodes.length;
    expect(x).toBeCloseTo(mean, 5); // nothing fading yet: a plain mean
    expect(Number.isFinite(y) && Number.isFinite(z)).toBe(true);
    expect(c.radius([x, y, z])).toBeLessThanOrEqual(c.radius() + Math.hypot(x, y, z));
  });
});
