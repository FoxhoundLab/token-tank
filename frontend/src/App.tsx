import { useState, useEffect, useRef } from "react";
import { Dashboard } from "./components/Dashboard";
import { MissionControl } from "./components/MissionControl";
import { Settings } from "./components/Settings";
import { TokenTankLogo } from "./components/TokenTankLogo";
import { StatusGlyph } from "./components/StatusGlyph";
import { StatusStrip } from "./components/StatusStrip";
import { getDashboard } from "./api/client";
import { getInitialTheme, applyTheme, nextTheme, THEME_META } from "./theme";
import type { ThemeName } from "./theme";
import type { DashboardData } from "./types";

type View = "mission" | "dashboard" | "settings";
type LinkState = "ok" | "error" | "idle";

/** Token Tank opens as Mission Control; the fuel wall is one tab away. */
const DEFAULT_VIEW: View = "mission";

/** Poll /health so the link indicator reflects backend connectivity. */
function useLinkState(): LinkState {
  const [state, setState] = useState<LinkState>("idle");

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const resp = await fetch("/health");
        if (!cancelled) setState(resp.ok ? "ok" : "error");
      } catch {
        if (!cancelled) setState("error");
      }
    };
    check();
    const id = setInterval(check, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return state;
}

/**
 * App owns the dashboard poll so the live signal keeps beating on every
 * view. Traffic is detected honestly: the signal goes live only when the
 * observed token total actually increases between polls, and decays 60s
 * after the last observed increase.
 */
function useTelemetry() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTrafficAt, setLastTrafficAt] = useState<number | null>(null);
  const [rate, setRate] = useState(0); // tok/s from the last observed increase
  const prevTotal = useRef<number | null>(null);
  const prevAt = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchDashboard = async () => {
      try {
        const d = await getDashboard();
        if (cancelled) return;
        setData(d);
        setError(null);
        const now = Date.now();
        const total = d.providers.reduce((s, p) => s + p.today_tokens, 0);
        if (prevTotal.current !== null && total > prevTotal.current) {
          setLastTrafficAt(now);
          if (prevAt.current !== null && now > prevAt.current) {
            setRate((total - prevTotal.current) / ((now - prevAt.current) / 1000));
          }
        }
        prevTotal.current = total;
        prevAt.current = now;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load dashboard");
        }
      }
    };
    fetchDashboard();
    const id = setInterval(fetchDashboard, 5000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { data, error, lastTrafficAt, rate };
}

/** Tick every 5s so the live signal decays without a data change. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** mm:ss since the last observed traffic — the standby readout. */
function formatAgo(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function App() {
  const [view, setView] = useState<View>(DEFAULT_VIEW);
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const link = useLinkState();
  const { data, error, lastTrafficAt, rate } = useTelemetry();
  const now = useNow(5000);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const live = lastTrafficAt !== null && now - lastTrafficAt < 60_000;
  const signalText =
    link === "error" ? "link down" : live ? "live" : "standby";
  const signalValue =
    link === "error"
      ? null
      : live
        ? `${rate.toFixed(1)} tok/s`
        : lastTrafficAt !== null
          ? `${formatAgo(now - lastTrafficAt)} ago`
          : null;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-pill">
          <span className="brand-badge">
            <TokenTankLogo size={18} />
            <span className="brand-monogram">TT</span>
          </span>
          <span className="brand-word">
            Token <span>Tank</span>
          </span>
        </div>
        <nav className="topnav" aria-label="Primary">
          <span className={`live-signal ${live ? "on" : ""}`}>
            <StatusGlyph
              kind={link === "error" ? "error" : live ? "live" : "standby"}
              label={signalText}
              title={
                live
                  ? "Proxy received traffic in the last 60s"
                  : link === "error"
                    ? "Backend unreachable"
                    : "No proxy traffic in the last 60s"
              }
            />
            {signalValue && <span className="live-rate">{signalValue}</span>}
          </span>
          <button
            className={`nav-btn ${view === "mission" ? "active" : ""}`}
            onClick={() => setView("mission")}
          >
            Mission
          </button>
          <button
            className={`nav-btn ${view === "dashboard" ? "active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={`nav-btn ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            Settings
          </button>
          <button
            className="nav-btn"
            onClick={() => setTheme((t) => nextTheme(t))}
            title="Cycle theme"
            aria-label={`Theme: ${THEME_META[theme].label}. Activate to cycle.`}
          >
            {THEME_META[theme].label}
          </button>
        </nav>
      </header>
      <StatusStrip link={link} pollMs={5000} />
      <main className="app-main">
        {view === "mission" ? (
          <MissionControl data={data} error={error} />
        ) : view === "dashboard" ? (
          <Dashboard data={data} error={error} />
        ) : (
          <Settings theme={theme} onThemeChange={setTheme} usage={data} />
        )}
      </main>
    </div>
  );
}
