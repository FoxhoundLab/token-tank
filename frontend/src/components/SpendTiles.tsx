/**
 * SpendTiles — API-card 7-day spend grid. Seven cells, one per day,
 * today highlighted. Each cell: weekday letter, spend value, and a
 * fill bar scaled against the week's max. Data comes straight from the
 * /providers/{id}/history endpoint — missing days render as zero.
 */

import type { DailyTotal } from "../types";

interface SpendTilesProps {
  daily: DailyTotal[];
}

const DAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];

function lastSevenDaysUTC(): string[] {
  const days: string[] = [];
  const now = Date.now();
  for (let i = 6; i >= 0; i--) {
    days.push(new Date(now - i * 86_400_000).toISOString().slice(0, 10));
  }
  return days;
}

function formatSpend(v: number): string {
  if (v >= 100) return `$${Math.round(v)}`;
  if (v >= 10) return `$${v.toFixed(1)}`;
  return `$${v.toFixed(2)}`;
}

export function SpendTiles({ daily }: SpendTilesProps) {
  const byDate = new Map(daily.map((d) => [d.date, d]));
  const days = lastSevenDaysUTC();
  const today = days[days.length - 1];
  const max = Math.max(...days.map((d) => byDate.get(d)?.total_cost ?? 0), 0.000001);

  return (
    <div className="spend-tiles" role="img" aria-label="Last 7 days of spend">
      {days.map((date) => {
        const cost = byDate.get(date)?.total_cost ?? 0;
        const fill = Math.round((cost / max) * 100);
        return (
          <span key={date} className={`spend-tile ${date === today ? "today" : ""}`}>
            <span className="spend-tile-day">
              {DAY_LETTER[new Date(`${date}T00:00:00Z`).getUTCDay()]}
            </span>
            <span className="spend-tile-bar">
              <span className="spend-tile-fill" style={{ height: `${fill}%` }} />
            </span>
            <span className="spend-tile-value">{formatSpend(cost)}</span>
          </span>
        );
      })}
    </div>
  );
}
