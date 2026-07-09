import { SegmentRail } from "./SegmentRail";
import { QuotaBar } from "./QuotaBar";
import type { ProviderSummary, QuotaWindowsResponse } from "../types";

interface ProviderCardProps {
  data: ProviderSummary;
  quota?: QuotaWindowsResponse;
  /** Panel position on the board — drives the "PROVIDER · 03" ID tag. */
  unit?: number;
}

/** Hardware serial tag: TT-ANT-SUB, TT-OLL-LOC, … */
function serial(data: ProviderSummary): string {
  return `TT-${data.provider.slice(0, 3)}-${data.provider_type.slice(0, 3)}`.toUpperCase();
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

/** Escalation from fuel remaining: cyan until 15%, warm, then red. */
function fuelState(fuel: number): "normal" | "low" | "danger" {
  if (fuel <= 0.05) return "danger";
  if (fuel <= 0.15) return "low";
  return "normal";
}

function Band({
  data,
  state,
  unit,
}: {
  data: ProviderSummary;
  state: "normal" | "low" | "danger";
  unit?: number;
}) {
  const dotCls = state === "danger" ? "state-dot danger" : state === "low" ? "state-dot warn" : "state-dot";
  return (
    <>
      <div className="panel-id">
        <span>PROVIDER · {String(unit ?? 0).padStart(2, "0")}</span>
        <span className="panel-id-right">{serial(data)}</span>
      </div>
      <div className="panel-band">
        <span className="panel-title">{data.display_name}</span>
        <span className="panel-band-right">
          <span className="tag">{data.provider_type}</span>
          {data.api_tier && data.api_tier !== "plan" && (
            <span className="tag tag-warn">payg</span>
          )}
          <span className={dotCls} aria-label={`state ${state}`} />
        </span>
      </div>
    </>
  );
}

function Stats({ data, showCost = true }: { data: ProviderSummary; showCost?: boolean }) {
  return (
    <div className="card-stats">
      <div className="stat">
        <span className="stat-label">Today</span>
        <span className="stat-value">{formatTokens(data.today_tokens)} tok</span>
        {showCost && <span className="stat-sub">${data.today_cost.toFixed(2)}</span>}
      </div>
      <div className="stat">
        <span className="stat-label">Month</span>
        <span className="stat-value">{formatTokens(data.month_tokens)} tok</span>
        {showCost && <span className="stat-sub">${data.month_cost.toFixed(2)}</span>}
      </div>
      <div className="stat">
        <span className="stat-label">Burn/hr</span>
        <span className="stat-value">{formatTokens(data.burn_rate_tokens_per_hour)}</span>
        {showCost && <span className="stat-sub">${data.burn_rate_cost_per_hour.toFixed(2)}</span>}
      </div>
    </div>
  );
}

function Quotas({ quota }: { quota?: QuotaWindowsResponse }) {
  const windows = quota?.windows || [];
  if (windows.length === 0) return null;
  return (
    <div className="quota-stack">
      {windows.map((w) => (
        <QuotaBar key={w.id} window={w} />
      ))}
    </div>
  );
}

/** Subscription: the usage window is the tank. Hero = % remaining. */
function SubscriptionCard({ data, quota, unit }: ProviderCardProps) {
  const pct = Math.round(data.fuel_level * 100);
  const state = fuelState(data.fuel_level);
  return (
    <section className="panel" aria-label={`${data.display_name} status`}>
      <Band data={data} state={state} unit={unit} />
      <div className="panel-body">
        <div className="hero-num card-hero">
          {pct}
          <span className="hero-unit">% tank</span>
        </div>
        <div className="rail-row">
          <SegmentRail pct={pct} state={state} ariaLabel={`Tank ${pct}%`} />
          <div className="rail-foot">
            <span>{formatTokens(data.today_tokens)} tok today</span>
            <span>window</span>
          </div>
        </div>
        <Quotas quota={quota} />
        <Stats data={data} />
      </div>
    </section>
  );
}

/** API: pay-per-token. Hero = spend today. Rail = balance. */
function ApiCard({ data, quota, unit }: ProviderCardProps) {
  const pct = Math.round(data.fuel_level * 100);
  const state = fuelState(data.fuel_level);
  return (
    <section className="panel" aria-label={`${data.display_name} status`}>
      <Band data={data} state={state} unit={unit} />
      <div className="panel-body">
        <div className="hero-num card-hero">
          ${data.today_cost.toFixed(2)}
          <span className="hero-unit">today</span>
        </div>
        <div className="rail-row">
          <SegmentRail pct={pct} state={state} ariaLabel={`Balance ${pct}%`} />
          <div className="rail-foot">
            <span>${data.month_cost.toFixed(2)} month</span>
            <span>{pct}% balance</span>
          </div>
        </div>
        <Quotas quota={quota} />
        <Stats data={data} showCost={false} />
      </div>
    </section>
  );
}

/** Local: no meter, no bill. Hero = tokens today. */
function LocalCard({ data, unit }: ProviderCardProps) {
  return (
    <section className="panel" aria-label={`${data.display_name} status`}>
      <Band data={data} state="normal" unit={unit} />
      <div className="panel-body">
        <div className="hero-num card-hero">
          {formatTokens(data.today_tokens)}
          <span className="hero-unit">tok today</span>
        </div>
        <div className="rail-row">
          <SegmentRail pct={100} ariaLabel="Unmetered" />
          <div className="rail-foot">
            <span>unmetered · $0.00</span>
            <span>local</span>
          </div>
        </div>
        <Stats data={data} showCost={false} />
      </div>
    </section>
  );
}

export function ProviderCard({ data, quota, unit }: ProviderCardProps) {
  switch (data.provider_type) {
    case "subscription":
      return <SubscriptionCard data={data} quota={quota} unit={unit} />;
    case "local":
      return <LocalCard data={data} unit={unit} />;
    default:
      return <ApiCard data={data} quota={quota} unit={unit} />;
  }
}
