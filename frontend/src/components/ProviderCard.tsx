import type { CSSProperties } from "react";
import { FuelGauge } from "./FuelGauge";
import { QuotaBar } from "./QuotaBar";
import type { ProviderSummary, QuotaWindowsResponse } from "../types";

interface ProviderCardProps {
  data: ProviderSummary;
  quota?: QuotaWindowsResponse;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

function fuelState(fuel: number): "ok" | "warn" | "error" {
  if (fuel >= 0.5) return "ok";
  if (fuel >= 0.2) return "warn";
  return "error";
}

function CardHeader({ data, pill, apiTier }: { data: ProviderSummary; pill: "ok" | "warn" | "error" | "idle"; apiTier?: string }) {
  return (
    <div className="card-header">
      <span className="card-title">{data.display_name}</span>
      <span className="card-header-right">
        <span className="type-badge">{data.provider_type}</span>
        {apiTier && apiTier !== "plan" && (
          <span className="tier-badge" data-tier={apiTier}>{apiTier}</span>
        )}
        <span className={`conn-pill conn-${pill}`} aria-label={`Status: ${pill}`}>
          <span className="conn-dot" />
        </span>
      </span>
    </div>
  );
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {sub && <span className="stat-sub">{sub}</span>}
    </div>
  );
}

/** Subscription (Anthropic, OpenAI): usage window is the tank. Gauge is hero. */
function SubscriptionCard({ data, quota }: ProviderCardProps) {
  const pct = Math.round(data.fuel_level * 100);
  const state = fuelState(data.fuel_level);
  const quotaWindows = quota?.windows || [];
  return (
    <div className={`provider-card card-subscription fuel-${state}`}>
      <CardHeader data={data} pill={state} apiTier={data.api_tier} />
      {/* Compact readout — visible at small viewport only */}
      <div className="compact-readout">
        <span className={`compact-pct compact-${state}`}>{pct}%</span>
        <span className="compact-tokens">{formatTokens(data.today_tokens)} tok</span>
      </div>
      <FuelGauge
        level={data.fuel_level}
        label={`${pct}% · ${formatTokens(data.today_tokens)} tok`}
      />
      {quotaWindows.length > 0 && (
        <div className="quota-stack">
          {quotaWindows.map((w) => (
            <QuotaBar key={w.id} window={w} />
          ))}
        </div>
      )}
      <div className="card-stats">
        <StatCell label="Today" value={`${formatTokens(data.today_tokens)}`} sub={`$${data.today_cost.toFixed(2)}`} />
        <StatCell label="Month" value={`${formatTokens(data.month_tokens)}`} sub={`$${data.month_cost.toFixed(2)}`} />
        <StatCell label="Burn/hr" value={`${formatTokens(data.burn_rate_tokens_per_hour)}`} sub={`$${data.burn_rate_cost_per_hour.toFixed(2)}`} />
      </div>
    </div>
  );
}

/** API (Z.AI, MiniMax): pay-per-token. Spend is the headline, tank is a strip. */
function ApiCard({ data, quota }: ProviderCardProps) {
  const segments = 20;
  const lit = Math.round(data.fuel_level * segments);
  const state = fuelState(data.fuel_level);
  const quotaWindows = quota?.windows || [];
  return (
    <div className={`provider-card card-api fuel-${state}`}>
      <CardHeader data={data} pill={state} apiTier={data.api_tier} />
      {/* Compact readout — visible at small viewport only */}
      <div className="compact-readout">
        <span className={`compact-pct compact-${state}`}>${data.today_cost.toFixed(2)}</span>
        <span className="compact-tokens">{formatTokens(data.today_tokens)} tok</span>
      </div>
      <div className="spend-tiles">
        <div className="spend-tile">
          <span className="stat-label">Spend today</span>
          <span className="spend-value">${data.today_cost.toFixed(2)}</span>
        </div>
        <div className="spend-tile">
          <span className="stat-label">Spend month</span>
          <span className="spend-value">${data.month_cost.toFixed(2)}</span>
        </div>
      </div>
      <div className="segment-bar" role="img" aria-label={`Balance ${Math.round(data.fuel_level * 100)}%`}>
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={`segment ${i < lit ? "lit" : ""}`}
            style={{ "--seg-i": i } as CSSProperties}
          />
        ))}
      </div>
      <div className="segment-readout">{Math.round(data.fuel_level * 100)}% balance</div>
      {quotaWindows.length > 0 && (
        <div className="quota-stack">
          {quotaWindows.map((w) => (
            <QuotaBar key={w.id} window={w} />
          ))}
        </div>
      )}
      <div className="card-stats">
        <StatCell label="Today" value={`${formatTokens(data.today_tokens)} tok`} />
        <StatCell label="Month" value={`${formatTokens(data.month_tokens)} tok`} />
        <StatCell label="Burn/hr" value={`${formatTokens(data.burn_rate_tokens_per_hour)}`} sub={`$${data.burn_rate_cost_per_hour.toFixed(2)}`} />
      </div>
    </div>
  );
}

/** Local (Ollama, LM Studio): no meter, no bill. The tank is bottomless. */
function LocalCard({ data }: ProviderCardProps) {
  return (
    <div className="provider-card card-local">
      <CardHeader data={data} pill="ok" />
      {/* Compact readout — visible at small viewport only */}
      <div className="compact-readout">
        <span className="compact-pct compact-ok">∞</span>
        <span className="compact-tokens">{formatTokens(data.today_tokens)} tok</span>
      </div>
      <FuelGauge level={1} infinite label="∞ · no meter" />
      <div className="local-cost">$0.00</div>
      <div className="card-stats">
        <StatCell label="Today" value={`${formatTokens(data.today_tokens)} tok`} />
        <StatCell label="Month" value={`${formatTokens(data.month_tokens)} tok`} />
        <StatCell label="Burn/hr" value={`${formatTokens(data.burn_rate_tokens_per_hour)}`} />
      </div>
    </div>
  );
}

export function ProviderCard({ data, quota }: ProviderCardProps) {
  switch (data.provider_type) {
    case "subscription":
      return <SubscriptionCard data={data} quota={quota} />;
    case "local":
      return <LocalCard data={data} />;
    default:
      return <ApiCard data={data} quota={quota} />;
  }
}
