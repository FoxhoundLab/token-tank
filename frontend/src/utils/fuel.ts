/** Effective fuel level for a provider.
 *
 * The dashboard API's fuel_level is an estimate that defaults to full
 * until plan caps are known. When real quota windows exist, the
 * tightest window IS the tank — derive fuel from it instead. Locals
 * are unmetered and always read full.
 */

import type { ProviderSummary, QuotaWindowsResponse } from "../types";

export function effectiveFuel(
  data: ProviderSummary,
  quota?: QuotaWindowsResponse,
): number {
  if (data.provider_type === "local") return 1;
  const windows = (quota?.windows || []).filter((w) => w.limit > 0);
  if (windows.length === 0) return data.fuel_level;
  const remaining = Math.min(
    ...windows.map((w) => Math.max(0, 1 - w.used / w.limit)),
  );
  return Math.min(data.fuel_level, remaining);
}
