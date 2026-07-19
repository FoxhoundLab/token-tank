/**
 * MissionControl — the default view. A tall scroll driver holds a
 * sticky full-viewport stage: the Agentic OS mesh as backdrop, the
 * vitals rail overlaying left, bracket chips floating around the mesh
 * with per-chip parallax, and the primary-directive hero at the bottom.
 * Scroll progress is lerped once per frame into a shared mutable camera
 * object (mesh push-in) and chip transforms — no React re-renders in
 * the scroll path, GPU transforms only (scroll-film discipline).
 * Below the stage: Operations and Commander panels in normal flow.
 *
 * Every zone renders with the API down; live joins degrade to "—".
 */

import { useEffect, useRef, useState } from "react";
import { AgentGraph } from "./AgentGraph";
import type { ScrollCamera } from "./AgentGraph";
import { VitalsRail } from "./VitalsRail";
import { OpsBoard } from "./OpsBoard";
import { CommanderPanel } from "./CommanderPanel";
import { StatusGlyph } from "./StatusGlyph";
import { getAllQuotas, getProviderHistory, getProviders } from "../api/client";
import { campaign, persona, projects } from "../data/mission";
import { formatTMinus, formatTokens } from "../utils/format";
import { parseUTC } from "../utils/time";
import type { DashboardData, ProviderHistory, QuotaWindowsResponse } from "../types";

interface MissionControlProps {
  data: DashboardData | null;
  error: string | null;
}

const HOT_PROJECTS = new Set(
  projects.filter((p) => p.status === "hot").map((p) => p.id),
);

/** Chip parallax speeds — index-matched to render order below. */
const CHIP_SPEEDS = [42, 66, 34, 58];

