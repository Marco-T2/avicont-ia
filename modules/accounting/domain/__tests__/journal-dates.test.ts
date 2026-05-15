/**
 * POC date-calendar-vs-instant-convention C1 RED — write-path unit tests
 * for parseEntryDate. Asserts T12 UTC calendar-day emission per spec REQ-1
 * (D1 unification — Approach 2 LOCKED by Marco, proposal #2592).
 *
 * Sister precedent: `toNoonUtc` (lib/date-utils.ts:270) — same T12 contract
 * already canonical for Sale/Purchase/Dispatch repositories.
 *
 * Failure mode declared (pre-GREEN, per [[red_acceptance_failure_mode]]):
 *   SC-3: parseEntryDate("2026-05-15").toISOString() expected
 *     "2026-05-15T12:00:00.000Z", receives "2026-05-15T00:00:00.000Z"
 *     — MISMATCH (string suffix). No throw.
 *   SC-4: idempotent on full ISO — same MISMATCH shape.
 *
 * Throw paths (ValidationError on invalid) preserved by GREEN — NOT REDed
 * here (they already pass).
 */
import { describe, it, expect } from "vitest";
import { parseEntryDate } from "../journal.dates";

describe("POC date-calendar-vs-instant-convention C1 — parseEntryDate emits T12:00:00.000Z UTC for calendar-day inputs (D1 unification per [[named_rule_immutability]] — derived from toNoonUtc canonical write helper; throws preserved)", () => {
  it("SC-3: parseEntryDate('2026-05-15') returns Date whose ISO is '2026-05-15T12:00:00.000Z' (current body emits T00 — MISMATCH expected pre-GREEN)", () => {
    const d = parseEntryDate("2026-05-15");
    expect(d.toISOString()).toBe("2026-05-15T12:00:00.000Z");
  });

  it("SC-4: parseEntryDate idempotent on full-ISO input — '2026-04-30T00:00:00.000Z' returns '2026-04-30T12:00:00.000Z' (calendar-day extracted, noon UTC applied — current emits T00 → MISMATCH)", () => {
    const d = parseEntryDate("2026-04-30T00:00:00.000Z");
    expect(d.toISOString()).toBe("2026-04-30T12:00:00.000Z");
  });

  it("SC-4b: parseEntryDate idempotent on tz-offset input — '2026-04-30T23:00:00-04:00' (which is 2026-05-01 in UTC) takes calendar-day from offset-suffix-stripped form → '2026-04-30T12:00:00.000Z' (calendar-day from rawDate.split('T')[0], not from UTC re-derivation)", () => {
    const d = parseEntryDate("2026-04-30T23:00:00-04:00");
    expect(d.toISOString()).toBe("2026-04-30T12:00:00.000Z");
  });
});
