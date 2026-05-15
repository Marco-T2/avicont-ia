/**
 * POC date-calendar-vs-instant-convention C1 RED — Payment.date write-path
 * unit test. Asserts `createPaymentSchema.date` Zod boundary emits
 * `T12:00:00.000Z` UTC (calendar-day), matching the §13 NEW invariant
 * `calendar-day-T12-utc-unified` (D1).
 *
 * Sister precedent: Sale / Purchase / Dispatch repositories already apply
 * `toNoonUtc(input.date)` at the validation→domain boundary. Payment.date
 * currently passes through `z.coerce.date()` raw (T00), which violates the
 * unification convention.
 *
 * Failure mode declared (pre-GREEN, per [[red_acceptance_failure_mode]]):
 *   SC-6: createPaymentSchema.parse({...date: "2026-05-15"}).date.toISOString()
 *     expected "2026-05-15T12:00:00.000Z", receives "2026-05-15T00:00:00.000Z"
 *     — MISMATCH (string suffix). No throw.
 *
 * Update path: `updatePaymentSchema.date.optional()` — same .transform(toNoonUtc)
 * chained AFTER .optional() (Zod chains transform on optional, undefined passes
 * through). Asserted in SC-6b.
 */
import { describe, it, expect } from "vitest";
import {
  createPaymentSchema,
  updatePaymentSchema,
} from "../validation";

describe("POC date-calendar-vs-instant-convention C1 — Payment.date Zod boundary emits T12:00:00.000Z UTC (D1 unification; sister precedent toNoonUtc canonical write helper for Sale/Purchase/Dispatch — Payment joins via .transform(toNoonUtc))", () => {
  it("SC-6: createPaymentSchema with date 'YYYY-MM-DD' emits T12 ISO (current z.coerce.date emits T00 → MISMATCH pre-GREEN)", () => {
    const result = createPaymentSchema.parse({
      method: "EFECTIVO",
      date: "2026-05-15",
      amount: 100,
      description: "test",
      periodId: "p1",
      contactId: "c1",
      allocations: [],
    });
    expect(result.date.toISOString()).toBe("2026-05-15T12:00:00.000Z");
  });

  it("SC-6b: updatePaymentSchema with date 'YYYY-MM-DD' emits T12 ISO (optional date — when provided, transform applies; current → T00 MISMATCH)", () => {
    const result = updatePaymentSchema.parse({ date: "2026-05-15" });
    expect(result.date?.toISOString()).toBe("2026-05-15T12:00:00.000Z");
  });

  it("SC-6c: updatePaymentSchema with NO date — undefined passes through (preservation invariant; must continue to pass post-GREEN)", () => {
    const result = updatePaymentSchema.parse({});
    expect(result.date).toBeUndefined();
  });
});
