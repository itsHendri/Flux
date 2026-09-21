/**
 * The growing graph behind `synapse`: every hit adds a node, and nodes connect.
 *
 * Kept free of GL so the growth rules can be tested. The mode feeds it onsets
 * and packs it into two float textures each frame (`packNodes`/`packEdges`).
 *
 * Storage is two rings. Node slots are reused oldest-first once the memory is
 * full, so a long set keeps growing at the edge while the oldest stars fade;
 * every node carries its `order` (how many nodes came before it), so an edge
 * can tell a live endpoint from a slot that has since been reused, and dies
 * with it instead of snapping across the constellation.
 */

export interface StarNode {
  x: number;
  y: number;
  z: number;
  /** Seconds (app time) it appeared. */
  born: number;
  /** How many nodes were added before this one. Identifies it across slot reuse. */
  order: number;
  /** Where in the spectrum the hit that made it sat, 0 = bass .. 1 = air. */
  band: number;
  /** Relative size, from how loud the hit was. */
  size: number;
  /** Last time it fired (a beat lit it); -Infinity if never. */
  fired: number;
}

export interface StarEdge {
  /** Endpoint orders (not slots): see the file comment. */
  a: number;
  b: number;
  born: number;
  /** Last time a pulse was sent along it, and from which end. */
  fired: number;
  fromA: boolean;
}

export type Rng = () => number;

/**
 * How many of the oldest nodes are fading out, ahead of their slot being
 * reused — at most; a small memory fades its oldest quarter instead, or every
 * node in it would be fading.
 */
export const FADE_SPAN = 24;
/** Links per new node: its parent, plus at most this many near neighbours. */
const EXTRA_LINKS = 1;

export class Constellation {
  private readonly nodes: (StarNode | null)[];
  private readonly edges: (StarEdge | null)[];
  private added = 0;
  private edgeCount = 0;

  constructor(readonly maxNodes = 256) {
    this.nodes = new Array(maxNodes).fill(null);
    this.edges = new Array(maxNodes * (1 + EXTRA_LINKS)).fill(null);
  }

  get maxEdges(): number {
    return this.edges.length;
  }

  /** Total nodes ever added since the last reset (the seed included). */
  get total(): number {
    return this.added;
  }

  /** Nodes currently alive. */
  get size(): number {
    return Math.min(this.added, this.maxNodes);
  }

  /** Start again from one star at the centre. */
  reset(time: number): void {
    this.nodes.fill(null);
    this.edges.fill(null);
    this.added = 0;
    this.edgeCount = 0;
    this.place(0, 0, 0, time, 0.5, 1);
  }

  /** The node with this order, if its slot hasn't been reused since. */
  byOrder(order: number): StarNode | null {
    if (order < 0) return null;
    const n = this.nodes[order % this.maxNodes];
    return n && n.order === order ? n : null;
  }

  /** How many of the oldest nodes are fading (see FADE_SPAN). */
  get fadeSpan(): number {
    return Math.max(1, Math.min(FADE_SPAN, Math.floor(this.maxNodes / 4)));
  }

  /**
   * 0..1 — how present a node still is. The newest nodes are 1; the
   * `fadeSpan` oldest ramp down to 0 as their slot comes up for reuse.
   */
  presence(order: number): number {
    if (!this.byOrder(order)) return 0;
    const span = this.fadeSpan;
    if (this.added <= this.maxNodes - span) return 1;
    // Position counted from the node whose slot is reused next.
    const fromOldest = order - (this.added - this.maxNodes);
    return Math.max(0, Math.min(1, fromOldest / span));
  }

  /**
   * Grow by one node. The parent is usually the newest node, so a run of
   * hits leaves a filament, and sometimes any live node, so the graph
   * branches instead of drawing one long line. `spread` scales the step.
   */
  grow(time: number, band: number, level: number, rng: Rng, spread = 1): StarNode {
    const newest = this.byOrder(this.added - 1);
    let parent = newest;
    if (!parent || rng() < 0.3) {
      parent = this.randomLive(rng) ?? newest;
    }
    const px = parent?.x ?? 0;
    const py = parent?.y ?? 0;
    const pz = parent?.z ?? 0;

    // A random direction, leaning outward so the constellation spreads rather
    // than knotting at the centre.
    const u = rng() * 2 - 1;
    const phi = rng() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    let dx = r * Math.cos(phi);
    let dy = u * 0.7;
    let dz = r * Math.sin(phi);
    const plen = Math.hypot(px, py, pz);
    if (plen > 1e-6) {
      dx += (px / plen) * 0.6;
      dy += (py / plen) * 0.6;
      dz += (pz / plen) * 0.6;
    }
    const dlen = Math.hypot(dx, dy, dz) || 1;
    // Low hits take long steps, high ones short — bass builds the skeleton,
    // hats fill in the detail.
    const step = spread * (0.28 + 0.3 * (1 - band)) * (0.8 + 0.4 * rng());
    let x = px + (dx / dlen) * step;
    let y = py + (dy / dlen) * step;
    let z = pz + (dz / dlen) * step;
    // Past the edge of the sky: fold back toward the centre.
    const limit = 2.6 * spread;
    const len = Math.hypot(x, y, z);
    if (len > limit) {
      const k = (limit * (0.55 + 0.3 * rng())) / len;
      x *= k;
      y *= k;
      z *= k;
    }

    const node = this.place(x, y, z, time, band, 0.6 + level * 0.9);
    if (parent) this.link(parent.order, node.order, time);
    const near = this.nearest(node, parent?.order ?? -1, 0.55 * spread);
    if (near) this.link(near.order, node.order, time);
    return node;
  }

