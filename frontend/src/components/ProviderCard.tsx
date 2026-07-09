/**
 * ProviderCard — one cockpit instrument per provider.
 * Three deliberately distinct card models, switched on provider_type:
 *   subscription — fuel rail + hour-segmented reset countdown strip
 *   api          — balance rail + 7-day spend tiles
 *   local        — unmetered plate + throughput readouts
 * Every readout derives from live API data (dashboard, quota, history).
 * Nothing is fabricated: missing data renders as "—", never as a guess.
 */

import { CountdownStrip } from "./CountdownStrip";
import { QuotaBar } from "./QuotaBar";
import { SegmentRail } from "./SegmentRail";
import { SpendTiles } from "./SpendTiles";
import { StatusGlyph } from "./StatusGlyph";
import type {
  ProviderHistory,
  ProviderSummary,
  QuotaWindow,
  QuotaWindowsResponse,
} from "../types";

export type PulseState = "live" | "standby";

interface ProviderCardProps {
  data: ProviderSummary;
  quota?: QuotaWindowsResponse;
  history?: ProviderHistory;
  /** Per-provider traffic pulse observed by the dashboard poll. */
  pulse?: PulseState;
  /** Client timestamp of the last successful dashboard poll. */
  updatedAt?: number;
  /** Panel position on the board — drives the "PROVIDER · 03" ID tag. */
  unit?: number;
}

/** Hardware serial tag: TT-ANT-SUB, TT-OLL-LOC, … */
function serial(data: ProviderSummary): string {
  return `TT-${data.provider.slice(0, 3)}-${data.provider_type.slice(0, 3)}`.toUpperCase();
}

/** Split a token count into value + magnitude suffix for hero readouts. */
function splitTokens(n: number): { value: string; suffix: string } {
  if (n >= 1_000_000_000) return { value: (n / 1_000_000_000).toFixed(1), suffix: "B" };
  if (n >= 1_000_000) return { value: (n / 1_000_000).toFixed(1), suffix: "M" };
  if (n >= 1_000) return { value: (n / 1_000).toFixed(1), suffix: "K" };
  return { value: Math.round(n).toString(), suffix: "" };
}

function formatTokens(n: number): string {
  const { value, suffix } = splitTokens(n);
  return `${value}${suffix}`;
}

/** Escalation from fuel remaining: accent until 15%, warm, then red. */
function fuelState(fuel: number): "normal" | "low" | "danger" {
  if (fuel <= 0.05) return "danger";
  if (fuel <= 0.15) return "low";
  return "normal";
}

/** Card status flag — traffic pulse, escalated to CRITICAL on reserve fuel. */
function statusFlag(
  data: ProviderSummary,
  pulse: PulseState,
): { kind: "live" | "standby" | "critical"; label: string } {
  if (data.provider_type !== "local" && data.fuel_level <= 0.05) {
    return { kind: "critical", label: "reserve" };
  }
  return pulse === "live" ? { kind: "live", label: "live" } : { kind: "standby", label: "standby" };
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ── Shared building blocks ─────────────────────────────────────── */

function Band({
  data,
  pulse,
  unit,
}: {
  data: ProviderSummary;
  pulse: PulseState;
  unit?: number;
}) {
  const flag = statusFlag(data, pulse);
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
          <StatusGlyph kind={flag.kind} />
        </span>
      </div>
    </>
  );
}

function Hero({
  value,
  suffix,
  prefix,
  label,
  secondary = false,
}: {
  value: string;
  suffix?: string;
  prefix?: string;
  label: string;
  secondary?: boolean;
}) {
  return (
    <div className={`hero-block ${secondary ? "secondary" : ""}`}>
      <div className="hero-num card-hero">
        {prefix && <span className="hero-suffix">{prefix}</span>}
        {value}
        {suffix && <span className="hero-suffix">{suffix}</span>}
      </div>
      <span className="hero-label">{label}</span>
    </div>
  );
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <div className="readout">
      <span className="readout-label">{label}</span>
      <span className="readout-value">{value}</span>
    </div>
  );
}

