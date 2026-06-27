/**
 * FuelGauge — SVG fuel gauge component.
 * Displays a gauge needle from Full (right) to Empty (left).
 */

interface FuelGaugeProps {
  level: number; // 0.0 (empty) to 1.0 (full)
  label?: string;
}

export function FuelGauge({ level, label }: FuelGaugeProps) {
  // Clamp level
  const pct = Math.max(0, Math.min(1, level));

  // Gauge arc: from -90deg (empty/left) to +90deg (full/right)
  const angle = -90 + pct * 180;

  // Determine color based on level
  const color = pct > 0.5 ? "#22c55e" : pct > 0.25 ? "#f59e0b" : "#ef4444";

  // Needle endpoint
  const needleX = 50 + 35 * Math.cos((angle * Math.PI) / 180);
  const needleY = 50 - 35 * Math.sin((angle * Math.PI) / 180);

  return (
    <div className="fuel-gauge">
      <svg viewBox="0 0 100 60" className="gauge-svg">
        {/* Arc background */}
        <path
          d="M 15 50 A 35 35 0 0 1 85 50"
          fill="none"
          stroke="#333"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {/* Arc fill */}
        <path
          className="gauge-arc-fill"
          d="M 15 50 A 35 35 0 0 1 85 50"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${pct * 110} 110`}
        />
        {/* Tick marks */}
        {[0, 0.25, 0.5, 0.75, 1].map((tick) => {
          const tickAngle = -90 + tick * 180;
          const x1 = 50 + 30 * Math.cos((tickAngle * Math.PI) / 180);
          const y1 = 50 - 30 * Math.sin((tickAngle * Math.PI) / 180);
          const x2 = 50 + 38 * Math.cos((tickAngle * Math.PI) / 180);
          const y2 = 50 - 38 * Math.sin((tickAngle * Math.PI) / 180);
          return (
            <line
              key={tick}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#666"
              strokeWidth="1.5"
            />
          );
        })}
        {/* Needle */}
        <line
          className="gauge-needle"
          x1="50"
          y1="50"
          x2={needleX}
          y2={needleY}
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Center hub */}
        <circle cx="50" cy="50" r="4" fill="#888" />
        {/* E and F labels */}
        <text x="12" y="58" fontSize="8" fill="#666">E</text>
        <text x="82" y="58" fontSize="8" fill="#666">F</text>
      </svg>
      {label && <div className="gauge-label">{label}</div>}
    </div>
  );
}
