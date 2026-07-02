/**
 * TokenTankLogo — fuel pump / tank hybrid brand glyph.
 * Pure SVG, monochrome via currentColor, sharp corners throughout.
 * Pump body with meter window + fuel bars, side hose, ground line.
 */

interface TokenTankLogoProps {
  size?: number;
  className?: string;
}

export function TokenTankLogo({ size = 20, className }: TokenTankLogoProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      fill="currentColor"
    >
      {/* Pump body with punched-out meter window */}
      <path
        fillRule="evenodd"
        d="M4 2h11v19H4V2zm2 2.2h7v4.6H6V4.2z"
      />
      {/* Fuel-level bars inside the body */}
      <rect x="6" y="11" width="7" height="1.6" />
      <rect x="6" y="14" width="7" height="1.6" />
      <rect x="6" y="17" width="4.2" height="1.6" />
      {/* Hose: rises from the body shoulder, hooks down to a nozzle column */}
      <path d="M16.2 6.8h1.6l3.2 3.4v7.2a2.55 2.55 0 0 1-5.1 0h1.7a.85.85 0 0 0 1.7 0v-4h-1.9v-2h1.9v-1.4l-1.7-1.8h-1.4v-1.4z" />
      {/* Ground line */}
      <rect x="2.6" y="22" width="13.8" height="1.5" />
    </svg>
  );
}
