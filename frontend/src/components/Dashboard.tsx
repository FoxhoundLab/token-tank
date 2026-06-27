import { useState, useEffect } from "react";
import { ProviderCard } from "./ProviderCard";
import { getDashboard } from "../api/client";
import type { DashboardData } from "../types";

function SkeletonGrid() {
  return (
    <div className="provider-grid">
      {[0, 1, 2].map((i) => (
        <div key={i} className="provider-card skeleton-card" aria-hidden="true">
          <div className="skeleton skeleton-line" style={{ width: "60%" }} />
          <div className="skeleton skeleton-gauge" />
          <div className="skeleton-stats">
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line" />
          </div>
        </div>
      ))}
    </div>
  );
}

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

  // Only show the full error panel before the first successful load; once we
  // have data, a transient poll failure shouldn't blow away the dashboard.
  if (error && !data) {
    return (
      <div className="dashboard-error state-panel">
        <div className="state-icon">⚠️</div>
        <p className="state-title">{error}</p>
        <p className="muted">Make sure Token Tank is running — try <code>token-tank start</code>.</p>
      </div>
    );
  }

  if (!data) {
    return <SkeletonGrid />;
  }

  if (data.providers.length === 0) {
    return (
      <div className="dashboard-empty state-panel">
        <div className="state-icon">⛽</div>
        <p className="state-title">No providers connected yet</p>
        <p className="muted">Head to <strong>Settings</strong> to add your first AI provider and watch the gauge fill up.</p>
      </div>
    );
  }

  return (
    <div className="dashboard fade-in">
      <div className="provider-grid">
        {data.providers.map((p) => (
          <ProviderCard key={p.provider} data={p} />
        ))}
      </div>
    </div>
  );
}
