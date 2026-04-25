import type { FiscalPeriod } from "@/generated/prisma/client";

/**
 * Returns the single OPEN period covering `date`, or null.
 *
 * `date` is a "YYYY-MM-DD" string (from <input type="date">).
 * Comparison is done via ISO string slice on period dates to avoid UTC/TZ shift.
 * Bolivia is UTC-4 — constructing a Date from "2026-04-01" would parse as UTC midnight
 * and render as the prior day in local time. String-slice avoids all TZ math.
 *
 * Only OPEN periods are candidates. CLOSED and DRAFT periods are ignored.
 * Matching is inclusive on both bounds: startDate ≤ date ≤ endDate.
 *
 * Acepta `startDate`/`endDate` como Date (server) o string ISO (post-JSON wire).
 */
export function findPeriodCoveringDate(
  date: string,
  periods: FiscalPeriod[],
): FiscalPeriod | null {
  return (
    periods.find(
      (p) =>
        p.status === "OPEN" &&
        toIsoDateSlice(p.startDate) <= date &&
        date <= toIsoDateSlice(p.endDate),
    ) ?? null
  );
}

function toIsoDateSlice(d: Date | string): string {
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}
