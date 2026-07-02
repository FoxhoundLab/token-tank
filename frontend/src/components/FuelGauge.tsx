/**
 * FuelGauge — brutalist SVG instrument gauge.
 * Sharp triangle needle (140ms snap via CSS), 11 major ticks + minors,
 * gradient glow under the arc. State color rides on currentColor.
 * Thresholds (fuel remaining): ok ≥50%, warn ≥20%, danger below.
 */

import { useId } from "react";

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
  const gradId = useId();
  const pct = infinite ? 1 : Math.max(0, Math.min(1, level));

  const color = infinite
    ? "var(--tank-accent)"
    : pct >= 0.5
      ? "var(--tank-ok)"
      : pct >= 0.2
        ? "var(--tank-warn)"
        : "var(--tank-danger)";

  // Needle: drawn pointing straight up from the hub, rotated by CSS.
  // -90deg = empty (left), +90deg = full (right).
  const needleDeg = -90 + pct * 180;

  // 11 major ticks (0..100 by 10), 5 minor ticks between each major.
  const ticks: { pct: number; major: boolean }[] = [];
  for (let i = 0; i <= 60; i++) {
    ticks.push({ pct: i / 60, major: i % 6 === 0 });
  }

  const [ax0, ay0] = arcPoint(0, R);
  const [ax1, ay1] = arcPoint(1, R);

  return (
    <div className="fuel-gauge" style={{ color }}>
      <svg viewBox="0 0 200 132" className="gauge-svg" role="img" aria-label={label ?? `Fuel ${Math.round(pct * 100)}%`}>
        <defs>
          {/* Glow under the arc: state color fading to nothing */}
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity="0.18" />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Gradient fill under the arc region */}
        <path
          d={`M ${ax0} ${ay0} A ${R} ${R} 0 0 1 ${ax1} ${ay1} Z`}
          fill={`url(#${gradId})`}
        />
        {/* Arc track */}
        <path
          d={`M ${ax0} ${ay0} A ${R} ${R} 0 0 1 ${ax1} ${ay1}`}
          fill="none"
          stroke="rgba(var(--tank-fg-rgb), 0.12)"
          strokeWidth="2"
        />
        {/* Tick marks */}
        {ticks.map(({ pct: t, major }) => {
          const [x1, y1] = arcPoint(t, major ? R - 11 : R - 5);
          const [x2, y2] = arcPoint(t, R);
          return (
            <line
              key={t}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke={major ? "rgba(var(--tank-fg-rgb), 0.5)" : "rgba(var(--tank-fg-rgb), 0.18)"}
              strokeWidth={major ? 1.8 : 1}
            />
          );
        })}
        {/* Needle — sharp blade, 140ms CSS snap */}
        <g
          className="gauge-needle"
          style={{ transform: `rotate(${needleDeg}deg)` }}
        >
          <polygon points="97.5,110 102.5,110 100,38" fill="currentColor" />
        </g>
        {/* Hub — square. This is an instrument, not a widget. */}
        <rect x={CX - 4.5} y={CY - 4.5} width="9" height="9" fill="currentColor" className="gauge-hub" />
        {/* E / F markings */}
        <text x={CX - R + 2} y={CY + 16} className="gauge-ef">E</text>
        <text x={CX + R - 10} y={CY + 16} className="gauge-ef">F</text>
      </svg>
      {label && <div className="gauge-readout">{label}</div>}
    </div>
  );
}
