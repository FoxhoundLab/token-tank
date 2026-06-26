import { useState, useEffect } from "react";
import { Dashboard } from "./components/Dashboard";
import { Settings } from "./components/Settings";

type View = "dashboard" | "settings";

export default function App() {
  const [view, setView] = useState<View>("dashboard");

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
        </nav>
      </header>
      <main className="app-main">
        {view === "dashboard" ? <Dashboard /> : <Settings />}
      </main>
    </div>
  );
}
