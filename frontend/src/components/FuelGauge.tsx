/**
 * FuelGauge — brutalist SVG instrument gauge.
 * Sharp triangle needle, 11 major ticks + 5 minors per gap, no soft edges.
 * Color thresholds (by usage): ok 0-50%, warn 50-80%, danger 80-100%.
 */

interface FuelGaugeProps {
  level: number; // 0.0 (empty) to 1.0 (full = fuel remaining)
  label?: string;
  /** Local providers have no meter — pin the needle full and show ∞. */
  infinite?: boolean;
}

const CX = 100;
const CY = 108;
const R = 78;

/** Point on the arc: pct 0 = far left (empty), pct 1 = far right (full). */
function arcPoint(pct: number, radius: number): [number, number] {
  const rad = ((180 + pct * 180) * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
}

export function FuelGauge({ level, label, infinite = false }: FuelGaugeProps) {
  const pct = infinite ? 1 : Math.max(0, Math.min(1, level));

  const color = infinite
    ? "var(--tank-accent)"
    : pct >= 0.5
      ? "var(--tank-ok)"
      : pct >= 0.2
        ? "var(--tank-warn)"
        : "var(--tank-danger)";

  // Needle: triangle drawn pointing straight up from the hub, rotated by CSS.
  // -90deg = empty (left), +90deg = full (right).
  const needleDeg = -90 + pct * 180;

  // 11 major ticks (0..100 by 10), 5 minor ticks between each major.
  const ticks: { pct: number; major: boolean }[] = [];
  for (let i = 0; i <= 60; i++) {
    ticks.push({ pct: i / 60, major: i % 6 === 0 });
  }

  const [arcStartX, arcStartY] = arcPoint(0, R);
  const [arcEndX, arcEndY] = arcPoint(1, R);

  return (
    <div className="fuel-gauge">
      <svg viewBox="0 0 200 132" className="gauge-svg" role="img" aria-label={label ?? `Fuel ${Math.round(pct * 100)}%`}>
        {/* Arc track */}
        <path
          d={`M ${arcStartX} ${arcStartY} A ${R} ${R} 0 0 1 ${arcEndX} ${arcEndY}`}
          fill="none"
          stroke="rgba(var(--tank-fg-rgb), 0.14)"
          strokeWidth="2"
        />
        {/* Tick marks */}
        {ticks.map(({ pct: t, major }) => {
          const [x1, y1] = arcPoint(t, major ? R - 12 : R - 6);
          const [x2, y2] = arcPoint(t, R);
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={major ? "rgba(var(--tank-fg-rgb), 0.55)" : "rgba(var(--tank-fg-rgb), 0.22)"}
              strokeWidth={major ? 2 : 1}
            />
          );
        })}
        {/* Needle — sharp triangle, CSS-rotated 320ms ease-out */}
        <g
          className="gauge-needle"
          style={{ transform: `rotate(${needleDeg}deg)` }}
        >
          <polygon points="96.5,108 103.5,108 100,40" fill={color} />
        </g>
        {/* Hub — square, not a circle. This is an instrument, not a widget. */}
        <rect x={CX - 5} y={CY - 5} width="10" height="10" fill={color} className="gauge-hub" />
        {/* E / F markings */}
        <text x={CX - R + 2} y={CY + 16} className="gauge-ef">E</text>
        <text x={CX + R - 10} y={CY + 16} className="gauge-ef">F</text>
      </svg>
      {label && <div className="gauge-readout">{label}</div>}
    </div>
  );
}
