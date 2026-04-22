import { describe, expect, it } from "vitest";
import { expectTypeOf } from "vitest";
import type {
  CloseErrorCode,
  CloseRequest,
  CloseResult,
  MonthlyCloseSummary,
} from "../monthly-close.types";

describe("CloseRequest type shape", () => {
  it("has organizationId, periodId, userId as required strings and optional justification", () => {
    expectTypeOf<CloseRequest>().toHaveProperty("organizationId");
    expectTypeOf<CloseRequest["organizationId"]>().toEqualTypeOf<string>();
    expectTypeOf<CloseRequest>().toHaveProperty("periodId");
    expectTypeOf<CloseRequest["periodId"]>().toEqualTypeOf<string>();
    expectTypeOf<CloseRequest>().toHaveProperty("userId");
    expectTypeOf<CloseRequest["userId"]>().toEqualTypeOf<string>();
    expectTypeOf<CloseRequest>().toHaveProperty("justification");
    expectTypeOf<CloseRequest["justification"]>().toEqualTypeOf<
      string | undefined
    >();
    expect(true).toBe(true);
  });
});

describe("CloseResult type shape", () => {
  it("has periodId, periodStatus CLOSED, closedAt Date, correlationId, and locked counts", () => {
    expectTypeOf<CloseResult>().toHaveProperty("periodId");
    expectTypeOf<CloseResult["periodId"]>().toEqualTypeOf<string>();

    expectTypeOf<CloseResult>().toHaveProperty("periodStatus");
    expectTypeOf<CloseResult["periodStatus"]>().toEqualTypeOf<"CLOSED">();

    expectTypeOf<CloseResult>().toHaveProperty("closedAt");
    expectTypeOf<CloseResult["closedAt"]>().toEqualTypeOf<Date>();

    expectTypeOf<CloseResult>().toHaveProperty("correlationId");
    expectTypeOf<CloseResult["correlationId"]>().toEqualTypeOf<string>();

    expectTypeOf<CloseResult>().toHaveProperty("locked");
    expectTypeOf<CloseResult["locked"]>().toEqualTypeOf<{
      dispatches: number;
      payments: number;
      journalEntries: number;
      sales: number;
      purchases: number;
    }>();
    expect(true).toBe(true);
  });
});

describe("CloseErrorCode type shape", () => {
  it("is a union that includes all five required error codes", () => {
    expectTypeOf<"PERIOD_NOT_FOUND">().toMatchTypeOf<CloseErrorCode>();
    expectTypeOf<"PERIOD_ALREADY_CLOSED">().toMatchTypeOf<CloseErrorCode>();
    expectTypeOf<"PERIOD_HAS_DRAFT_ENTRIES">().toMatchTypeOf<CloseErrorCode>();
    expectTypeOf<"PERIOD_UNBALANCED">().toMatchTypeOf<CloseErrorCode>();
    expectTypeOf<"INSUFFICIENT_PERMISSION">().toMatchTypeOf<CloseErrorCode>();
    expect(true).toBe(true);
  });
});

describe("MonthlyCloseSummary type shape", () => {
  it("has balance with balanced boolean and string-serialized Decimal fields", () => {
    expectTypeOf<MonthlyCloseSummary>().toHaveProperty("balance");
    expectTypeOf<MonthlyCloseSummary["balance"]>().toEqualTypeOf<{
      balanced: boolean;
      totalDebit: string;
      totalCredit: string;
      difference: string;
    }>();
    expect(true).toBe(true);
  });

  it("does NOT have an unbalancedEntries field (OQ-2 / REQ-11 guard)", () => {
    // This assertion fails at compile-time if unbalancedEntries is present.
    // "unbalancedEntries" must NOT extend keyof MonthlyCloseSummary.
    expectTypeOf<
      "unbalancedEntries" extends keyof MonthlyCloseSummary ? true : false
    >().toEqualTypeOf<false>();
    expect(true).toBe(true);
  });
});
