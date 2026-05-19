/**
 * Shared date formatter for glosa-enriquecida builders (REQ-GE-6, design D6).
 *
 * Returns the conditional `DD/MM` (same year as `refYear`) or `DD/MM/YY`
 * (different year, 2-digit year suffix).
 *
 * **Timezone contract**: the caller is responsible for passing a `Date`
 * already normalized to the organization's local timezone. This function uses
 * `getDate()`, `getMonth()`, and `getFullYear()` directly — DO NOT pass raw
 * UTC dates if the org TZ differs from UTC (avoids the comprobante-date-tz
 * regression archived 2026-04-17).
 *
 * Pure domain primitive: no I/O, no allocations beyond template strings,
 * byte-deterministic for the same inputs.
 *
 * @param date    Event date (already in organization-local timezone).
 * @param refYear Reference year — typically the JournalEntry's posting year.
 * @returns `DD/MM` if `date.getFullYear() === refYear`; otherwise `DD/MM/YY`.
 *
 * @example
 *   formatDateConditional(new Date(2026, 4, 17), 2026); // "17/05"
 *   formatDateConditional(new Date(2025, 11, 29), 2026); // "29/12/25"
 */
export function formatDateConditional(date: Date, refYear: number): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  if (date.getFullYear() === refYear) {
    return `${day}/${month}`;
  }
  const year2 = String(date.getFullYear()).slice(-2);
  return `${day}/${month}/${year2}`;
}
