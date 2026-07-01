import { useState, useEffect } from "react";
import { ProviderCard } from "./ProviderCard";
import { getDashboard } from "../api/client";
import type { DashboardData } from "../types";

/** Fuel-pump glyph (Material "local gas station" path) used as watermark. */
function PumpMark() {
  return (
    <svg viewBox="0 0 24 24" className="state-watermark" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.77 7.23l.01-.01-3.72-3.72L15 4.56l2.11 2.11c-.94.36-1.61 1.26-1.61 2.33 0 1.38 1.12 2.5 2.5 2.5.36 0 .69-.08 1-.21v7.21c0 .55-.45 1-1 1s-1-.45-1-1V14c0-1.1-.9-2-2-2h-1V5c0-1.1-.9-2-2-2H6c-1.1 0-2 .9-2 2v16h10v-7.5h1.5v5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V9c0-.69-.28-1.32-.73-1.77zM12 10H6V5h6v5zm6 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z"
      />
    </svg>
  );
}

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
      <div className="state-panel state-error">
        <PumpMark />
        <h2 className="state-title">Link down</h2>
        <p className="state-sub">Backend unreachable — run token-tank start</p>
        <p className="state-detail">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <SkeletonGrid />;
  }

  if (data.providers.length === 0) {
    return (
      <div className="state-panel">
        <PumpMark />
        <h2 className="state-title">Tank empty</h2>
        <p className="state-sub">No providers connected</p>
        <p className="state-detail">Open Settings to connect your first provider.</p>
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
