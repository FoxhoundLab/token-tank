/**
 * QuotaBar — shows a single quota window with countdown timer.
 * 5h: shows "Resets in 3h 42m"
 * weekly: shows "Resets in 4d 12h"
 * model-specific: shows model name + percentage
 */

import { useEffect, useState, type CSSProperties } from "react";
import type { QuotaWindow } from "../types";

interface QuotaBarProps {
  window: QuotaWindow;
}

function formatResetIn(resetAt: string | null): string {
  if (!resetAt) return "";
  const now = Date.now();
  const reset = new Date(resetAt).getTime();
  const diffMs = reset - now;
  if (diffMs <= 0) return "Resetting…";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    return `Resets in ${days}d ${remHours}h`;
  }
  return `Resets in ${hours}h ${minutes}m`;
}

function formatValue(used: number, limit: number, unit: string): string {
  if (unit === "tokens") {
    const fmt = (n: number) => {
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
      return Math.round(n).toString();
    };
    return `${fmt(used)} / ${fmt(limit)} tok`;
  }
  if (unit === "requests") return `${used} / ${limit} req`;
  if (unit === "usd") return `$${used.toFixed(2)} / $${limit.toFixed(2)}`;
  return `${used} / ${limit} ${unit}`;
}

function stateFromPct(pct: number): "ok" | "warn" | "error" {
  if (pct >= 80) return "error";
  if (pct >= 50) return "warn";
  return "ok";
}

export function QuotaBar({ window: w }: QuotaBarProps) {
  const [resetIn, setResetIn] = useState(formatResetIn(w.reset_at));

  // Update countdown every 30s
  useEffect(() => {
    const id = setInterval(() => {
      setResetIn(formatResetIn(w.reset_at));
    }, 30000);
    return () => clearInterval(id);
  }, [w.reset_at]);

  const pct = Math.min(w.percentage, 100);
  const state = stateFromPct(pct);
  const segments = 20;
  const lit = Math.round((pct / 100) * segments);

  return (
    <div className={`quota-bar quota-${state}`}>
      <div className="quota-bar-header">
        <span className="quota-label">{w.label || w.window_type}</span>
        <span className="quota-pct">{pct.toFixed(0)}%</span>
      </div>
      <div className="quota-segments" role="img" aria-label={`Quota ${pct}%`}>
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className={`quota-segment ${i < lit ? "lit" : ""}`}
            style={{ "--seg-i": i } as CSSProperties}
          />
        ))}
      </div>
      <div className="quota-bar-footer">
        <span className="quota-value">{formatValue(w.used, w.limit, w.unit)}</span>
        <span className="quota-reset">{resetIn}</span>
      </div>
    </div>
  );
}
