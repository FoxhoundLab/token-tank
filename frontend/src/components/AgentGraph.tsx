/**
 * AgentGraph — the Agentic OS mesh. One Canvas 2D layer drawing three
 * strata: a perspective grid floor, an ambient particle field (sprite
 * blits, never shadowBlur), and the real labeled node graph driven by
 * the force sim. The cursor is a local field: nearby nodes and motes
 * yield to it. Scroll progress (via a shared mutable ref, no re-renders)
 * pushes the camera in and rotates the mesh a few degrees.
 *
 * Hover highlights a node's neighborhood; click pins a DOM detail
 * readout. Reduced motion: the layout settles synchronously and renders
 * static — interaction still works, nothing drifts.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Sim } from "../graph/sim";
import { graph } from "../data/mission";
import type { GraphNode, NodeKind } from "../data/mission";
import { useThemeColors } from "../utils/useThemeColors";
import type { ThemeColors } from "../utils/useThemeColors";

export interface ScrollCamera {
  p: number; // lerped scroll progress 0..1
}

interface AgentGraphProps {
  /** Provider slugs with live quota telemetry — those nodes get a live ring. */
  liveProviders: Set<string>;
  /** Project ids in HOT status — warn ring. */
  hotProjects: Set<string>;
  /** Shared mutable scroll progress; parent mutates, we read per frame. */
  camera: ScrollCamera;
}

interface Particle {
  x: number;
  y: number;
  z: number; // depth 0.35–1
  vx: number;
  vy: number;
  phase: number;
}

const EDGE_DASHED = new Set(["feeds", "stores"]);

/** Adjacency + neighbor lookup, computed once from the static graph. */
function buildAdjacency() {
  const neighbors = new Map<string, Set<string>>();
  for (const n of graph.nodes) neighbors.set(n.id, new Set());
  for (const e of graph.edges) {
    neighbors.get(e.source)?.add(e.target);
    neighbors.get(e.target)?.add(e.source);
  }
  return neighbors;
}

