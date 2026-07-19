/** Shared mission formatting — mono-friendly compact numbers + T-minus. */

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return Math.round(n).toString();
}

/** T-minus readout — same idiom as CountdownStrip. */
export function formatTMinus(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const min = Math.floor((total % 3600) / 60);
  if (h >= 48) return `T-${Math.floor(h / 24)}D ${h % 24}H`;
  return `T-${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}