/** Top-2 model share over the last 7 days — straight from history. */
function ModelStrip({ history }: { history?: ProviderHistory }) {
  const models = history?.model_breakdown.slice(0, 2) ?? [];
  if (models.length === 0) return null;
  return (
    <div className="model-strip">
      <span className="t-micro">Model mix · 7d</span>
      {models.map((m) => (
        <div key={m.model} className="model-row">
          <span className="model-name">{m.model}</span>
          <span className="model-share">{m.percentage.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

function CardFoot({
  data,
  pulse,
  updatedAt,
}: {
  data: ProviderSummary;
  pulse: PulseState;
  updatedAt?: number;
}) {
  const flag = statusFlag(data, pulse);
  return (
    <div className="card-foot">
      <StatusGlyph kind={flag.kind} label={flag.label} />
      <span className="card-foot-time">
        {updatedAt ? `POLL ${new Date(updatedAt).toTimeString().slice(0, 8)}` : "POLL —"}
      </span>
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

/* ── Derived readouts (real fields only) ────────────────────────── */

interface Derived {
  requests: number | null;
  avgTokPerReq: number | null;
  burnPerMin: number;
}

function derive(data: ProviderSummary, history?: ProviderHistory): Derived {
  const today = history?.daily_totals.find((d) => d.date === todayUTC());
  const requests = today ? today.request_count : null;
  return {
    requests,
    avgTokPerReq: requests && requests > 0 ? data.today_tokens / requests : null,
    burnPerMin: data.burn_rate_tokens_per_hour / 60,
  };
}

/** Time-to-empty for the tightest token quota window at current burn. */
function exhaustion(data: ProviderSummary, quota?: QuotaWindowsResponse): string {
  const burn = data.burn_rate_tokens_per_hour;
  if (burn <= 0) return "—";
  const windows = (quota?.windows || []).filter(
    (w: QuotaWindow) => w.unit === "tokens" && w.limit > w.used,
  );
  if (windows.length === 0) return "—";
  const hours = Math.min(...windows.map((w) => (w.limit - w.used) / burn));
  if (hours >= 48) return `T-${Math.round(hours / 24)}D`;
  return `T-${hours.toFixed(1)}H`;
}

const fmtOrDash = (v: number | null, fmt: (n: number) => string): string =>
  v === null ? "—" : fmt(v);

/* ── Card models ────────────────────────────────────────────────── */

/** Subscription: the usage window is the tank. Fuel rail + reset strip. */
function SubscriptionCard({ data, quota, history, pulse = "standby", updatedAt, unit }: ProviderCardProps) {
  const pct = Math.round(data.fuel_level * 100);
  const state = fuelState(data.fuel_level);
  const d = derive(data, history);
  const tok = splitTokens(data.today_tokens);
  const countdownWindow = (quota?.windows || []).find((w) => w.reset_at);
  return (
    <section className="panel" aria-label={`${data.display_name} status`}>
      <Band data={data} pulse={pulse} unit={unit} />
      <div className="panel-body">
        <div className="hero-row">
          <Hero value={tok.value} suffix={tok.suffix} label="Tokens today" />
          <Hero value={data.today_cost.toFixed(2)} prefix="$" label="Cost today" secondary />
        </div>
        <div className="rail-row">
          <div className="rail-head">
            <span className="t-micro">Fuel · window</span>
            <span className="rail-pct">{pct}%</span>
          </div>
          <SegmentRail pct={pct} state={state} ariaLabel={`Tank ${pct}%`} />
          <div className="rail-foot">
            <span>{formatTokens(data.today_tokens)} tok burned</span>
            <span>exhaust {exhaustion(data, quota)}</span>
          </div>
        </div>
        {countdownWindow && <CountdownStrip window={countdownWindow} />}
        <div className="readout-grid">
          <Readout label="Requests" value={fmtOrDash(d.requests, (n) => `${n}`)} />
          <Readout label="Avg / req" value={fmtOrDash(d.avgTokPerReq, formatTokens)} />
          <Readout label="Burn / min" value={formatTokens(d.burnPerMin)} />
          <Readout label="Burn / hr" value={formatTokens(data.burn_rate_tokens_per_hour)} />
          <Readout label="Month tok" value={formatTokens(data.month_tokens)} />
          <Readout label="Month cost" value={`$${data.month_cost.toFixed(2)}`} />
        </div>
        <Quotas quota={quota} />
        <ModelStrip history={history} />
        <CardFoot data={data} pulse={pulse} updatedAt={updatedAt} />
      </div>
    </section>
  );
}

/** API: pay-per-token. Balance rail + 7-day spend tiles. */
function ApiCard({ data, quota, history, pulse = "standby", updatedAt, unit }: ProviderCardProps) {
  const pct = Math.round(data.fuel_level * 100);
  const state = fuelState(data.fuel_level);
  const d = derive(data, history);
  const tok = splitTokens(data.today_tokens);
  const weekCost = history?.daily_totals.reduce((s, day) => s + day.total_cost, 0) ?? null;
  return (
    <section className="panel" aria-label={`${data.display_name} status`}>
      <Band data={data} pulse={pulse} unit={unit} />
      <div className="panel-body">
        <div className="hero-row">
          <Hero value={data.today_cost.toFixed(2)} prefix="$" label="Cost today" />
          <Hero value={tok.value} suffix={tok.suffix} label="Tokens today" secondary />
        </div>
        <div className="rail-row">
          <div className="rail-head">
            <span className="t-micro">Balance</span>
            <span className="rail-pct">{pct}%</span>
          </div>
          <SegmentRail pct={pct} state={state} ariaLabel={`Balance ${pct}%`} />
          <div className="rail-foot">
            <span>${data.month_cost.toFixed(2)} month</span>
            <span>{pct}% remaining</span>
          </div>
        </div>
        {history && <SpendTiles daily={history.daily_totals} />}
        <div className="readout-grid">
          <Readout label="Requests" value={fmtOrDash(d.requests, (n) => `${n}`)} />
          <Readout label="Avg / req" value={fmtOrDash(d.avgTokPerReq, formatTokens)} />
          <Readout label="Burn / min" value={formatTokens(d.burnPerMin)} />
          <Readout label="Avg $ / day" value={fmtOrDash(weekCost, (c) => `$${(c / 7).toFixed(2)}`)} />
          <Readout label="Month tok" value={formatTokens(data.month_tokens)} />
          <Readout label="Month cost" value={`$${data.month_cost.toFixed(2)}`} />
        </div>
        <Quotas quota={quota} />
        <ModelStrip history={history} />
        <CardFoot data={data} pulse={pulse} updatedAt={updatedAt} />
      </div>
    </section>
  );
}

/** Local: no meter, no bill. Unmetered plate + throughput. */
function LocalCard({ data, history, pulse = "standby", updatedAt, unit }: ProviderCardProps) {
  const d = derive(data, history);
  const tok = splitTokens(data.today_tokens);
  return (
    <section className="panel" aria-label={`${data.display_name} status`}>
      <Band data={data} pulse={pulse} unit={unit} />
      <div className="panel-body">
        <div className="hero-row">
          <Hero value={tok.value} suffix={tok.suffix} label="Tokens today" />
          <Hero value={fmtOrDash(d.requests, (n) => `${n}`)} label="Requests" secondary />
        </div>
        <div className="rail-row">
          <div className="rail-head">
            <span className="t-micro">Throughput</span>
            <span className="rail-pct">∞</span>
          </div>
          <SegmentRail pct={100} ariaLabel="Unmetered" />
          <div className="rail-foot">
            <span>unmetered · $0.00</span>
            <span>local</span>
          </div>
        </div>
        <div className="readout-grid readout-grid-2">
          <Readout label="Avg / req" value={fmtOrDash(d.avgTokPerReq, formatTokens)} />
          <Readout label="Burn / hr" value={formatTokens(data.burn_rate_tokens_per_hour)} />
          <Readout label="Month tok" value={formatTokens(data.month_tokens)} />
          <Readout label="Req · 7d" value={fmtOrDash(
            history ? history.daily_totals.reduce((s, day) => s + day.request_count, 0) : null,
            (n) => `${n}`,
          )} />
        </div>
        <ModelStrip history={history} />
        <CardFoot data={data} pulse={pulse} updatedAt={updatedAt} />
      </div>
    </section>
  );
}

export function ProviderCard(props: ProviderCardProps) {
  switch (props.data.provider_type) {
    case "subscription":
      return <SubscriptionCard {...props} />;
    case "local":
      return <LocalCard {...props} />;
    default:
      return <ApiCard {...props} />;
  }
}
