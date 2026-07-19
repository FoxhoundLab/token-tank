/**
 * Force-layout engine for the Agentic OS mesh. Pure module — no React,
 * no deps. Seeded PRNG so the settled layout is identical run to run
 * (which also makes StrictMode double-mounts invisible).
 *
 * Forces per tick, all scaled by a cooling alpha:
 *   pair repulsion 1/d² · link springs toward per-kind rest lengths ·
 *   cluster gravity toward group ring anchors · centroid recentering.
 * A live pointer adds a local radial push so the mesh reacts to the
 * cursor without reheating the whole layout.
 */

import type { GraphEdge, GraphNode } from "../data/mission";

export interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  ax: number; // group anchor
  ay: number;
  phase: number; // per-node drift phase, render-side
  pinned: boolean;
  ref: GraphNode;
}

interface SimEdge {
  a: number; // node indices
  b: number;
  rest: number;
}

const REST: Record<GraphEdge["kind"], number> = {
  hosts: 74,
  runs_on: 80,
  stores: 90,
  uses: 100,
  builds: 100,
  feeds: 110,
  commands: 122,
};

/** mulberry32 — tiny deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Sim {
  nodes: SimNode[] = [];
  alpha = 1;
  private edges: SimEdge[] = [];
  private byId = new Map<string, number>();
  private w: number;
  private h: number;
  private fx: number; // mesh center as a fraction of the canvas
  private fy: number;
  private restScale = 1;
  private pointer: { x: number; y: number } | null = null;
  private dragged: number | null = null;
  private anchorUnits = new Map<string, { x: number; y: number }>();

  constructor(
    graphNodes: GraphNode[],
    graphEdges: GraphEdge[],
    w: number,
    h: number,
    seed = 0xc0ffee,
    fx = 0.5,
    fy = 0.5,
  ) {
    this.w = Math.max(w, 1);
    this.h = Math.max(h, 1);
    this.fx = fx;
    this.fy = fy;
    const rand = mulberry32(seed);

    // Group anchors as unit vectors on a ring, "core" in the center.
    // Kept as units so resize can recompute real anchors from scratch
    // instead of scaling them (scaling breaks on degenerate sizes).
    const groups = Array.from(new Set(graphNodes.map((n) => n.group)));
    const ring = groups.filter((g) => g !== "core");
    this.anchorUnits.set("core", { x: 0, y: 0 });
    ring.forEach((g, i) => {
      const th = (i / ring.length) * Math.PI * 2 - Math.PI / 2;
      this.anchorUnits.set(g, { x: Math.cos(th), y: Math.sin(th) });
    });

    this.nodes = graphNodes.map((n, i) => {
      this.byId.set(n.id, i);
      return {
        id: n.id,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        r: 5 + 3 * (n.weight ?? 1),
        ax: 0,
        ay: 0,
        phase: rand() * Math.PI * 2,
        pinned: false,
        ref: n,
      };
    });
    this.applyAnchors();
    for (const n of this.nodes) {
      n.x = n.ax + (rand() - 0.5) * 60;
      n.y = n.ay + (rand() - 0.5) * 60;
    }

    this.edges = graphEdges.flatMap((e) => {
      const a = this.byId.get(e.source);
      const b = this.byId.get(e.target);
      if (a === undefined || b === undefined) return [];
      return [{ a, b, rest: REST[e.kind] }];
    });

    this.restScale = w < 700 ? 0.72 : 1;
  }

  get settled(): boolean {
    return this.alpha < 0.02;
  }

  reheat(a: number): void {
    this.alpha = Math.max(this.alpha, a);
  }

  /** Recompute pixel anchors from the unit ring for the current size. */
  private applyAnchors(): void {
    const R = Math.min(this.w, this.h) * 0.3;
    for (const n of this.nodes) {
      const u = this.anchorUnits.get(n.ref.group) ?? { x: 0, y: 0 };
      n.ax = this.w * this.fx + u.x * R;
      n.ay = this.h * this.fy + u.y * R;
    }
  }

  resize(w: number, h: number, fx = this.fx, fy = this.fy): void {
    if (w < 2 || h < 2) return; // transient zero-size layout — ignore
    const sx = w / this.w;
    const sy = h / this.h;
    this.w = w;
    this.h = h;
    this.fx = fx;
    this.fy = fy;
    this.restScale = w < 700 ? 0.72 : 1;
    this.applyAnchors();
    for (const n of this.nodes) {
      n.x = Number.isFinite(n.x * sx) ? n.x * sx : n.ax;
      n.y = Number.isFinite(n.y * sy) ? n.y * sy : n.ay;
    }
  }

  setPointer(x: number, y: number): void {
    this.pointer = { x, y };
  }

  clearPointer(): void {
    this.pointer = null;
  }

  /** Pin a node to a dragged position (velocity zeroed). */
  drag(id: string, x: number, y: number): void {
    const i = this.byId.get(id);
    if (i === undefined) return;
    const n = this.nodes[i];
    n.x = x;
    n.y = y;
    n.vx = 0;
    n.vy = 0;
    n.pinned = true;
    this.dragged = i;
  }

  endDrag(): void {
    if (this.dragged !== null) this.nodes[this.dragged].pinned = false;
    this.dragged = null;
  }

  nearest(x: number, y: number, slack = 6): SimNode | null {
    let best: SimNode | null = null;
    let bestD = Infinity;
    for (const n of this.nodes) {
      const d = Math.hypot(n.x - x, n.y - y);
      if (d < n.r + slack && d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best;
  }

  tick(): void {
    const a = this.alpha;
    const N = this.nodes;

    // Pair repulsion — O(N²), microseconds at this node count.
    for (let i = 0; i < N.length; i++) {
      for (let j = i + 1; j < N.length; j++) {
        const p = N[i];
        const q = N[j];
        let dx = p.x - q.x;
        let dy = p.y - q.y;
        const d = Math.max(Math.hypot(dx, dy), 20);
        const f = (6000 * a) / (d * d);
        dx /= d;
        dy /= d;
        p.vx += dx * f;
        p.vy += dy * f;
        q.vx -= dx * f;
        q.vy -= dy * f;
      }
    }

    // Link springs.
    for (const e of this.edges) {
      const p = N[e.a];
      const q = N[e.b];
      let dx = q.x - p.x;
      let dy = q.y - p.y;
      const d = Math.max(Math.hypot(dx, dy), 1);
      const f = 0.06 * a * (d - e.rest * this.restScale);
      dx /= d;
      dy /= d;
      p.vx += dx * f;
      p.vy += dy * f;
      q.vx -= dx * f;
      q.vy -= dy * f;
    }

    // Cluster gravity + pointer push.
    const ptr = this.pointer;
    for (const n of N) {
      n.vx += (n.ax - n.x) * 0.03 * a;
      n.vy += (n.ay - n.y) * 0.03 * a;
      if (ptr) {
        const dx = n.x - ptr.x;
        const dy = n.y - ptr.y;
        const d = Math.hypot(dx, dy);
        // Dead zone inside 26px: the node being aimed at must not flee
        // the cursor, or it becomes unclickable. Beyond it, a gentle
        // shimmer-push so the mesh visibly reacts to the pointer.
        if (d < 120 && d > 26) {
          const f = 0.9 * (1 - d / 120);
          n.vx += (dx / d) * f;
          n.vy += (dy / d) * f;
        }
      }
    }

    // Integrate + recenter the centroid so the mesh never drifts away.
    let cx = 0;
    let cy = 0;
    for (const n of N) {
      if (!n.pinned) {
        n.vx *= 0.6;
        n.vy *= 0.6;
        const v = Math.hypot(n.vx, n.vy);
        if (v > 8) {
          n.vx = (n.vx / v) * 8;
          n.vy = (n.vy / v) * 8;
        }
        n.x += n.vx;
        n.y += n.vy;
      }
      cx += n.x;
      cy += n.y;
    }
    cx = this.w * this.fx - cx / N.length;
    cy = this.h * this.fy - cy / N.length;
    for (const n of N) {
      n.x += cx;
      n.y += cy;
    }

    this.alpha *= 0.97;
  }

  /** Reduced-motion path: settle synchronously (<10ms at this size). */
  runToSettle(maxTicks = 900): void {
    let t = 0;
    while (this.alpha >= 0.02 && t < maxTicks) {
      this.tick();
      t++;
    }
  }
}
