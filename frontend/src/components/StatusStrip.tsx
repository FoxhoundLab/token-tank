/**
 * StatusStrip — the cockpit's secondary instruments line, under the
 * topbar. Local clock, operator, session uptime, poll cadence, link
 * state, and JS heap (when the browser exposes it). All values are
 * client-observed — nothing invented.
 */

import { useEffect, useRef, useState } from "react";

interface StatusStripProps {
  link: "ok" | "error" | "idle";
  pollMs: number;
}

function formatUptime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

/** Chrome-only, non-standard — render MEM only when it exists. */
function heapMB(): number | null {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return mem ? Math.round(mem.usedJSHeapSize / 1_048_576) : null;
}

export function StatusStrip({ link, pollMs }: StatusStripProps) {
  const start = useRef(Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const mem = heapMB();
  const cells = [
    `LOCAL ${new Date(now).toTimeString().slice(0, 8)}`,
    "OPERATOR DEFAULT",
    `UPTIME ${formatUptime(now - start.current)}`,
    `POLL ${pollMs / 1000}S`,
    `LINK ${link === "ok" ? "OK" : link === "error" ? "DOWN" : "INIT"}`,
    ...(mem !== null ? [`MEM ${mem}MB`] : []),
  ];

  return (
    <div className="status-strip" role="status" aria-label="System readouts">
      {cells.map((c) => (
        <span key={c.split(" ")[0]} className="status-strip-cell">
          {c}
        </span>
      ))}
    </div>
  );
}