  /** Light a node and send a pulse out along every live edge that touches it. */
  fire(order: number, time: number): void {
    const n = this.byOrder(order);
    if (!n) return;
    n.fired = time;
    for (const e of this.edges) {
      if (!e) continue;
      if (e.a === order || e.b === order) {
        e.fired = time;
        e.fromA = e.a === order;
      }
    }
  }

  /** A random live node, or null if there are none. */
  randomLive(rng: Rng): StarNode | null {
    const n = this.size;
    if (n === 0) return null;
    // Live orders are the last `n` added.
    const order = this.added - 1 - Math.floor(rng() * n);
    return this.byOrder(order);
  }

  /** Live edges: both endpoints still exist. */
  liveEdges(): StarEdge[] {
    return this.edges.filter(
      (e): e is StarEdge => !!e && !!this.byOrder(e.a) && !!this.byOrder(e.b),
    );
  }

  liveNodes(): StarNode[] {
    return this.nodes.filter((n): n is StarNode => !!n);
  }

  /** Radius of the smallest sphere about `c` (default the origin) holding every live node. */
  radius(c: [number, number, number] = [0, 0, 0]): number {
    let r = 0;
    for (const n of this.nodes) if (n) r = Math.max(r, Math.hypot(n.x - c[0], n.y - c[1], n.z - c[2]));
    return r;
  }

  /**
   * Mean position of the live nodes, weighted by presence so fading stars let
   * go of the camera gradually. Growth wanders — a filament can carry the
   * whole sky off to one side — so the camera frames this, not the origin.
   */
  centroid(): [number, number, number] {
    let x = 0;
    let y = 0;
    let z = 0;
    let wsum = 0;
    for (const n of this.nodes) {
      if (!n) continue;
      const w = Math.max(0.05, this.presence(n.order));
      x += n.x * w;
      y += n.y * w;
      z += n.z * w;
      wsum += w;
    }
    return wsum > 0 ? [x / wsum, y / wsum, z / wsum] : [0, 0, 0];
  }

  slotOf(order: number): number {
    return order % this.maxNodes;
  }

  private place(x: number, y: number, z: number, time: number, band: number, size: number): StarNode {
    const node: StarNode = { x, y, z, born: time, order: this.added, band, size, fired: -Infinity };
    this.nodes[this.added % this.maxNodes] = node;
    this.added++;
    return node;
  }

  private link(a: number, b: number, time: number): void {
    if (a === b) return;
    this.edges[this.edgeCount % this.edges.length] = { a, b, born: time, fired: time, fromA: true };
    this.edgeCount++;
  }

  private nearest(to: StarNode, exclude: number, within: number): StarNode | null {
    let best: StarNode | null = null;
    let bestD = within;
    for (const n of this.nodes) {
      if (!n || n.order === to.order || n.order === exclude) continue;
      const d = Math.hypot(n.x - to.x, n.y - to.y, n.z - to.z);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }
}

/**
 * Nodes → a (maxNodes × 2) RGBA float texture, one texel column per slot.
 * Row 0: x, y, z, born. Row 1: band, size, fired, presence (0 = empty slot).
 * `fired` of −Infinity is written as −1e6 so it survives the upload as a
 * finite "long ago".
 */
export function packNodes(c: Constellation, out: Float32Array): void {
  const w = c.maxNodes;
  out.fill(0);
  for (const n of c.liveNodes()) {
    const s = c.slotOf(n.order) * 4;
    out[s] = n.x;
    out[s + 1] = n.y;
    out[s + 2] = n.z;
    out[s + 3] = n.born;
    const t = (w + c.slotOf(n.order)) * 4;
    out[t] = n.band;
    out[t + 1] = n.size;
    out[t + 2] = Number.isFinite(n.fired) ? n.fired : -1e6;
    out[t + 3] = c.presence(n.order);
  }
}

/**
 * Edges → a (maxEdges × 2) RGBA float texture. Row 0: slot of a, slot of b,
 * born, fired. Row 1: 1 if the pulse runs from a, presence (the fainter
 * endpoint's; 0 = no edge), 0, 0.
 */
export function packEdges(c: Constellation, out: Float32Array): void {
  const w = c.maxEdges;
  out.fill(0);
  c.liveEdges().forEach((e, i) => {
    const s = i * 4;
    out[s] = c.slotOf(e.a);
    out[s + 1] = c.slotOf(e.b);
    out[s + 2] = e.born;
    out[s + 3] = e.fired;
    const t = (w + i) * 4;
    out[t] = e.fromA ? 1 : 0;
    out[t + 1] = Math.min(c.presence(e.a), c.presence(e.b));
  });
}

/**
 * Turns the decaying onset pulse into discrete hits: a hit when the pulse
 * crosses `threshold`, then nothing until it has fallen back below the re-arm
 * level and a minimum gap has passed — so one drum hit is one node, not one per
 * frame of its decay.
 */
export class HitGate {
  private armed = true;
  private last = -Infinity;

  constructor(private readonly minGap = 0.09) {}

  reset(): void {
    this.armed = true;
    this.last = -Infinity;
  }

  update(pulse: number, time: number, threshold: number): boolean {
    if (pulse < threshold * 0.5) this.armed = true;
    if (this.armed && pulse >= threshold && time - this.last >= this.minGap) {
      this.armed = false;
      this.last = time;
      return true;
    }
    return false;
  }
}

/** Where a hit sits in the spectrum, 0 = all bass .. 1 = all highs. */
export function hitBand(bass: number, mid: number, high: number): number {
  const sum = bass + mid + high;
  if (sum < 1e-4) return 0.5;
  return (mid * 0.5 + high) / sum;
}
