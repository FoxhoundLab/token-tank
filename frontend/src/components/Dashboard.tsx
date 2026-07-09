import { useState, useEffect, useRef } from "react";
import { ProviderCard } from "./ProviderCard";
import { SystemStatus } from "./SystemStatus";
import { TokenTankLogo } from "./TokenTankLogo";
import { getAllQuotas } from "../api/client";
import type { DashboardData, QuotaWindowsResponse } from "../types";

interface DashboardProps {
  data: DashboardData | null;
  error: string | null;
}

interface LogEvent {
  time: string;
  msg: string;
  dim?: boolean;
}

function timestamp(): string {
  return new Date().toTimeString().slice(0, 8);
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

/** Client-side telemetry log — real observed events only, never invented. */
function useEventLog(data: DashboardData | null): LogEvent[] {
  const [events, setEvents] = useState<LogEvent[]>([
    { time: timestamp(), msg: "monitor online", dim: true },
  ]);
  const prev = useRef<Map<string, { tokens: number; fuel: number }>>(new Map());

  useEffect(() => {
    if (!data) return;
    const fresh: LogEvent[] = [];
    for (const p of data.providers) {
      const last = prev.current.get(p.provider);
      if (last) {
        const delta = p.today_tokens - last.tokens;
        if (delta > 0) {
          fresh.push({
            time: timestamp(),
            msg: `${p.display_name.toUpperCase()} +${formatTokens(delta)} tok`,
          });
        }
        if (last.fuel > 0.15 && p.fuel_level <= 0.15) {
          fresh.push({
            time: timestamp(),
            msg: `${p.display_name.toUpperCase()} tank low — ${Math.round(p.fuel_level * 100)}%`,
          });
        }
      }
      prev.current.set(p.provider, { tokens: p.today_tokens, fuel: p.fuel_level });
    }
    if (fresh.length) {
      setEvents((old) => [...fresh, ...old].slice(0, 6));
    }
  }, [data]);

  return events;
}

export function Dashboard({ data, error }: DashboardProps) {
  const [quotas, setQuotas] = useState<QuotaWindowsResponse[]>([]);
  const events = useEventLog(data);

  // Quotas refresh less often (30s) — they change slower than per-request usage
  useEffect(() => {
    const fetchQuotas = async () => {
      try {
        setQuotas(await getAllQuotas());
      } catch {
        // Silent failure — quotas are optional enhancement
      }
    };
    fetchQuotas();
    const interval = setInterval(fetchQuotas, 30000);
    return () => clearInterval(interval);
  }, []);

  const quotaByProviderName = new Map(quotas.map((q) => [q.provider, q]));

  // Full error panel only before the first successful load.
  if (error && !data) {
    return (
      <div className="state-panel state-error">
        <TokenTankLogo size={240} className="state-watermark" />
        <h2 className="state-title">Link down</h2>
        <p className="state-sub">No response from the pump</p>
        <div className="state-diag">
          <span>
            <span className="state-diag-key">endpoint</span> /api/v1/dashboard
          </span>
          <span>
            <span className="state-diag-key">error</span> {error}
          </span>
          <span>
            <span className="state-diag-key">fix</span> token-tank start
          </span>
        </div>
      </div>
    );
  }

  // Loading — the glow IS the loading state. No skeletons.
  if (!data) {
    return (
      <div className="loading-strip" aria-label="Acquiring telemetry">
        <div className="rail">
          <div className="rail-fill" style={{ width: "40%" }} />
        </div>
        <span className="t-micro">Acquiring telemetry</span>
      </div>
    );
  }

  if (data.providers.length === 0) {
    return (
      <div className="state-panel">
        <TokenTankLogo size={240} className="state-watermark" />
        <h2 className="state-title">Tank empty</h2>
        <p className="state-sub">No providers on the manifold</p>
        <p className="state-detail">Open Settings — pick a provider, paste a key, watch the rail light up.</p>
      </div>
    );
  }

  return (
    <>
      <SystemStatus providers={data.providers} />
      <div className="provider-grid">
        {data.providers.map((p, i) => (
          <div key={p.provider} className="card-slot">
            <ProviderCard data={p} quota={quotaByProviderName.get(p.provider)} unit={i + 1} />
          </div>
        ))}
      </div>
      <section className="panel event-panel" aria-label="Event log">
        <div className="panel-id">
          <span>EVENT LOG · SESSION</span>
          <span className="panel-id-right">TT-LOG-CLIENT</span>
        </div>
        <div className="panel-band">
          <span className="panel-title">Event Log</span>
          <span className="tag">session</span>
        </div>
        <div className="panel-body">
          <div className="log-lines">
            {events.map((e, i) => (
              <div key={`${e.time}-${i}`} className={`log-line ${e.dim ? "dim" : ""}`}>
                <span className="log-time">{e.time}</span>
                <span className="log-msg">{e.msg}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
