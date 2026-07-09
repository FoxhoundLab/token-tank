/** Time helpers for backend timestamps.
 *
 * The API stores datetimes in UTC but serializes them without a
 * timezone suffix ("2026-07-09T05:14:00"), which Date() would parse as
 * LOCAL time and skew every countdown by the UTC offset. Treat
 * suffix-less timestamps as UTC.
 */

export function parseUTC(iso: string): number {
  const hasZone = /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
  return new Date(hasZone ? iso : `${iso}Z`).getTime();
}
