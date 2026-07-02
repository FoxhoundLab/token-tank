/**
 * SystemStatus — hero telemetry strip above the provider grid.
 * All values derived from live dashboard data; nothing invented.
 * Status word follows the lowest metered tank: NOMINAL / RUNNING HOT / RESERVE.
 */

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
      ? { word: "System nominal", cls: "ok" }
      : minFuel >= 0.2
        ? { word: "Running hot", cls: "warn" }
        : { word: "Reserve", cls: "error" };

  const totalBurn = providers.reduce((s, p) => s + p.burn_rate_tokens_per_hour, 0);
  const spendToday = providers.reduce((s, p) => s + p.today_cost, 0);
  const dominant = providers.reduce(
    (top, p) => (p.today_tokens > top.today_tokens ? p : top),
    providers[0],
  );

  return (
    <section className={`hero-panel hero-${status.cls}`} aria-label="System status">
      <div className="hero-status">
        <span className="hero-status-block" aria-hidden="true" />
        <span className="hero-status-word">{status.word}</span>
      </div>
      <div className="hero-metrics">
        <div className="hero-metric">
          <span className="hero-metric-label">Burn</span>
          <span className="hero-metric-value">
            {formatTokens(totalBurn)}
            <span className="hero-metric-unit">tok/hr</span>
          </span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-label">Spend today</span>
          <span className="hero-metric-value">${spendToday.toFixed(2)}</span>
        </div>
        <div className="hero-metric hero-metric-wide">
          <span className="hero-metric-label">Dominant</span>
          <span className="hero-metric-value hero-metric-name">
            {dominant.display_name}
            <span className="hero-metric-unit">{formatTokens(dominant.today_tokens)} tok</span>
          </span>
        </div>
        <div className="hero-metric">
          <span className="hero-metric-label">Online</span>
          <span className="hero-metric-value">
            {providers.length}
            <span className="hero-metric-unit">prov</span>
          </span>
        </div>
      </div>
    </section>
  );
}
