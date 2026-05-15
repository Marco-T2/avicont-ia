/**
 * POC date-calendar-vs-instant-convention C3 RED — dateRangeSchema filter
 * semantics. `dateTo` MUST post-process to end-of-UTC-day so a same-day
 * window `{gte: T00, lte: T23:59:59.999}` includes BOTH legacy T00 rows
 * and new T12 rows (per §13.accounting.calendar-day-T12-utc-unified).
 *
 * Failure mode declared (pre-GREEN, per [[red_acceptance_failure_mode]]):
 *   SC-12: dateRangeSchema.parse({ dateTo: "2026-05-15" }).dateTo.toISOString()
 *     expected "2026-05-15T23:59:59.999Z", receives "2026-05-15T00:00:00.000Z"
 *     → MISMATCH (string suffix). No throw.
 *   SC-13: a hypothetical entry at T12 included by `{gte: T00, lte: dateTo}`
 *     where dateTo is the post-processed end-of-day. Pre-GREEN dateTo = T00 →
 *     T12 > T00 → NOT included → MISMATCH on boolean.
 *   SC-14 (preservation): T00 entry inclusion in `{gte: T00, lte: post-fix}`
 *     remains true (T00 ≤ T23:59:59.999) — must continue to PASS post-fix.
 */
import { describe, it, expect } from "vitest";
import { dateRangeSchema } from "../validation";

describe("POC date-calendar-vs-instant-convention C3 — dateRangeSchema.dateTo post-processes to end-of-UTC-day for inclusive same-day filter windows (legacy T00 + new T12 both included)", () => {
  it("SC-12: dateRangeSchema.parse({ dateTo: '2026-05-15' }).dateTo.toISOString() === '2026-05-15T23:59:59.999Z' (current emits T00 → MISMATCH pre-GREEN)", () => {
    const result = dateRangeSchema.parse({ dateTo: "2026-05-15" });
    expect(result.dateTo?.toISOString()).toBe("2026-05-15T23:59:59.999Z");
  });

  it("SC-13: T12 entry (2026-05-15T12:00:00.000Z) is included by a same-day window {gte: 2026-05-15T00:00:00Z, lte: dateRangeSchema.dateTo} — TRUE post-fix; FALSE pre-fix (T12 > T00)", () => {
    const result = dateRangeSchema.parse({
      dateFrom: "2026-05-15",
      dateTo: "2026-05-15",
    });
    const entryDate = new Date("2026-05-15T12:00:00.000Z");
    const included =
      entryDate.getTime() >= (result.dateFrom?.getTime() ?? -Infinity) &&
      entryDate.getTime() <= (result.dateTo?.getTime() ?? Infinity);
    expect(included).toBe(true);
  });

  it("SC-14 (preservation): T00 entry (2026-05-15T00:00:00.000Z) remains included by the same-day window post-fix (T00 ≤ T23:59:59.999Z) — currently passes; must continue post-GREEN", () => {
    const result = dateRangeSchema.parse({
      dateFrom: "2026-05-15",
      dateTo: "2026-05-15",
    });
    const entryDate = new Date("2026-05-15T00:00:00.000Z");
    const included =
      entryDate.getTime() >= (result.dateFrom?.getTime() ?? -Infinity) &&
      entryDate.getTime() <= (result.dateTo?.getTime() ?? Infinity);
    expect(included).toBe(true);
  });

  it("SC-12b: omitted dateTo remains undefined (preservation — optional() chain intact)", () => {
    const result = dateRangeSchema.parse({});
    expect(result.dateTo).toBeUndefined();
  });
});
