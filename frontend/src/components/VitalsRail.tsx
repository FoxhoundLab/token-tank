/**
 * VitalsRail — the left instrument column of the Mission stage.
 * Usage meters follow the Claude plan-limits pattern: plan name, a
 * "resets …" line, then a thin track with "N% used" on the right.
 * Live data joins from quota windows (7d history as fallback); rows
 * without telemetry stay honest with an em-dash. Then the top
 * directives and the document trail. Renders even with the API down.
 */

import { documents, persona, subscriptions } from "../data/mission";
import type { SubscriptionRow } from "../data/mission";
import { formatTokens } from "../utils/format";
import { parseUTC } from "../utils/time";
import type { ProviderHistory, QuotaWindow, QuotaWindowsResponse } from "../types";

interface VitalsRailProps {
  quotas: Map<string, QuotaWindowsResponse>;
  histories: Map<string, ProviderHistory>;
}

/** Live data can arrive from more than one source for the same window
    (a manual placeholder plus a real extension scrape, for instance).
    Collapse to one row per window_type, preferring the most authoritative
    source: extension scrape > provider API > hand-entered manual. */
const SOURCE_RANK: Record<QuotaWindow["source"], number> = {
  extension: 0,
  api: 1,
  manual: 2,
};

function bestPerWindowType(windows: QuotaWindow[]): QuotaWindow[] {
  const best = new Map<string, QuotaWindow>();
  for (const w of windows) {
    const existing = best.get(w.window_type);
    if (!existing || SOURCE_RANK[w.source] < SOURCE_RANK[existing.source]) {
      best.set(w.window_type, w);
    }
  }
  return Array.from(best.values());
}

/** Up to two meters per plan: the 5h session window plus the plan's
    preferred long window — the first non-5h match in windowPreference
    (weekly for most; Claude prefers the Fable 5 model cap). Labels do
    the disambiguation, like the Claude plan-limits panel. */
function pickWindows(
  sub: SubscriptionRow,
  quotas: Map<string, QuotaWindowsResponse>,
): { key: string; win: QuotaWindow }[] {
  if (!sub.providerId) return [];
  const q = quotas.get(sub.providerId);
  if (!q) return [];
  const windows = bestPerWindowType(q.windows);
  const rows: { key: string; win: QuotaWindow }[] = [];
  const session = windows.find((w) => w.window_type === "5h");
  if (session) rows.push({ key: "session", win: session });
  const prefs = [...sub.windowPreference.filter((p) => p !== "5h"), "weekly"];
  for (const pref of prefs) {
    const win = windows.find((w) => w.window_type === pref);
    if (win) {
      rows.push({ key: meterLabel(win), win });
      break;
    }
  }
  if (rows.length === 0 && windows[0]) {
    rows.push({ key: meterLabel(windows[0]), win: windows[0] });
  }
  return rows;
}

/** "fable 5 · weekly" for model caps, else the plain window name. */
function meterLabel(win: QuotaWindow): string {
  if (win.window_type.startsWith("model:")) {
    const model = (win.label ?? win.window_type).replace(/^model:\s*/i, "");
    return `${model} · weekly`;
  }
  return windowLabel(win);
}

/** "resets in 4 hr 48 min" inside a day, "resets Sat 9:00 PM" beyond. */
function formatReset(resetAt: string | null): string | null {
  if (!resetAt) return null;
  const ms = parseUTC(resetAt) - Date.now();
  if (ms <= 0) return "window stale — reset passed";
  const totalMin = Math.floor(ms / 60000);
  if (totalMin < 24 * 60) {
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return h > 0 ? `resets in ${h} hr ${m} min` : `resets in ${m} min`;
  }
  const d = new Date(parseUTC(resetAt));
  const day = d.toLocaleDateString("en-US", { weekday: "short" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `resets ${day} ${time}`;
}

function windowLabel(win: QuotaWindow): string {
  if (win.window_type === "weekly") return "weekly";
  if (win.window_type === "monthly") return "monthly";
  if (win.window_type === "5h") return "session";
  return win.label ?? win.window_type;
}

function Meter({
  name,
  label,
  reset,
  pct,
  pctText,
}: {
  name: string;
  label: string;
  reset: string;
  pct: number | null;
  pctText: string;
}) {
  return (
    <div className="vital-meter-block">
      <div className="vital-meter-head">
        <span className="vital-meter-label">{label}</span>
        <span className="vital-reset">{reset}</span>
      </div>
      <div className="vital-meter">
        <div className="vital-track">
          {pct !== null && (
            <div
              className="vital-fill"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${name} ${label} ${pctText}`}
            />
          )}
        </div>
        <span className="vital-pct">{pctText}</span>
      </div>
    </div>
  );
}

function Vital({
  sub,
  quotas,
  histories,
}: {
  sub: SubscriptionRow;
  quotas: Map<string, QuotaWindowsResponse>;
  histories: Map<string, ProviderHistory>;
}) {
  const rows = pickWindows(sub, quotas);
  const history = sub.providerId ? histories.get(sub.providerId) : undefined;
  const week7 = (history?.daily_totals ?? []).reduce((s, d) => s + d.total_tokens, 0);

  return (
    <div className="vital">
      <div className="vital-name">{sub.name}</div>
      {rows.length > 0 ? (
        rows.map(({ key, win }) => {
          const pct = Math.max(0, Math.min(100, win.percentage));
          return (
            <Meter
              key={key}
              name={sub.name}
              label={key}
              reset={formatReset(win.reset_at) ?? windowLabel(win)}
              pct={pct}
              pctText={`${pct.toFixed(0)}% used`}
            />
          );
        })
      ) : week7 > 0 ? (
        <Meter
          name={sub.name}
          label="7-day burn"
          reset="no quota set"
          pct={null}
          pctText={`${formatTokens(week7)} / 7d`}
        />
      ) : (
        <Meter name={sub.name} label="" reset={sub.planNote} pct={null} pctText="—" />
      )}
    </div>
  );
}

export function VitalsRail({ quotas, histories }: VitalsRailProps) {
  return (
    <div className="vitals-rail">
      <div className="rail-section-head t-label">
        Plan usage <span className="rail-section-sub">subscription_link</span>
      </div>
      {subscriptions.map((sub) => (
        <Vital key={sub.id} sub={sub} quotas={quotas} histories={histories} />
      ))}

      <div className="rail-section-head t-label">
        Directives <span className="rail-section-sub">top.3</span>
      </div>
      <div className="rail-directives">
        {persona.directives.slice(0, 3).map((d) => (
          <div key={d} className="rail-directive">
            <span className="rail-directive-box" aria-hidden="true">
              □
            </span>
            <span>{d}</span>
          </div>
        ))}
      </div>

      <div className="rail-section-head t-label">
        Documents <span className="rail-section-sub">inbox.trail</span>
      </div>
      <div className="rail-docs">
        {documents.map((doc) => (
          <div key={doc.path} className="rail-doc" title={doc.path}>
            <span>{doc.label}</span>
            <span className="rail-doc-note">{doc.note}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
