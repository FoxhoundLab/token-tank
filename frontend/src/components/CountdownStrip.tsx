/**
 * CountdownStrip — subscription-card reset window as a segmented strip.
 * One block per hour of the window ('5h' → 5 blocks; weekly windows
 * segment by day). Elapsed blocks light up; the countdown to reset runs
 * as a mono T-minus readout on the right. Renders nothing without a
 * real reset_at from the quota API — no fabricated windows.
 */

import { useEffect, useState } from "react";
import { SegmentRail } from "./SegmentRail";
import { parseUTC } from "../utils/time";
import type { QuotaWindow } from "../types";

interface CountdownStripProps {
  window: QuotaWindow;
}

/** Window duration in hours + how to segment it. */
function windowShape(windowType: string): { hours: number; segments: number; label: string } | null {
  const m = windowType.match(/^(\d+)h$/);
  if (m) {
    const h = parseInt(m[1], 10);
    return { hours: h, segments: h, label: `${h}H WINDOW` };
  }
  if (windowType === "weekly") return { hours: 168, segments: 7, label: "7D WINDOW" };
  if (windowType === "monthly") return { hours: 720, segments: 30, label: "30D WINDOW" };
  return null;
}

function formatTMinus(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  if (h >= 48) return `T-${Math.floor(h / 24)}D ${h % 24}H`;
  return `T-${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function CountdownStrip({ window: w }: CountdownStripProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const shape = windowShape(w.window_type);
  if (!shape || !w.reset_at) return null;

  const resetMs = parseUTC(w.reset_at);
  const remainingMs = Math.max(0, resetMs - now);
  const totalMs = shape.hours * 3600 * 1000;
  const elapsedPct = Math.max(0, Math.min(100, ((totalMs - remainingMs) / totalMs) * 100));

  return (
    <div className="countdown-strip">
      <div className="rail-head">
        <span className="t-micro">{shape.label}</span>
        <span className="countdown-value">{formatTMinus(remainingMs)}</span>
      </div>
      <SegmentRail
        pct={elapsedPct}
        segments={shape.segments}
        ariaLabel={`Reset window ${Math.round(elapsedPct)}% elapsed`}
      />
      <div className="rail-foot">
        <span>elapsed</span>
        <span>reset</span>
      </div>
    </div>
  );
}