function makeSprite(accentRgb: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 32;
  c.height = 32;
  const ctx = c.getContext("2d");
  if (ctx) {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, `rgba(${accentRgb}, 0.9)`);
    g.addColorStop(0.35, `rgba(${accentRgb}, 0.28)`);
    g.addColorStop(1, `rgba(${accentRgb}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
  }
  return c;
}

function drawShape(
  ctx: CanvasRenderingContext2D,
  kind: NodeKind,
  x: number,
  y: number,
  r: number,
  fill: boolean,
): void {
  ctx.beginPath();
  switch (kind) {
    case "human":
    case "project":
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    case "orchestrator":
    case "lane":
    case "hardware":
      ctx.moveTo(x, y - r * 1.25);
      ctx.lineTo(x + r * 1.25, y);
      ctx.lineTo(x, y + r * 1.25);
      ctx.lineTo(x - r * 1.25, y);
      ctx.closePath();
      break;
    case "workflow":
      ctx.moveTo(x, y - r * 1.2);
      ctx.lineTo(x + r * 1.1, y + r * 0.9);
      ctx.lineTo(x - r * 1.1, y + r * 0.9);
      ctx.closePath();
      break;
    case "vault":
      ctx.rect(x - r, y - r, r * 2, r * 2);
      break;
    default:
      // agent · model · service
      ctx.arc(x, y, r, 0, Math.PI * 2);
  }
  const hollow = kind === "vault" || kind === "hardware" || kind === "service";
  if (fill && !hollow) ctx.fill();
  else ctx.stroke();
}

export function AgentGraph({ liveProviders, hotProjects, camera }: AgentGraphProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<Sim | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const spriteRef = useRef<HTMLCanvasElement | null>(null);
  const hoverRef = useRef<string | null>(null);
  const dragRef = useRef<{ id: string; moved: number } | null>(null);
  const rafRef = useRef<number>(0);
  const lastDrawRef = useRef(0);
  const colorsRef = useRef<ThemeColors | null>(null);
  const liveRef = useRef(liveProviders);
  const hotRef = useRef(hotProjects);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const pinnedRef = useRef<string | null>(null);
  const colors = useThemeColors();
  const neighbors = useMemo(buildAdjacency, []);

  const reduced = useMemo(
    () => window.matchMedia("(prefers-reduced-motion: reduce)"),
    [],
  );

  liveRef.current = liveProviders;
  hotRef.current = hotProjects;
  pinnedRef.current = pinnedId;
  colorsRef.current = colors;

  // Rebuild the glow sprite when the accent changes (theme switch).
  useEffect(() => {
    spriteRef.current = makeSprite(colors.accentRgb);
  }, [colors.accentRgb]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    // Guard degenerate mount sizes (mid-layout); RO corrects once real.
    let w = wrap.clientWidth > 40 ? wrap.clientWidth : 800;
    let h = wrap.clientHeight > 40 ? wrap.clientHeight : 600;
    const meshFx = () => (w > 900 ? 0.56 : 0.5);
    const meshFy = () => (w > 900 ? 0.48 : 0.44);

    const fit = () => {
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    fit();

    const sim = new Sim(graph.nodes, graph.edges, w, h, 0xc0ffee, meshFx(), meshFy());
    simRef.current = sim;

    // Ambient particle field, seeded off the sim's determinism needs nothing:
    // particles are pure atmosphere, so Math.random-free init via a simple LCG.
    let prand = 0x9e3779b9;
    const rnd = () => {
      prand = (Math.imul(prand, 1664525) + 1013904223) >>> 0;
      return prand / 4294967296;
    };
    const count = Math.max(90, Math.min(240, Math.round((w * h) / 6500)));
    particlesRef.current = Array.from({ length: count }, () => ({
      x: rnd() * w,
      y: rnd() * h,
      z: 0.35 + rnd() * 0.65,
      vx: (rnd() - 0.5) * 0.22,
      vy: (rnd() - 0.5) * 0.22,
      phase: rnd() * Math.PI * 2,
    }));

    let pointer: { x: number; y: number } | null = null;

    /** Camera transform: push-in + slight rotation with scroll. */
    const cam = () => {
      const p = camera.p;
      const zoom = 1 + 0.12 * p;
      const rot = 0.1 * p;
      const cx = w * meshFx();
      const cy = h * meshFy();
      return { zoom, rot, cx, cy, sin: Math.sin(rot), cos: Math.cos(rot) };
    };
    const toScreen = (x: number, y: number) => {
      const c = cam();
      const dx = x - c.cx;
      const dy = y - c.cy;
      return {
        x: c.cx + (dx * c.cos - dy * c.sin) * c.zoom,
        y: c.cy + (dx * c.sin + dy * c.cos) * c.zoom - 24 * camera.p,
      };
    };
    const toWorld = (x: number, y: number) => {
      const c = cam();
      const dx = (x - c.cx) / c.zoom;
      const dy = (y + 24 * camera.p - c.cy) / c.zoom;
      return {
        x: c.cx + dx * c.cos + dy * c.sin,
        y: c.cy - dx * c.sin + dy * c.cos,
      };
    };

    const draw = (t: number) => {
      const col = colorsRef.current;
      if (!col) return;
      const drift = reduced.matches ? 0 : 1;
      ctx.clearRect(0, 0, w, h);

      // ── Perspective grid floor ──
      const horizon = h * 0.82;
      ctx.strokeStyle = `rgba(${col.accentRgb}, 0.10)`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = -8; i <= 8; i++) {
        ctx.moveTo(w / 2 + i * (w / 16), h + 4);
        ctx.lineTo(w / 2 + i * (w / 64), horizon);
      }
      for (let i = 0; i < 6; i++) {
        const y = horizon + (h - horizon) * (i / 5) ** 1.7;
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // ── Particle field ──
      const sprite = spriteRef.current;
      const parts = particlesRef.current;
      if (drift) {
        for (const p of parts) {
          p.x += p.vx * p.z;
          p.y += p.vy * p.z;
          if (pointer) {
            const dx = p.x - pointer.x;
            const dy = p.y - pointer.y;
            const d = Math.hypot(dx, dy);
            if (d < 120 && d > 0.5) {
              const f = 0.5 * (1 - d / 120);
              p.x += (dx / d) * f;
              p.y += (dy / d) * f;
            }
          }
          if (p.x < -10) p.x = w + 10;
          if (p.x > w + 10) p.x = -10;
          if (p.y < -10) p.y = h + 10;
          if (p.y > h + 10) p.y = -10;
        }
      }
      // faint interconnects
      ctx.strokeStyle = `rgba(${col.accentRgb}, 1)`;
      for (let i = 0; i < parts.length; i++) {
        for (let j = i + 1; j < parts.length; j++) {
          const a = parts[i];
          const b = parts[j];
          const dx = a.x - b.x;
          if (dx > 64 || dx < -64) continue;
          const dy = a.y - b.y;
          if (dy > 64 || dy < -64) continue;
          const d = Math.hypot(dx, dy);
          if (d < 64) {
            ctx.globalAlpha = (1 - d / 64) * 0.10 * Math.min(a.z, b.z);
            ctx.beginPath();
            const pa = toScreen(a.x, a.y);
            const pb = toScreen(b.x, b.y);
            ctx.moveTo(pa.x, pa.y);
            ctx.lineTo(pb.x, pb.y);
            ctx.stroke();
          }
        }
      }
      ctx.globalAlpha = 1;
      if (sprite) {
        for (const p of parts) {
          const tw = drift ? 0.65 + 0.35 * Math.sin(t * 0.0011 + p.phase) : 0.8;
          const s = (7 + 11 * p.z) * tw;
          const sp = toScreen(p.x, p.y - 18 * camera.p * (1 - p.z));
          ctx.globalAlpha = 0.5 * p.z * tw;
          ctx.drawImage(sprite, sp.x - s / 2, sp.y - s / 2, s, s);
        }
        ctx.globalAlpha = 1;
      }

      // ── Real graph ──
      const sim2 = simRef.current;
      if (!sim2) return;
      const focus = hoverRef.current ?? pinnedRef.current;
      const hood = focus ? neighbors.get(focus) : undefined;
      const pos = new Map<string, { x: number; y: number }>();
      for (const n of sim2.nodes) {
        const ox = drift * 1.2 * Math.sin(t * 0.0004 + n.phase);
        const oy = drift * 1.2 * Math.cos(t * 0.0003 + 1.7 * n.phase);
        pos.set(n.id, toScreen(n.x + ox, n.y + oy));
      }

      // edges
      for (const e of graph.edges) {
        const a = pos.get(e.source);
        const b = pos.get(e.target);
        if (!a || !b) continue;
        const inHood =
          focus !== null &&
          focus !== undefined &&
          (e.source === focus || e.target === focus);
        ctx.setLineDash(EDGE_DASHED.has(e.kind) ? [4, 3] : []);
        if (inHood) {
          for (const [lw, al] of [
            [6, 0.08],
            [3, 0.16],
            [1, 0.9],
          ] as const) {
            ctx.lineWidth = lw;
            ctx.strokeStyle = `rgba(${col.accentRgb}, ${al})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        } else {
          ctx.lineWidth = 1;
          ctx.strokeStyle = col.dim;
          ctx.globalAlpha = focus ? 0.1 : 0.35;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      ctx.setLineDash([]);

      // nodes + labels
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.textAlign = "center";
      for (const n of sim2.nodes) {
        const p = pos.get(n.id);
        if (!p) continue;
        const g: GraphNode = n.ref;
        const isFocus = focus === n.id;
        const inHood2 = isFocus || (hood ? hood.has(n.id) : false);
        const dimmed = focus !== null && focus !== undefined && !inHood2;
        const isHot = g.projectId ? hotRef.current.has(g.projectId) : false;
        const isLive = g.providerId ? liveRef.current.has(g.providerId) : false;
        const base =
          g.kind === "human" || g.kind === "orchestrator" || g.kind === "lane"
            ? col.fg
            : isHot
              ? col.warn
              : col.accent;

        ctx.globalAlpha = dimmed ? 0.18 : 1;
        // glow rings — layered strokes, no blur
        ctx.strokeStyle = base;
        ctx.lineWidth = 1;
        ctx.globalAlpha = (dimmed ? 0.05 : 0.1) * (isFocus ? 2.4 : 1);
        drawShape(ctx, g.kind, p.x, p.y, n.r + 6, false);
        ctx.globalAlpha = (dimmed ? 0.08 : 0.25) * (isFocus ? 2.2 : 1);
        drawShape(ctx, g.kind, p.x, p.y, n.r + 3, false);
        // body
        ctx.globalAlpha = dimmed ? 0.22 : 1;
        ctx.fillStyle = base;
        ctx.lineWidth = 1.5;
        drawShape(ctx, g.kind, p.x, p.y, n.r, true);
        // live / hot ring
        if ((isLive || isHot) && !dimmed) {
          ctx.strokeStyle = isHot ? col.warn : col.accent;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.9;
          ctx.beginPath();
          ctx.arc(p.x, p.y, n.r + 4.5, 0, Math.PI * 2);
          ctx.stroke();
        }
        // label
        ctx.globalAlpha = dimmed ? 0.15 : inHood2 ? 1 : 0.75;
        ctx.fillStyle = isFocus ? col.fg : col.label;
        ctx.fillText(g.label, p.x, p.y + n.r + 14);
        ctx.globalAlpha = 1;
      }
    };

    const loop = (t: number) => {
      rafRef.current = requestAnimationFrame(loop);
      const sim2 = simRef.current;
      if (!sim2) return;
      if (!reduced.matches) {
        let n = 0;
        while (!sim2.settled && n < 3) {
          sim2.tick();
          n++;
        }
        // 30fps is plenty once settled — drift + twinkle only.
        if (sim2.settled && t - lastDrawRef.current < 33) return;
      } else if (t - lastDrawRef.current < 100) {
        return; // reduced motion: redraw sparsely (interactions still update)
      }
      lastDrawRef.current = t;
      draw(t);
    };

    // Pre-settle at mount so the first paint is the composed mesh, not
    // the mid-explosion state. The live loop then only drifts + reacts.
    sim.runToSettle();
    document.fonts.ready.then(
      () => draw(performance.now()),
      () => {},
    );
    rafRef.current = requestAnimationFrame(loop);

    const ro = new ResizeObserver(() => {
      const nw = wrap.clientWidth;
      const nh = wrap.clientHeight;
      if (nw < 40 || nh < 40) return; // transient collapsed layout
      if (nw === w && nh === h) return;
      w = nw;
      h = nh;
      fit();
      sim.resize(w, h, meshFx(), meshFy());
      if (reduced.matches) sim.runToSettle();
      else sim.reheat(0.3);
      // fit() cleared the bitmap — repaint now rather than waiting on
      // the rAF loop (which background panes throttle to zero).
      draw(performance.now());
    });
    ro.observe(wrap);

    // ── Pointer interaction ──
    const local = (ev: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: ev.clientX - r.left, y: ev.clientY - r.top };
    };
    const onMove = (ev: PointerEvent) => {
      const { x, y } = local(ev);
      const wpt = toWorld(x, y);
      const drag = dragRef.current;
      if (drag) {
        drag.moved += 2;
        sim.drag(drag.id, wpt.x, wpt.y);
        sim.reheat(0.25);
        return;
      }
      pointer = wpt;
      sim.setPointer(wpt.x, wpt.y);
      if (!reduced.matches) sim.reheat(0.05);
      const hit = sim.nearest(wpt.x, wpt.y, 10);
      hoverRef.current = hit ? hit.id : null;
      canvas.style.cursor = hit ? "pointer" : "default";
    };
    const onLeave = () => {
      pointer = null;
      sim.clearPointer();
      hoverRef.current = null;
    };
    const onDown = (ev: PointerEvent) => {
      const { x, y } = local(ev);
      const wpt = toWorld(x, y);
      const hit = sim.nearest(wpt.x, wpt.y, 10);
      if (hit) {
        dragRef.current = { id: hit.id, moved: 0 };
        canvas.setPointerCapture(ev.pointerId);
      }
    };
    const onUp = (ev: PointerEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      sim.endDrag();
      if (canvas.hasPointerCapture(ev.pointerId)) {
        canvas.releasePointerCapture(ev.pointerId);
      }
      if (drag && drag.moved < 5) {
        setPinnedId((cur) => (cur === drag.id ? null : drag.id));
      } else if (!drag) {
        setPinnedId(null); // tap on empty space clears the pin
      }
      if (reduced.matches) draw(performance.now());
    };
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerleave", onLeave);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointerup", onUp);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerleave", onLeave);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointerup", onUp);
      simRef.current = null;
    };
    // The draw loop reads colors/live/hot through refs; effect runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pinned = pinnedId ? graph.nodes.find((n) => n.id === pinnedId) : undefined;
  const pinnedEdges = pinnedId
    ? graph.edges.filter((e) => e.source === pinnedId || e.target === pinnedId)
    : [];
  const labelOf = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;

  return (
    <div ref={wrapRef} className="graph-canvas-wrap">
      <canvas ref={canvasRef} className="graph-canvas" aria-label="Agentic OS mesh" />
      {pinned && (
        <aside className="graph-detail" aria-live="polite">
          <div className="graph-detail-head">
            <span className="graph-detail-title">{pinned.label}</span>
            <button
              className="graph-detail-close"
              onClick={() => setPinnedId(null)}
              aria-label="Close node detail"
            >
              ✕
            </button>
          </div>
          <span className="tag">{pinned.kind}</span>
          {pinned.detail?.map((line) => (
            <div key={line} className="graph-detail-line">
              {line}
            </div>
          ))}
          <div className="graph-detail-links">
            {pinnedEdges.map((e) => {
              const other = e.source === pinned.id ? e.target : e.source;
              const dir = e.source === pinned.id ? "→" : "←";
              return (
                <div key={`${e.source}-${e.target}-${e.kind}`} className="graph-detail-link">
                  <span className="graph-detail-kind">{e.kind.replace("_", " ")}</span>
                  <span>
                    {dir} {labelOf(other)}
                  </span>
                </div>
              );
            })}
          </div>
        </aside>
      )}
      <div className="graph-legend t-micro" aria-hidden="true">
        <span>■ human</span>
        <span>◆ runtime</span>
        <span>● agent·model</span>
        <span>▲ workflow</span>
        <span>□ vault</span>
        <span>◇ hardware</span>
      </div>
    </div>
  );
}