export function MissionControl({ data, error }: MissionControlProps) {
  const [quotas, setQuotas] = useState<QuotaWindowsResponse[]>([]);
  const [histories, setHistories] = useState<Map<string, ProviderHistory>>(new Map());
  const [now, setNow] = useState(() => Date.now());
  const driverRef = useRef<HTMLDivElement | null>(null);
  const chipsRef = useRef<HTMLDivElement | null>(null);
  const cameraRef = useRef<ScrollCamera>({ p: 0 });

  // Same slow-poll the Dashboard runs — quotas + 7d histories, 30s.
  useEffect(() => {
    const fetchSlow = async () => {
      try {
        setQuotas(await getAllQuotas());
      } catch {
        // silent — vitals degrade to static rows
      }
      try {
        const registered = await getProviders();
        const results = await Promise.all(
          registered.map(async (p) => {
            try {
              return await getProviderHistory(p.id, "7d");
            } catch {
              return null;
            }
          }),
        );
        setHistories(
          new Map(
            results
              .filter((h): h is ProviderHistory => h !== null)
              .map((h) => [h.provider, h]),
          ),
        );
      } catch {
        // silent
      }
    };
    fetchSlow();
    const id = setInterval(fetchSlow, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Scroll choreography — one rAF loop lerping progress into the camera
  // and the chip transforms. Reduced motion: progress snaps, no parallax.
  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let raf = 0;
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const driver = driverRef.current;
      if (!driver) return;
      const r = driver.getBoundingClientRect();
      const span = r.height - window.innerHeight;
      const target = span > 1 ? Math.max(0, Math.min(1, -r.top / span)) : 0;
      const cam = cameraRef.current;
      cam.p = reduced.matches ? target : cam.p + (target - cam.p) * 0.12;
      const chips = chipsRef.current;
      if (chips && !reduced.matches) {
        const kids = chips.children;
        for (let i = 0; i < kids.length; i++) {
          const el = kids[i] as HTMLElement;
          el.style.transform = `translateY(${(-cam.p * (CHIP_SPEEDS[i] ?? 40)).toFixed(1)}px)`;
          el.style.opacity = `${1 - cam.p * 0.35}`;
        }
      }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  const quotaMap = new Map(quotas.map((q) => [q.provider, q]));
  const liveProviders = new Set(
    quotas.filter((q) => q.windows.length > 0).map((q) => q.provider),
  );

  // Hero telemetry — weekly burn summed across providers' weekly windows,
  // history 7d totals as fallback. Real numbers or an honest dash.
  let weeklyTokens = 0;
  for (const q of quotas) {
    const wk = q.windows.find((w) => w.window_type === "weekly" && w.unit === "tokens");
    if (wk) weeklyTokens += wk.used;
  }
  if (weeklyTokens === 0) {
    for (const h of histories.values()) {
      weeklyTokens += h.daily_totals.reduce((s, d) => s + d.total_tokens, 0);
    }
  }

  const hot = projects.find((p) => p.status === "hot");
  const deadlineMs = hot?.deadline ? parseUTC(hot.deadline) - now : null;
  const campStart = parseUTC(`${campaign.windowStart}T00:00:00`);
  const campEnd = parseUTC(`${campaign.windowEnd}T23:59:59`);
  const dayPct = Math.max(
    0,
    Math.min(100, ((now - campStart) / (campEnd - campStart)) * 100),
  );
  const activeWorkflows = 1; // n8n audit: Gadget & More RAG drafter
  const linkDown = error !== null && data === null;

  return (
    <div className="mission">
      <div className="mission-driver" ref={driverRef}>
        <div className="mission-stage">
          <AgentGraph
            liveProviders={liveProviders}
            hotProjects={HOT_PROJECTS}
            camera={cameraRef.current}
          />

          <header className="mission-masthead">
            <h1 className="mission-title">FoxhoundLab</h1>
            <span className="mission-subtitle">Mission Control Cockpit</span>
            <span className="t-micro">operator: {persona.callsign}</span>
            <div className="mission-masthead-status">
              <StatusGlyph
                kind={linkDown ? "error" : "live"}
                label={linkDown ? "link down" : "core online"}
              />
              <StatusGlyph
                kind={hot ? "warn" : "standby"}
                label={hot ? `primary: ${hot.name}` : "no primary"}
              />
            </div>
          </header>

          <VitalsRail quotas={quotaMap} histories={histories} />

          <div className="mission-chips" ref={chipsRef}>
            <div className="mesh-chip chip-tl">
              <span className="mesh-chip-title">◈ Ship Preflight</span>
              <span className="mesh-chip-sub">
                {deadlineMs !== null ? formatTMinus(deadlineMs) : "—"} · core + stripe @ $59
              </span>
            </div>
            <div className="mesh-chip chip-tr">
              <span className="mesh-chip-title">◈ Day-90 Campaign</span>
              <span className="mesh-chip-sub">
                {dayPct.toFixed(0)}% elapsed · break-even {campaign.breakEvenSalesPerMonth}/mo
              </span>
            </div>
            <div className="mesh-chip chip-bl">
              <span className="mesh-chip-title">◈ n8n Automation</span>
              <span className="mesh-chip-sub">{activeWorkflows}/8 workflows active</span>
            </div>
            <div className="mesh-chip chip-br">
              <span className="mesh-chip-title">◈ Model Roster</span>
              <span className="mesh-chip-sub">3 cloud · 4 local · 2 hosts</span>
            </div>
          </div>

          <footer className="mission-hero">
            <span className="t-micro mission-hero-eyebrow">
              primary directive · market contact
            </span>
            <div className="mission-hero-value">
              {deadlineMs !== null ? formatTMinus(deadlineMs) : "T-∞"}
              <span className="mission-hero-unit">to ship</span>
            </div>
            <div className="mission-hero-strip t-micro">
              <span>
                weekly burn{" "}
                <strong>{weeklyTokens > 0 ? `${formatTokens(weeklyTokens)} tok` : "—"}</strong>
              </span>
              <span>
                break-even <strong>{campaign.breakEvenSalesPerMonth} sales/mo</strong>
              </span>
              <span>
                day-90 <strong>{dayPct.toFixed(0)}%</strong>
              </span>
            </div>
          </footer>
        </div>
      </div>

      <div className="mission-band">
        <OpsBoard />
        <CommanderPanel />
      </div>
    </div>
  );
}
