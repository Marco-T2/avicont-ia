/**
 * Phase 2.5a RED (per tasks artifact 2.7) — typed errors bundle for annual-close.
 *
 * Spec REQ-2.3 canonical list of 11 error classes — single source of truth.
 * Each class:
 *   - extends AppError (transitively via the appropriate semantic base)
 *   - exports a stable string `code` constant
 *   - maps to the HTTP status declared in spec REQ-2.3 / design rev 2 §7
 *   - exposes any structured payload as readonly fields or `details`
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *   At HEAD e2d49683 `annual-close-errors.ts` only exports `InvalidYearError`
 *   + `InvalidFiscalYearStatus`. The remaining 10 named imports below resolve
 *   to `undefined`, so every `expect(new SomethingError(...))` line throws
 *   `TypeError: ... is not a constructor` and the test file fails to load
 *   most assertions. Phase 2.5b GREEN populates the bundle.
 */

import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import { AppError } from "@/modules/shared/domain/errors";
import {
  BALANCE_NOT_ZERO,
  BalanceNotZeroError,
  DRAFT_ENTRIES_IN_DECEMBER,
  DraftEntriesInDecemberError,
  FISCAL_YEAR_ALREADY_CLOSED,
  FISCAL_YEAR_GATE_NOT_MET,
  FISCAL_YEAR_NOT_FOUND,
  FiscalYearAlreadyClosedError,
  FiscalYearGateNotMetError,
  FiscalYearNotFoundError,
  INVALID_YEAR,
  InvalidYearError,
  JUSTIFICATION_TOO_SHORT,
  JustificationTooShortError,
  MISSING_RESULT_ACCOUNT,
  MISSING_RESULT_ACCOUNT_HTTP,
  MissingResultAccountError,
  MONTHS_NOT_ALL_CLOSED,
  MonthsNotAllClosedError,
  PERIOD_ALREADY_CLOSED,
  PeriodAlreadyClosedError,
  YEAR_PERIODS_ALREADY_EXIST,
  YearOpeningPeriodsExistError,
} from "../../domain/errors/annual-close-errors";

