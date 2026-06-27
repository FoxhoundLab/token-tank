import { useState, useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";

type View = "dashboard" | "settings";
type Theme = "dark" | "light";

function getInitialTheme(): Theme {
  const saved = localStorage.getItem("tt-theme");
  return saved === "light" ? "light" : "dark";
}

export default function App() {
  const [view, setView] = useState<View>("dashboard");
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tt-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

  return (
    <div className="app">
      <header className="app-header">
        <h1>⛽ Token Tank</h1>
        <nav>
          <button
            className={view === "dashboard" ? "active" : ""}
            onClick={() => setView("dashboard")}
          >
            Dashboard
          </button>
          <button
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
          >
            Settings
          </button>
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
            aria-label="Toggle color theme"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </nav>
      </header>
      <main className="app-main">
        {view === "dashboard" ? <Dashboard /> : <Settings />}
      </main>
    </div>
  );
}
