/**
 * Phase 3.3 RED — AnnualCloseService.getSummary shape test.
 *
 * Spec REQ-2.1 (year-aggregate balance — C-1/C-4); design rev 2 §4
 * (AnnualCloseSummary DTO).
 *
 * RED scope (this file):
 *  - Service class exists and exports `AnnualCloseService`.
 *  - `getSummary(orgId, year)` returns the `AnnualCloseSummary` shape
 *    documented in design rev 2 §4.
 *  - `balance` field is year-aggregate (NOT per-period — C-1) — driven by
 *    the NoTx port `aggregateYearDebitCreditNoTx`, exactly one call.
 *  - `fiscalYearStatus` collapses null FY into "NOT_INITIALIZED" (consumer
 *    surface; spec REQ-1.1 — first-close orgs).
 *  - `decemberStatus` collapses missing Dec into "NOT_FOUND".
 *  - `gateAllowed` mirrors the standard + edge dispatch (spec REQ-2.1 step 5)
 *    WITHOUT drafts/justification/result-account checks (those are gates
 *    enforced by `close()`, not `getSummary`).
 *
 * NOTE: this file is extended in Phase 3.4+ with `close()` orchestration
 * tests (gate failures, happy, edge, W-2 TOCTOU, W-3 race, C-5 propagation).
 * Keeping the file single per task 3.3-3.6 ordering avoids re-imports of
 * the same fake fixtures across files.
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *  - Module `../../application/annual-close.service` does not exist at HEAD
 *    f2fe0800. Vitest reports module-resolution failure; no it() executes.
 *  - Phase 3.7 GREEN creates the file.
 */
import Decimal from "decimal.js";
import { describe, expect, it, vi } from "vitest";

import { AnnualCloseService } from "../../application/annual-close.service";
import type { FiscalYearReaderPort } from "../../domain/ports/fiscal-year-reader.port";
import type { YearAccountingReaderPort } from "../../domain/ports/year-accounting-reader.port";
import type { DraftDocumentsReaderPort } from "@/modules/monthly-close/domain/ports/draft-documents-reader.port";
import type { AnnualCloseUnitOfWork } from "../../application/annual-close-unit-of-work";

function makeFiscalYearReader(
  overrides: Partial<FiscalYearReaderPort> = {},
): FiscalYearReaderPort {
  return {
    getByYear: vi.fn(async () => null),
    countPeriodsByStatus: vi.fn(async () => ({ closed: 0, open: 0, total: 0 })),
    ccExistsForYear: vi.fn(async () => false),
    decemberPeriodOf: vi.fn(async () => null),
    findResultAccount: vi.fn(async () => ({
      id: "acc_322",
      code: "3.2.2",
      nature: "ACREEDORA" as const,
    })),
    ...overrides,
  };
}

function makeYearAccountingReader(
  overrides: Partial<YearAccountingReaderPort> = {},
): YearAccountingReaderPort {
  return {
    aggregateYearDebitCreditNoTx: vi.fn(async () => ({
      debit: new Decimal("1000.00"),
      credit: new Decimal("1000.00"),
    })),
    ...overrides,
  };
}

function makeDraftDocumentsReader(
  overrides: Partial<DraftDocumentsReaderPort> = {},
): DraftDocumentsReaderPort {
  return {
    countDraftsByPeriod: vi.fn(async () => ({
      dispatches: 0,
      payments: 0,
      journalEntries: 0,
      sales: 0,
      purchases: 0,
    })),
    ...overrides,
  };
}

function makeUowStub(): AnnualCloseUnitOfWork {
  return {
    run: vi.fn(async () => {
      throw new Error(
        "UoW stub not configured for this test — use a per-test override",
      );
    }),
  } as unknown as AnnualCloseUnitOfWork;
}

