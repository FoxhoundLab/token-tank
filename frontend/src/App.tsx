import { useState, useEffect, useRef } from "react";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { TokenTankLogo } from "./components/TokenTankLogo";
import { StatusGlyph } from "./components/StatusGlyph";
import { getDashboard } from "./api/client";
import { getInitialTheme, applyTheme, nextTheme, THEME_META } from "./theme";
import type { ThemeName } from "./theme";
import type { DashboardData } from "./types";

type View = "dashboard" | "settings";
type LinkState = "ok" | "error" | "idle";

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
  const prevTotal = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchDashboard = async () => {
      try {
        const d = await getDashboard();
        if (cancelled) return;
        setData(d);
        setError(null);
        const total = d.providers.reduce((s, p) => s + p.today_tokens, 0);
        if (prevTotal.current !== null && total > prevTotal.current) {
          setLastTrafficAt(Date.now());
        }
        prevTotal.current = total;
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

  return { data, error, lastTrafficAt };
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

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const link = useLinkState();
  const { data, error, lastTrafficAt } = useTelemetry();
  const now = useNow(5000);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const live = lastTrafficAt !== null && now - lastTrafficAt < 60_000;
  const signalText =
    link === "error" ? "link down" : live ? "live" : "standby";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand-pill">
          <TokenTankLogo size={18} />
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
          </span>
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
      <main className="app-main">
        {view === "dashboard" ? (
          <Dashboard data={data} error={error} />
        ) : (
          <Settings theme={theme} onThemeChange={setTheme} usage={data} />
        )}
      </main>
    </div>
  );
}
