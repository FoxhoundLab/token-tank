/**
 * SegmentRail — the signature cockpit element.
 * A segmented block bar rendered with two repeating-linear-gradient layers
 * (one DOM node per layer, not 60 divs). Trailing glow on the fill edge.
 *
 * `pct` is the filled fraction 0–100. `state` escalates the color:
 *   normal → cyan, low (≥90% used) → warm pulse, danger → red pulse.
 */

interface SegmentRailProps {
  pct: number; // 0–100 fill
  state?: "normal" | "low" | "danger";
  ariaLabel?: string;
}

export function SegmentRail({ pct, state = "normal", ariaLabel }: SegmentRailProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  const cls =
    state === "danger" ? "rail rail-danger" : state === "low" ? "rail rail-low" : "rail";
  return (
    <div
      className={cls}
      role="img"
      aria-label={ariaLabel ?? `${Math.round(clamped)}%`}
    >
      <div className="rail-fill" style={{ width: `${clamped}%` }} />
    </div>
  );
}