describe("AnnualCloseService.getSummary — Phase 3.3 (shape + year-aggregate balance C-1)", () => {
  const ORG = "org_test";
  const YEAR = 2026;

  it("returns AnnualCloseSummary shape with fiscalYearStatus=NOT_INITIALIZED + decemberStatus=NOT_FOUND when no rows exist", async () => {
    const fyReader = makeFiscalYearReader();
    const yearReader = makeYearAccountingReader({
      aggregateYearDebitCreditNoTx: vi.fn(async () => ({
        debit: new Decimal("0"),
        credit: new Decimal("0"),
      })),
    });
    const service = new AnnualCloseService({
      fiscalYearReader: fyReader,
      yearAccountingReader: yearReader,
      draftDocuments: makeDraftDocumentsReader(),
      uow: makeUowStub(),
    });

    const summary = await service.getSummary(ORG, YEAR);

    expect(summary.year).toBe(YEAR);
    expect(summary.fiscalYearStatus).toBe("NOT_INITIALIZED");
    expect(summary.periods).toEqual({ closed: 0, open: 0, total: 0 });
    expect(summary.decemberStatus).toBe("NOT_FOUND");
    expect(summary.ccExists).toBe(false);
    expect(summary.gateAllowed).toBe(false);
    expect(typeof summary.gateReason).toBe("string");
    expect(summary.balance).toEqual({
      debit: "0.00",
      credit: "0.00",
      balanced: true,
    });
  });

  it("year-aggregate balance is sourced via aggregateYearDebitCreditNoTx exactly once (C-1 — NOT per-period sums)", async () => {
    const agg = vi.fn(async () => ({
      debit: new Decimal("12345.67"),
      credit: new Decimal("12345.67"),
    }));
    const service = new AnnualCloseService({
      fiscalYearReader: makeFiscalYearReader(),
      yearAccountingReader: makeYearAccountingReader({
        aggregateYearDebitCreditNoTx: agg,
      }),
      draftDocuments: makeDraftDocumentsReader(),
      uow: makeUowStub(),
    });

    const summary = await service.getSummary(ORG, YEAR);

    expect(agg).toHaveBeenCalledTimes(1);
    expect(agg).toHaveBeenCalledWith(ORG, YEAR);
    expect(summary.balance.debit).toBe("12345.67");
    expect(summary.balance.credit).toBe("12345.67");
    expect(summary.balance.balanced).toBe(true);
  });

  it("unbalanced year: balanced=false, debit/credit reflected as 2-decimal strings", async () => {
    const service = new AnnualCloseService({
      fiscalYearReader: makeFiscalYearReader(),
      yearAccountingReader: makeYearAccountingReader({
        aggregateYearDebitCreditNoTx: vi.fn(async () => ({
          debit: new Decimal("100.00"),
          credit: new Decimal("99.99"),
        })),
      }),
      draftDocuments: makeDraftDocumentsReader(),
      uow: makeUowStub(),
    });

    const summary = await service.getSummary(ORG, YEAR);

    expect(summary.balance.balanced).toBe(false);
    expect(summary.balance.debit).toBe("100.00");
    expect(summary.balance.credit).toBe("99.99");
  });

  it("standard-path readiness: 11 closed + Dec OPEN + balanced + balance + 12 periods → gateAllowed=true", async () => {
    const fyReader = makeFiscalYearReader({
      getByYear: vi.fn(async () => ({
        id: "fy_1",
        organizationId: ORG,
        year: YEAR,
        status: "OPEN" as const,
        closedAt: null,
        closedBy: null,
        closingEntryId: null,
        openingEntryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      countPeriodsByStatus: vi.fn(async () => ({
        closed: 11,
        open: 1,
        total: 12,
      })),
      ccExistsForYear: vi.fn(async () => false),
      decemberPeriodOf: vi.fn(async () => ({
        id: "p_dec",
        status: "OPEN" as const,
      })),
    });
    const service = new AnnualCloseService({
      fiscalYearReader: fyReader,
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: makeUowStub(),
    });

    const summary = await service.getSummary(ORG, YEAR);

    expect(summary.fiscalYearStatus).toBe("OPEN");
    expect(summary.periods).toEqual({ closed: 11, open: 1, total: 12 });
    expect(summary.decemberStatus).toBe("OPEN");
    expect(summary.ccExists).toBe(false);
    expect(summary.gateAllowed).toBe(true);
  });

  it("edge-path readiness: all 12 closed + Dec CLOSED + no CC + balanced → gateAllowed=true (edge)", async () => {
    const fyReader = makeFiscalYearReader({
      getByYear: vi.fn(async () => ({
        id: "fy_1",
        organizationId: ORG,
        year: YEAR,
        status: "OPEN" as const,
        closedAt: null,
        closedBy: null,
        closingEntryId: null,
        openingEntryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      countPeriodsByStatus: vi.fn(async () => ({
        closed: 12,
        open: 0,
        total: 12,
      })),
      ccExistsForYear: vi.fn(async () => false),
      decemberPeriodOf: vi.fn(async () => ({
        id: "p_dec",
        status: "CLOSED" as const,
      })),
    });
    const service = new AnnualCloseService({
      fiscalYearReader: fyReader,
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: makeUowStub(),
    });

    const summary = await service.getSummary(ORG, YEAR);

    expect(summary.gateAllowed).toBe(true);
  });

  it("CC already exists for year → gateAllowed=false with reason mentioning CC", async () => {
    const fyReader = makeFiscalYearReader({
      getByYear: vi.fn(async () => ({
        id: "fy_1",
        organizationId: ORG,
        year: YEAR,
        status: "OPEN" as const,
        closedAt: null,
        closedBy: null,
        closingEntryId: null,
        openingEntryId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      countPeriodsByStatus: vi.fn(async () => ({
        closed: 12,
        open: 0,
        total: 12,
      })),
      ccExistsForYear: vi.fn(async () => true),
      decemberPeriodOf: vi.fn(async () => ({
        id: "p_dec",
        status: "CLOSED" as const,
      })),
    });
    const service = new AnnualCloseService({
      fiscalYearReader: fyReader,
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: makeUowStub(),
    });

    const summary = await service.getSummary(ORG, YEAR);

    expect(summary.ccExists).toBe(true);
    expect(summary.gateAllowed).toBe(false);
    expect(summary.gateReason).toBeDefined();
  });
});
