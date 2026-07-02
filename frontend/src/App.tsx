import { useState, useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { TokenTankLogo } from "./components/TokenTankLogo";
import { getInitialTheme, applyTheme, nextTheme, THEME_META } from "./theme";
import type { ThemeName } from "./theme";

type View = "dashboard" | "settings";
type LinkState = "ok" | "error" | "idle";

/** Poll /health so the status pill reflects backend connectivity. */
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

/** Gauge dial glyph — dashboard nav. */
function GaugeIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <path d="M2 12.5a6.5 6.5 0 0 1 12 0" />
      <line x1="8" y1="12.5" x2="11" y2="7.5" />
      <line x1="1.5" y1="12.5" x2="14.5" y2="12.5" />
    </svg>
  );
}

/** Cog glyph — settings nav. */
function CogIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <circle cx="8" cy="8" r="2.4" />
      <path d="M8 1.5v2.2M8 12.3v2.2M1.5 8h2.2M12.3 8h2.2M3.4 3.4l1.6 1.6M11 11l1.6 1.6M12.6 3.4L11 5M5 11l-1.6 1.6" />
    </svg>
  );
}

/** Swatch glyph — theme cycle. */
function SwatchIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.4">
      <rect x="2" y="2" width="12" height="12" />
      <path d="M2 10l4-4 3 3 2-2 3 3" />
    </svg>
  );
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const link = useLinkState();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="side-brand">
          <span className="side-logo" aria-hidden="true">
            <TokenTankLogo size={22} />
          </span>
          <span className="side-wordmark">Token Tank</span>
        </div>

        <nav className="side-nav">
          <button
            className={`side-link ${view === "dashboard" ? "active" : ""}`}
            onClick={() => setView("dashboard")}
          >
            <GaugeIcon />
            <span>Dashboard</span>
          </button>
          <button
            className={`side-link ${view === "settings" ? "active" : ""}`}
            onClick={() => setView("settings")}
          >
            <CogIcon />
            <span>Settings</span>
          </button>
          <button
            className="side-link"
            onClick={() => setTheme((t) => nextTheme(t))}
            title="Cycle theme"
            aria-label={`Theme: ${THEME_META[theme].label}. Activate to cycle.`}
          >
            <SwatchIcon />
            <span>{THEME_META[theme].label}</span>
          </button>
        </nav>

        <div className="side-foot">
          <span className={`conn-pill conn-${link}`} aria-hidden="true">
            <span className="conn-dot" />
          </span>
          <span className="side-status" role="status">
            {link === "ok" ? "Link up" : link === "error" ? "Link down" : "Probing"}
          </span>
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <span className="topbar-title">
            {view === "dashboard" ? "Instruments" : "Settings"}
          </span>
          <span className="topbar-meta">proxy :8848 · api :8000</span>
        </header>
        <main className="app-main">
          {view === "dashboard" ? (
            <Dashboard />
          ) : (
            <Settings theme={theme} onThemeChange={setTheme} />
          )}
        </main>
      </div>
    </div>
  );
}
