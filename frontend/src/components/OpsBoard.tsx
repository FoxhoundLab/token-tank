/**
 * OpsBoard — operations panel below the stage. The hot project rides a
 * T-minus countdown that escalates inside 48h; the Day-90 campaign runs
 * as a 13-week segment rail; the frozen fleet reads as a manifest.
 */

import { useEffect, useState } from "react";
import { SegmentRail } from "./SegmentRail";
import { StatusGlyph } from "./StatusGlyph";
import type { StatusKind } from "./StatusGlyph";
import { campaign, projects } from "../data/mission";
import type { ProjectStatus } from "../data/mission";
import { formatTMinus } from "../utils/format";
import { parseUTC } from "../utils/time";

const STATUS_GLYPH: Record<ProjectStatus, StatusKind> = {
  hot: "critical",
  active: "live",
  frozen: "standby",
  icebox: "info",
};

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function OpsBoard() {
  const now = useNow(30000);
  const hot = projects.find((p) => p.status === "hot");
  const fleet = projects.filter((p) => p.status !== "hot");

  const start = parseUTC(`${campaign.windowStart}T00:00:00`);
  const end = parseUTC(`${campaign.windowEnd}T23:59:59`);
  const dayPct = Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  const daysLeft = Math.max(0, Math.ceil((end - now) / 86_400_000));

  const deadlineMs = hot?.deadline ? parseUTC(hot.deadline) - now : null;
  const critical = deadlineMs !== null && deadlineMs < 48 * 3600 * 1000;

  return (
    <section className="panel ops-panel" aria-label="Operations board">
      <div className="panel-id">
        <span>OPERATIONS · CONSTRAINT CAMPAIGN</span>
        <span className="panel-id-right">TT-MC-OPS</span>
      </div>
      <div className="panel-band">
        <span className="panel-title">Operations</span>
        <span className={critical ? "tag tag-warn" : "tag"}>
          {daysLeft}d left in window
        </span>
      </div>
      <div className="panel-body">
        {hot && (
          <div className="ops-hot">
            <div className="ops-hot-head">
              <StatusGlyph kind={critical ? "critical" : "warn"} label="primary" />
              <span className="ops-hot-name">{hot.name}</span>
              {deadlineMs !== null && (
                <span className={`ops-deadline ${critical ? "danger" : ""}`}>
                  {formatTMinus(deadlineMs)}
                </span>
              )}
            </div>
            <div className="ops-hot-sub t-micro">{hot.summary}</div>
          </div>
        )}

        <div className="rail-row">
          <div className="rail-head">
            <span className="t-micro">{campaign.label}</span>
            <span className="rail-pct">{dayPct.toFixed(0)}%</span>
          </div>
          <SegmentRail
            pct={dayPct}
            segments={13}
            ariaLabel={`Day-90 window ${dayPct.toFixed(0)}% elapsed`}
          />
          <div className="rail-foot">
            <span>{campaign.windowStart}</span>
            <span>{campaign.windowEnd}</span>
          </div>
        </div>

        <div className="ops-metrics">
          <div className="ops-metric">
            <span className="t-micro">break-even</span>
            <span className="t-value">{campaign.breakEvenSalesPerMonth} sales/mo</span>
          </div>
          {campaign.cadence.map((c) => (
            <div key={c.label} className="ops-metric">
              <span className="t-micro">{c.label}</span>
              <span className="t-value">
                {c.target}
                {c.unit}
              </span>
            </div>
          ))}
        </div>

        <div className="fleet">
          {fleet.map((p) => (
            <div key={p.id} className="fleet-row">
              <StatusGlyph kind={STATUS_GLYPH[p.status]} />
              <span className="fleet-name">{p.name}</span>
              <span className="fleet-sub t-micro">{p.summary}</span>
              <span className="tag">{p.status}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
