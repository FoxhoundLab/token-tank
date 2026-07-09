/**
 * SegmentRail — the signature cockpit element.
 * Discrete, countable segment blocks with visible 2px gaps. Unused
 * segments stay visible behind the lit ones (dim), so the bar reads as
 * a fuel rail, not a progress bar. The last lit segment carries the
 * energy-edge glow.
 *
 * `pct` is the filled fraction 0–100. `segments` is the block count —
 * match it to what the rail represents (10 for percent, hours for a
 * reset window). `state` escalates the color:
 *   normal → accent, low (≥90% used) → warm pulse, danger → red pulse.
 */

interface SegmentRailProps {
  pct: number; // 0–100 fill
  segments?: number; // block count, default 10
  state?: "normal" | "low" | "danger";
  ariaLabel?: string;
}

export function SegmentRail({
  pct,
  segments = 10,
  state = "normal",
  ariaLabel,
}: SegmentRailProps) {
  const clamped = Math.max(0, Math.min(100, pct));
  // Any non-zero fill lights at least one block.
  const lit =
    clamped === 0 ? 0 : Math.max(1, Math.round((clamped / 100) * segments));
  const cls =
    state === "danger" ? "rail rail-danger" : state === "low" ? "rail rail-low" : "rail";
  return (
    <div
      className={cls}
      role="img"
      aria-label={ariaLabel ?? `${Math.round(clamped)}%`}
    >
      {Array.from({ length: segments }, (_, i) => (
        <span
          key={i}
          className={`rail-seg ${i < lit ? "lit" : ""} ${i === lit - 1 ? "edge" : ""}`}
        />
      ))}
    </div>
  );
}
