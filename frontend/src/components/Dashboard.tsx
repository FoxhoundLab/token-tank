import { useState, useEffect, type CSSProperties } from "react";
import { ProviderCard } from "./ProviderCard";
import { SystemStatus } from "./SystemStatus";
import { TokenTankLogo } from "./TokenTankLogo";
import { getDashboard, getAllQuotas } from "../api/client";
import type { DashboardData, QuotaWindowsResponse } from "../types";

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
  const [quotas, setQuotas] = useState<QuotaWindowsResponse[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const d = await getDashboard();
        setData(d);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load dashboard");
      }
    };
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, []);

  // Quotas refresh less often (30s) — they change slower than per-request usage
  useEffect(() => {
    const fetchQuotas = async () => {
      try {
        const q = await getAllQuotas();
        setQuotas(q);
      } catch {
        // Silent failure — quotas are optional enhancement
      }
    };
    fetchQuotas();
    const interval = setInterval(fetchQuotas, 30000);
    return () => clearInterval(interval);
  }, []);

  // Build a quick lookup map
  const quotaByProviderId = new Map(quotas.map((q) => [q.provider_id, q]));
  const quotaByProviderName = new Map(quotas.map((q) => [q.provider, q]));

  // Only show the full error panel before the first successful load; once we
  // have data, a transient poll failure shouldn't blow away the dashboard.
  if (error && !data) {
    return (
      <div className="state-panel state-error">
        <TokenTankLogo size={220} className="state-watermark" />
        <h2 className="state-title">Link down</h2>
        <p className="state-sub">No response from the pump</p>
        <div className="state-diag">
          <span className="state-diag-row">
            <span className="state-diag-key">endpoint</span> /api/v1/dashboard
          </span>
          <span className="state-diag-row">
            <span className="state-diag-key">error</span> {error}
          </span>
          <span className="state-diag-row">
            <span className="state-diag-key">fix</span> token-tank start
          </span>
        </div>
      </div>
    );
  }

  if (!data) {
    return <SkeletonGrid />;
  }

  if (data.providers.length === 0) {
    return (
      <div className="state-panel">
        <TokenTankLogo size={220} className="state-watermark" />
        <h2 className="state-title">Tank empty</h2>
        <p className="state-sub">Nothing on the manifold</p>
        <p className="state-detail">Connect a provider in Settings — the needle moves on its own after that.</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <SystemStatus providers={data.providers} />
      <div className="provider-grid">
        {data.providers.map((p, i) => (
          <div
            key={p.provider}
            className="card-slot"
            style={{ "--card-i": i } as CSSProperties}
          >
            <ProviderCard
              data={p}
              quota={quotaByProviderId.get(
                // Try id first, fall back to name-based lookup
                (p as any).id || ""
              ) || quotaByProviderName.get(p.provider)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
