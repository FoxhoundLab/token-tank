import { useState, useEffect } from "react";
import { ProviderCard } from "./ProviderCard";
import { getDashboard } from "../api/client";
import type { DashboardData } from "../types";

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const d = await getDashboard();
        setData(d);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    };
    fetch();
    const interval = setInterval(fetch, 5000);
    return () => clearInterval(interval);
  }, []);

  if (error) {
    return (
      <div className="dashboard-error">
        <p>⚠️ {error}</p>
        <p>Make sure the backend is running on port 8000.</p>
      </div>
    );
  }

  if (!data) {
    return <div className="dashboard-loading">Loading...</div>;
  }

  if (data.providers.length === 0) {
    return (
      <div className="dashboard-empty">
        <p>⛽ No providers connected yet.</p>
        <p>Go to Settings to add your first AI provider.</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="provider-grid">
        {data.providers.map((p) => (
          <ProviderCard key={p.provider} data={p} />
        ))}
      </div>
    </div>
  );
}
