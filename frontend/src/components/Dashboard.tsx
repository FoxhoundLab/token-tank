import { useState, useEffect, useRef } from "react";
import { ProviderCard } from "./ProviderCard";
import type { PulseState } from "./ProviderCard";
import { StatusGlyph } from "./StatusGlyph";
import { SystemStatus } from "./SystemStatus";
import { TokenTankLogo } from "./TokenTankLogo";
import { getAllQuotas, getProviderHistory, getProviders } from "../api/client";
import type { DashboardData, ProviderHistory, QuotaWindowsResponse } from "../types";

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

/** Per-provider traffic pulse — LIVE while the observed token total keeps
    climbing, decaying to STANDBY 60s after the last increase. Same honest
    detection the topbar signal uses, per unit. */
function useProviderPulse(data: DashboardData | null): Map<string, PulseState> {
  const [pulse, setPulse] = useState<Map<string, PulseState>>(new Map());
  const prev = useRef<Map<string, number>>(new Map());
  const lastTraffic = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (!data) return;
    const now = Date.now();
    for (const p of data.providers) {
      const last = prev.current.get(p.provider);
      if (last !== undefined && p.today_tokens > last) {
        lastTraffic.current.set(p.provider, now);
      }
      prev.current.set(p.provider, p.today_tokens);
    }
    setPulse(
      new Map(
        data.providers.map((p) => {
          const at = lastTraffic.current.get(p.provider);
          return [p.provider, at !== undefined && now - at < 60_000 ? "live" : "standby"];
        }),
      ),
    );
  }, [data]);

  return pulse;
}

export function Dashboard({ data, error }: DashboardProps) {
  const [quotas, setQuotas] = useState<QuotaWindowsResponse[]>([]);
  const [histories, setHistories] = useState<Map<string, ProviderHistory>>(new Map());
  const [polledAt, setPolledAt] = useState<number | undefined>(undefined);
  const events = useEventLog(data);
  const pulse = useProviderPulse(data);

  // Stamp the moment fresh telemetry arrives — the cards' POLL readout.
  useEffect(() => {
    if (data) setPolledAt(Date.now());
  }, [data]);

  // Quotas + 7d histories refresh less often (30s) — they change slower
  // than per-request usage. Both come from pre-existing endpoints.
  useEffect(() => {
    const fetchSlow = async () => {
      try {
        setQuotas(await getAllQuotas());
      } catch {
        // Silent failure — quotas are optional enhancement
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
        // Silent failure — history readouts degrade to "—"
      }
    };
    fetchSlow();
    const interval = setInterval(fetchSlow, 30000);
    return () => clearInterval(interval);
  }, []);

  const quotaByProviderName = new Map(quotas.map((q) => [q.provider, q]));

  // Full error panel only before the first successful load.
  if (error && !data) {
    return (
      <div className="state-panel state-error">
        <TokenTankLogo size={240} className="state-watermark" />
        <StatusGlyph kind="error" label="link down" />
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
        <div className="sweep-rail">
          <div className="sweep-fill" />
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
            <ProviderCard
              data={p}
              quota={quotaByProviderName.get(p.provider)}
              history={histories.get(p.provider)}
              pulse={pulse.get(p.provider) ?? "standby"}
              updatedAt={polledAt}
              unit={i + 1}
            />
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
