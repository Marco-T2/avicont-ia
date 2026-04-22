/**
 * T39 RED — Unit tests for `validateLockedEdit` with period-status differentiation.
 *
 * Spec: REQ-A6 (audit-log/spec.md).
 *
 * Target signature (after T40):
 *   validateLockedEdit(status, role, periodStatus: 'OPEN' | 'CLOSED' | undefined, justification?)
 *
 * Minimum justification length:
 *   - periodStatus === 'OPEN'   → 10 chars
 *   - periodStatus === 'CLOSED' → 50 chars
 *   - periodStatus === undefined → fail-safe, throws NotFoundError(PERIOD_NOT_FOUND)
 *
 * The calls below target the TARGET 4-arg signature and WILL fail TypeScript
 * compilation against the current 3-arg implementation. Vitest executes JS so
 * the RED tests still run and fail at runtime against the old behavior.
 */
import { describe, it, expect } from "vitest";
import { validateLockedEdit } from "@/features/shared/document-lifecycle.service";
import {
  LOCKED_EDIT_REQUIRES_JUSTIFICATION,
  PERIOD_NOT_FOUND,
  NotFoundError,
} from "@/features/shared/errors";

// Cast to the TARGET 4-arg signature so RED tests compile even while the
// implementation still has the old 3-arg signature.
type ValidateLockedEditFn = (
  status: string,
  role: string,
  periodStatus: "OPEN" | "CLOSED" | undefined,
  justification?: string,
) => void;
const validate = validateLockedEdit as unknown as ValidateLockedEditFn;

describe("validateLockedEdit with periodStatus (T39 RED)", () => {
  it("LOCKED doc in OPEN period, justification >= 10 chars → passes", () => {
    expect(() =>
      validate("LOCKED", "admin", "OPEN", "ten-chars!"),
    ).not.toThrow();
  });

  it("LOCKED doc in OPEN period, justification < 10 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=10", () => {
    try {
      validate("LOCKED", "admin", "OPEN", "short");
      throw new Error("expected validateLockedEdit to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as { code?: string }).code).toBe(
        LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      );
      expect(
        (err as { details?: { requiredMin?: number } }).details?.requiredMin,
      ).toBe(10);
    }
  });

  it("LOCKED doc in CLOSED period, justification >= 50 chars → passes", () => {
    const fiftyCharJustification =
      "This justification is exactly fifty characters ok!"; // 50 chars
    expect(fiftyCharJustification.length).toBe(50);
    expect(() =>
      validate("LOCKED", "admin", "CLOSED", fiftyCharJustification),
    ).not.toThrow();
  });

  it("LOCKED doc in CLOSED period, justification < 50 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=50", () => {
    // 20-char justification: passes the old 10-char threshold but fails the
    // new 50-char CLOSED-period threshold.
    try {
      validate("LOCKED", "admin", "CLOSED", "twenty chars here!!!");
      throw new Error("expected validateLockedEdit to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as { code?: string }).code).toBe(
        LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      );
      expect(
        (err as { details?: { requiredMin?: number } }).details?.requiredMin,
      ).toBe(50);
    }
  });

  it("LOCKED doc, periodStatus=undefined → throws PERIOD_NOT_FOUND (fail-safe)", () => {
    try {
      validate("LOCKED", "admin", undefined, "a-very-long-justification-that-would-otherwise-pass-every-length-check");
      throw new Error("expected validateLockedEdit to throw");
    } catch (err) {
      expect(err).toBeInstanceOf(NotFoundError);
      expect((err as { code?: string }).code).toBe(PERIOD_NOT_FOUND);
    }
  });
});