describe("annual-close typed errors (REQ-2.3 canonical)", () => {
  it("FiscalYearAlreadyClosedError — 409 + code + payload", () => {
    const err = new FiscalYearAlreadyClosedError({ fiscalYearId: "fy_1" });
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe(FISCAL_YEAR_ALREADY_CLOSED);
    expect(FISCAL_YEAR_ALREADY_CLOSED).toBe("FISCAL_YEAR_ALREADY_CLOSED");
    expect(err.details).toMatchObject({ fiscalYearId: "fy_1" });
  });

  it("FiscalYearGateNotMetError — 422 + code + payload", () => {
    const err = new FiscalYearGateNotMetError({
      monthsClosed: 10,
      decStatus: "OPEN",
      ccExists: false,
      periodsCount: 12,
      reason: "month-3-open",
    });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe(FISCAL_YEAR_GATE_NOT_MET);
    expect(FISCAL_YEAR_GATE_NOT_MET).toBe("FISCAL_YEAR_GATE_NOT_MET");
    expect(err.details).toMatchObject({
      monthsClosed: 10,
      decStatus: "OPEN",
      ccExists: false,
      periodsCount: 12,
      reason: "month-3-open",
    });
  });

  it("MonthsNotAllClosedError — 422 + code", () => {
    const err = new MonthsNotAllClosedError({ openMonths: [3, 5] });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe(MONTHS_NOT_ALL_CLOSED);
    expect(MONTHS_NOT_ALL_CLOSED).toBe("MONTHS_NOT_ALL_CLOSED");
    expect(err.details).toMatchObject({ openMonths: [3, 5] });
  });

  it("BalanceNotZeroError — 422 + code + readonly debit/credit Decimal payload", () => {
    const debit = new Decimal("100.00");
    const credit = new Decimal("90.00");
    const err = new BalanceNotZeroError(debit, credit);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe(BALANCE_NOT_ZERO);
    expect(BALANCE_NOT_ZERO).toBe("BALANCE_NOT_ZERO");
    expect(err.debit.equals(debit)).toBe(true);
    expect(err.credit.equals(credit)).toBe(true);
    expect(err.details).toMatchObject({
      debit: "100",
      credit: "90",
    });
  });

  it("DraftEntriesInDecemberError — 422 + 5 readonly count payload fields", () => {
    const err = new DraftEntriesInDecemberError({
      dispatches: 1,
      payments: 2,
      journalEntries: 3,
      sales: 4,
      purchases: 5,
    });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe(DRAFT_ENTRIES_IN_DECEMBER);
    expect(DRAFT_ENTRIES_IN_DECEMBER).toBe("DRAFT_ENTRIES_IN_DECEMBER");
    expect(err.dispatches).toBe(1);
    expect(err.payments).toBe(2);
    expect(err.journalEntries).toBe(3);
    expect(err.sales).toBe(4);
    expect(err.purchases).toBe(5);
  });

  it("PeriodAlreadyClosedError — 409 + code + payload", () => {
    const err = new PeriodAlreadyClosedError({ periodId: "p_1", status: "CLOSED" });
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe(PERIOD_ALREADY_CLOSED);
    expect(PERIOD_ALREADY_CLOSED).toBe("PERIOD_ALREADY_CLOSED");
    expect(err.details).toMatchObject({ periodId: "p_1", status: "CLOSED" });
  });

  it("YearOpeningPeriodsExistError — 409 + code + payload", () => {
    const err = new YearOpeningPeriodsExistError({ year: 2027, existingCount: 4 });
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe(YEAR_PERIODS_ALREADY_EXIST);
    expect(YEAR_PERIODS_ALREADY_EXIST).toBe("YEAR_PERIODS_ALREADY_EXIST");
    expect(err.details).toMatchObject({ year: 2027, existingCount: 4 });
  });

  it("MissingResultAccountError — 500 + code (system misconfig, W-7)", () => {
    const err = new MissingResultAccountError({ organizationId: "org_1" });
    expect(err.statusCode).toBe(500);
    expect(MISSING_RESULT_ACCOUNT_HTTP).toBe(500);
    expect(err.code).toBe(MISSING_RESULT_ACCOUNT);
    expect(MISSING_RESULT_ACCOUNT).toBe("MISSING_RESULT_ACCOUNT");
    expect(err.details).toMatchObject({ organizationId: "org_1" });
  });

  // RED — REQ-2.3 / REQ-A.3 / CAN-5: MissingAccumulatedResultsAccountError
  // declared failure mode: `ReferenceError: MissingAccumulatedResultsAccountError
  // is not defined` (module export missing at HEAD 9e098809). T-03 GREEN
  // adds the class mirroring MissingResultAccountError shape exactly.
  it("MissingAccumulatedResultsAccountError — 500 + code (W-7 — 3.2.1 missing in chart of accounts)", async () => {
    const mod = await import("../../domain/errors/annual-close-errors");
    const Ctor = (mod as Record<string, unknown>)
      .MissingAccumulatedResultsAccountError as new (d: {
        organizationId: string;
      }) => AppError & { code: string; details: { organizationId: string } };
    expect(typeof Ctor).toBe("function");
    const err = new Ctor({ organizationId: "org_1" });
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(500);
    expect(err.code).toBe("MISSING_ACCUMULATED_RESULTS_ACCOUNT");
    expect(err.details).toMatchObject({ organizationId: "org_1" });
    expect(
      (mod as Record<string, unknown>).MISSING_ACCUMULATED_RESULTS_ACCOUNT,
    ).toBe("MISSING_ACCUMULATED_RESULTS_ACCOUNT");
  });

  it("JustificationTooShortError — 422 + code + payload", () => {
    const err = new JustificationTooShortError({ minLength: 50, actualLength: 10 });
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe(JUSTIFICATION_TOO_SHORT);
    expect(JUSTIFICATION_TOO_SHORT).toBe("JUSTIFICATION_TOO_SHORT");
    expect(err.details).toMatchObject({ minLength: 50, actualLength: 10 });
  });

  it("InvalidYearError — 422 + code (already exported by Phase 2.2)", () => {
    const err = new InvalidYearError(2200);
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe(INVALID_YEAR);
    expect(INVALID_YEAR).toBe("INVALID_YEAR");
  });

  it("FiscalYearNotFoundError — 404 + code", () => {
    const err = new FiscalYearNotFoundError({ organizationId: "org_1", year: 2024 });
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe(FISCAL_YEAR_NOT_FOUND);
    expect(FISCAL_YEAR_NOT_FOUND).toBe("FISCAL_YEAR_NOT_FOUND");
    expect(err.details).toMatchObject({ organizationId: "org_1", year: 2024 });
  });

  it("every class is instanceof Error (and AppError)", () => {
    const all: Error[] = [
      new FiscalYearAlreadyClosedError({ fiscalYearId: "x" }),
      new FiscalYearGateNotMetError({
        monthsClosed: 0,
        decStatus: "OPEN",
        ccExists: false,
        periodsCount: 0,
        reason: "z",
      }),
      new MonthsNotAllClosedError({ openMonths: [] }),
      new BalanceNotZeroError(new Decimal(0), new Decimal(0)),
      new DraftEntriesInDecemberError({
        dispatches: 0,
        payments: 0,
        journalEntries: 0,
        sales: 0,
        purchases: 0,
      }),
      new PeriodAlreadyClosedError({ periodId: "x", status: "CLOSED" }),
      new YearOpeningPeriodsExistError({ year: 2027, existingCount: 1 }),
      new MissingResultAccountError({ organizationId: "x" }),
      new JustificationTooShortError({ minLength: 50, actualLength: 0 }),
      new InvalidYearError(0),
      new FiscalYearNotFoundError({ organizationId: "x", year: 2024 }),
    ];
    for (const err of all) {
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(AppError);
    }
    expect(all).toHaveLength(11);
  });
});
