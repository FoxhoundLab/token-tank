import { useState, useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";
import { getInitialTheme, applyTheme, nextTheme, THEME_META } from "./theme";
import type { ThemeName } from "./theme";

type View = "dashboard" | "settings";
type LinkState = "ok" | "error" | "idle";

/** Poll /health so the topbar pill reflects backend connectivity. */
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

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [theme, setTheme] = useState<ThemeName>(getInitialTheme);
  const link = useLinkState();

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">⛽</span>
          <span className="brand-name">Token Tank</span>
          <span
            className={`conn-pill conn-${link}`}
            title={link === "ok" ? "Backend connected" : link === "error" ? "Backend unreachable" : "Checking…"}
            aria-label={`Connection: ${link}`}
          >
            <span className="conn-dot" />
          </span>
        </div>
        <nav className="topnav">
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
            className="nav-btn theme-cycle"
            onClick={() => setTheme((t) => nextTheme(t))}
            title="Cycle theme"
            aria-label="Cycle color theme"
          >
            {THEME_META[theme].label}
          </button>
        </nav>
      </header>
      <main className="app-main">
        {view === "dashboard" ? (
          <Dashboard />
        ) : (
          <Settings theme={theme} onThemeChange={setTheme} />
        )}
      </main>
    </div>
  );
}
