/**
 * QuotaBar — one quota window as a segmented rail with countdown.
 * Escalation: cyan → warm pulse at ≥90% → red at 100%.
 */

import { useEffect, useState } from "react";
import { SegmentRail } from "./SegmentRail";
import type { QuotaWindow } from "../types";

interface QuotaBarProps {
  window: QuotaWindow;
}

function formatResetIn(resetAt: string | null): string {
  if (!resetAt) return "";
  const now = Date.now();
  const reset = new Date(resetAt).getTime();
  const diffMs = reset - now;
  if (diffMs <= 0) return "resetting";

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    return `reset ${days}d ${hours % 24}h`;
  }
  return `reset ${hours}h ${minutes}m`;
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
  const state = pct >= 100 ? "danger" : pct >= 90 ? "low" : "normal";

  return (
    <div className="rail-row">
      <div className="rail-head">
        <span className="t-micro">{w.label || w.window_type}</span>
        <span className="rail-pct">{pct.toFixed(0)}%</span>
      </div>
      <SegmentRail pct={pct} state={state} ariaLabel={`Quota ${pct.toFixed(0)}%`} />
      <div className="rail-foot">
        <span>{formatValue(w.used, w.limit, w.unit)}</span>
        <span>{resetIn}</span>
      </div>
    </div>
  );
}
