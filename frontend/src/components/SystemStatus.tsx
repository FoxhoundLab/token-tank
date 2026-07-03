/**
 * SystemStatus — the flight controller. First read of the cockpit.
 * Header band carries the status word; body is one hero number
 * (tokens burned today), the aggregate fuel dial, and a 2×2 stats grid.
 * All values derived from live dashboard data.
 */

import { FuelGauge } from "./FuelGauge";
import type { ProviderSummary } from "../types";

interface SystemStatusProps {
  providers: ProviderSummary[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

export function SystemStatus({ providers }: SystemStatusProps) {
  const metered = providers.filter((p) => p.provider_type !== "local");
  const minFuel = metered.length
    ? Math.min(...metered.map((p) => p.fuel_level))
    : 1;

  const status =
    minFuel >= 0.5
      ? { word: "Nominal", cls: "ok" }
      : minFuel >= 0.2
        ? { word: "Running hot", cls: "warn" }
        : { word: "Reserve", cls: "danger" };

  const todayTokens = providers.reduce((s, p) => s + p.today_tokens, 0);
  const totalBurn = providers.reduce((s, p) => s + p.burn_rate_tokens_per_hour, 0);
  const spendToday = providers.reduce((s, p) => s + p.today_cost, 0);
  const dominant = providers.reduce(
    (top, p) => (p.today_tokens > top.today_tokens ? p : top),
    providers[0],
  );

  return (
    <section className="panel notched" aria-label="System status">
      <div className="panel-band">
        <span className="panel-title">System Status</span>
        <span className={`status-word status-${status.cls}`} role="status">
          {status.word}
        </span>
      </div>
      <div className="panel-body status-body">
        <div className="status-hero">
          <span className="t-micro">Tokens burned today</span>
          <span className="hero-num">
            {formatTokens(todayTokens)}
            <span className="hero-unit">tok</span>
          </span>
        </div>
        <div className="status-gauge">
          <FuelGauge
            level={minFuel}
            label={`min tank ${Math.round(minFuel * 100)}%`}
          />
        </div>
        <div className="status-stats">
          <div className="status-cell">
            <span className="t-micro">Spend today</span>
            <span className="status-cell-value">${spendToday.toFixed(2)}</span>
          </div>
          <div className="status-cell">
            <span className="t-micro">Burn rate</span>
            <span className="status-cell-value">
              {formatTokens(totalBurn)}
              <span className="status-cell-unit">tok/hr</span>
            </span>
          </div>
          <div className="status-cell">
            <span className="t-micro">Dominant</span>
            <span className="status-cell-value">{dominant.display_name}</span>
          </div>
          <div className="status-cell">
            <span className="t-micro">Providers online</span>
            <span className="status-cell-value">{providers.length}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
