import { FuelGauge } from "./FuelGauge";
import type { ProviderSummary } from "../types";

interface ProviderCardProps {
  data: ProviderSummary;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function ProviderCard({ data }: ProviderCardProps) {
  const fuelPct = Math.round(data.fuel_level * 100);

  return (
    <div className="provider-card">
      <div className="provider-header">
        <h3>{data.display_name}</h3>
        <span className="provider-tag">{data.provider}</span>
      </div>
      <FuelGauge level={data.fuel_level} label={`${fuelPct}% remaining`} />
      <div className="provider-stats">
        <div className="stat">
          <span className="stat-label">Today</span>
          <span className="stat-value">{formatTokens(data.today_tokens)} tok</span>
          <span className="stat-sub">${data.today_cost.toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">This Month</span>
          <span className="stat-value">{formatTokens(data.month_tokens)} tok</span>
          <span className="stat-sub">${data.month_cost.toFixed(2)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Burn Rate</span>
          <span className="stat-value">{formatTokens(data.burn_rate_tokens_per_hour)}/hr</span>
          <span className="stat-sub">${data.burn_rate_cost_per_hour.toFixed(2)}/hr</span>
        </div>
      </div>
    </div>
  );
}
