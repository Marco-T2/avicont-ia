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
    decemberPeriodOf: vi.fn(async () => null),
    findResultAccount: vi.fn(async () => ({
      id: "acc_322",
      code: "3.2.2",
      nature: "ACREEDORA" as const,
    })),
    // REQ-A.3 default — pre-TX gate for 3.2.1 Resultados Acumulados.
    findAccumulatedResultsAccount: vi.fn(async () => ({
      id: "acc_321",
      code: "3.2.1",
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      countPeriodsByStatus: vi.fn(async () => ({
        closed: 11,
        open: 1,
        total: 12,
      })),
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      countPeriodsByStatus: vi.fn(async () => ({
        closed: 12,
        open: 0,
        total: 12,
      })),
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

  // CC-already-exists gate REMOVED per CAN-5.2 / REQ-A.8 — idempotency is
  // now exclusively `FiscalYear.status='CLOSED'`. The replacement test for the
  // FY-CLOSED gate already exists upstream ("getSummary returns CLOSED status").
});

// ─────────────────────────────────────────────────────────────────────────
// Phase 3.4 + 3.5 + 3.6 RED — AnnualCloseService.close() orchestration
// ─────────────────────────────────────────────────────────────────────────
//
// Per design rev 2 §4 "Close orchestration" + spec REQ-2.1 / REQ-2.2 /
// REQ-2.5 / REQ-2.7. Phase 3.7 GREEN implements `close()` on the same
// service class.

import {
  BalanceNotZeroError,
  DraftEntriesInDecemberError,
  FiscalYearAlreadyClosedError,
  FiscalYearGateNotMetError,
  InvalidYearError,
  JustificationTooShortError,
  MissingResultAccountError,
  PeriodAlreadyClosedError,
  YearOpeningPeriodsExistError,
} from "../../domain/errors/annual-close-errors";
import type { FiscalYearWriterTxPort } from "../../domain/ports/fiscal-year-writer-tx.port";
import type { YearAccountingReaderTxPort } from "../../domain/ports/year-accounting-reader-tx.port";
import type { AnnualClosingJournalWriterTxPort } from "../../domain/ports/annual-closing-journal-writer-tx.port";
import type { PeriodAutoCreatorTxPort } from "../../domain/ports/period-auto-creator-tx.port";
import type { AnnualCloseScope } from "../../application/annual-close-unit-of-work";
import type { AuditContext } from "@/modules/shared/domain/ports/unit-of-work";
import type { FiscalPeriodsTxRepo } from "@/modules/shared/domain/ports/fiscal-periods-tx.repo";
import type { AccountingReaderPort } from "@/modules/monthly-close/domain/ports/accounting-reader.port";
import type { PeriodLockingWriterPort } from "@/modules/monthly-close/domain/ports/period-locking-writer.port";
import { Money } from "@/modules/shared/domain/value-objects/money";

// ── Fake builders for scope-bound (tx) ports ────────────────────────────

function makeFiscalYearsWriter(
  overrides: Partial<FiscalYearWriterTxPort> = {},
): FiscalYearWriterTxPort {
  return {
    upsertOpen: vi.fn(async () => ({ id: "fy_1" })),
    markClosed: vi.fn(async () => ({ closedAt: new Date("2026-12-31T12:00:00Z") })),
    ...overrides,
  };
}

function makeYearAccountingTx(
  overrides: Partial<YearAccountingReaderTxPort> = {},
): YearAccountingReaderTxPort {
  return {
    aggregateYearDebitCredit: vi.fn(async () => ({
      debit: new Decimal("1000.00"),
      credit: new Decimal("1000.00"),
    })),
    aggregateResultAccountsByYear: vi.fn(async () => [
      {
        accountId: "acc_ingreso_1",
        code: "4.1.1",
        nature: "ACREEDORA" as const,
        type: "INGRESO" as const,
        subtype: null,
        debit: new Decimal("0"),
        credit: new Decimal("100.00"),
      },
      {
        accountId: "acc_gasto_1",
        code: "5.1.1",
        nature: "DEUDORA" as const,
        type: "GASTO" as const,
        subtype: null,
        debit: new Decimal("60.00"),
        credit: new Decimal("0"),
      },
    ]),
    aggregateBalanceSheetAccountsForCA: vi.fn(async () => [
      {
        accountId: "acc_activo_1",
        code: "1.1.1",
        nature: "DEUDORA" as const,
        type: "ACTIVO" as const,
        subtype: null,
        debit: new Decimal("200.00"),
        credit: new Decimal("0"),
      },
      {
        accountId: "acc_patrimonio_321",
        code: "3.2.1",
        nature: "ACREEDORA" as const,
        type: "PATRIMONIO" as const,
        subtype: null,
        debit: new Decimal("0"),
        credit: new Decimal("200.00"),
      },
    ]),
    findResultAccount: vi.fn(async () => ({
      id: "acc_322",
      code: "3.2.2",
      nature: "ACREEDORA" as const,
    })),
    // annual-close-canonical-flow defaults (REQ-A.1/2/3/4/11). After Phase E
    // T-17 service rewrite these defaults make the happy path emit the full
    // 5-asientos sequence (4 CC + 1 CA) — per [[mock_hygiene_commit_scope]]:
    // default mocks updated atomically with service rewrite to keep happy-path
    // assertions working. Tests that need degenerate (empty) flow override.
    aggregateGastosByYear: vi.fn(async () => [
      {
        accountId: "acc_g",
        code: "5.1.1",
        nature: "DEUDORA" as const,
        type: "GASTO" as const,
        subtype: null,
        debit: new Decimal("1000"),
        credit: new Decimal("0"),
      },
    ]),
    aggregateIngresosByYear: vi.fn(async () => [
      {
        accountId: "acc_i",
        code: "4.1.1",
        nature: "ACREEDORA" as const,
        type: "INGRESO" as const,
        subtype: null,
        debit: new Decimal("0"),
        credit: new Decimal("3000"),
      },
    ]),
    aggregateBalanceSheetAtYearEnd: vi.fn(async () => [
      {
        accountId: "acc_caja",
        code: "1.1.1",
        nature: "DEUDORA" as const,
        type: "ACTIVO" as const,
        subtype: null,
        debit: new Decimal("2000"),
        credit: new Decimal("0"),
      },
      {
        accountId: "acc_321",
        code: "3.2.1",
        nature: "ACREEDORA" as const,
        type: "PATRIMONIO" as const,
        subtype: null,
        debit: new Decimal("0"),
        credit: new Decimal("2000"),
      },
    ]),
    findAccumulatedResultsAccountTx: vi.fn(async () => ({
      id: "acc_321",
      code: "3.2.1",
      nature: "ACREEDORA" as const,
    })),
    reReadFiscalYearStatusTx: vi.fn(async () => ({ status: "OPEN" as const })),
    reReadPeriodStatusTx: vi.fn(async () => ({ status: "OPEN" as const })),
    reReadCcExistsForYearTx: vi.fn(async () => false),
    ...overrides,
  };
}

function makeClosingJournals(
  overrides: Partial<AnnualClosingJournalWriterTxPort> = {},
): AnnualClosingJournalWriterTxPort {
  return {
    createAndPost: vi.fn(async (input) =>
      input.voucherTypeCode === "CC"
        ? { entryId: "je_cc_1" }
        : { entryId: "je_ca_1" },
    ),
    ...overrides,
  };
}

function makePeriodAutoCreator(
  overrides: Partial<PeriodAutoCreatorTxPort> = {},
): PeriodAutoCreatorTxPort {
  const periodIds = Array.from({ length: 12 }, (_, i) => `p_y1_m${i + 1}`);
  return {
    createTwelvePeriodsForYear: vi.fn(async () => ({
      periodIds,
      janPeriodId: periodIds[0]!,
    })),
    ...overrides,
  };
}

function makeFiscalPeriodsRepo(
  overrides: Partial<FiscalPeriodsTxRepo> = {},
): FiscalPeriodsTxRepo {
  return {
    markClosed: vi.fn(async (_orgId, _periodId, userId) => ({
      closedAt: new Date("2026-12-31T13:00:00Z"),
      closedBy: userId,
    })),
    ...overrides,
  };
}

function makeLocking(
  overrides: Partial<PeriodLockingWriterPort> = {},
): PeriodLockingWriterPort {
  return {
    lockDispatches: vi.fn(async () => 1),
    lockPayments: vi.fn(async () => 2),
    lockJournalEntries: vi.fn(async () => 3),
    lockSales: vi.fn(async () => 4),
    lockPurchases: vi.fn(async () => 5),
    ...overrides,
  };
}

function makeAccounting(
  overrides: Partial<AccountingReaderPort> = {},
): AccountingReaderPort {
  return {
    sumDebitCredit: vi.fn(async () => ({
      debit: Money.zero(),
      credit: Money.zero(),
    })),
    ...overrides,
  };
}

interface ScopeOverrides {
  fiscalYears?: Partial<FiscalYearWriterTxPort>;
  yearAccountingTx?: Partial<YearAccountingReaderTxPort>;
  closingJournals?: Partial<AnnualClosingJournalWriterTxPort>;
  periodAutoCreator?: Partial<PeriodAutoCreatorTxPort>;
  fiscalPeriods?: Partial<FiscalPeriodsTxRepo>;
  locking?: Partial<PeriodLockingWriterPort>;
  accounting?: Partial<AccountingReaderPort>;
}

/**
 * Build an in-memory UoW + the AnnualCloseScope it exposes to the callback.
 * Exposes the underlying fakes so tests can assert on them after run().
 */
function makeUowWithScope(overrides: ScopeOverrides = {}): {
  uow: AnnualCloseUnitOfWork;
  scope: AnnualCloseScope;
  lastCtx: { current: AuditContext | null };
  runSpy: ReturnType<typeof vi.fn>;
} {
  const scope: AnnualCloseScope = {
    correlationId: "corr-test-1",
    fiscalPeriods: makeFiscalPeriodsRepo(overrides.fiscalPeriods),
    fiscalYears: makeFiscalYearsWriter(overrides.fiscalYears),
    yearAccountingTx: makeYearAccountingTx(overrides.yearAccountingTx),
    closingJournals: makeClosingJournals(overrides.closingJournals),
    periodAutoCreator: makePeriodAutoCreator(overrides.periodAutoCreator),
    locking: makeLocking(overrides.locking),
    accounting: makeAccounting(overrides.accounting),
  };
  const lastCtx: { current: AuditContext | null } = { current: null };
  const runSpy = vi.fn(
    async <T,>(
      ctx: AuditContext,
      fn: (s: AnnualCloseScope) => Promise<T>,
    ): Promise<{ result: T; correlationId: string }> => {
      lastCtx.current = ctx;
      const result = await fn(scope);
      return { result, correlationId: scope.correlationId };
    },
  );
  return {
    uow: { run: runSpy } as unknown as AnnualCloseUnitOfWork,
    scope,
    lastCtx,
    runSpy,
  };
}

const VALID_JUSTIFICATION =
  "Cierre de la gestión anual 2026 ejecutado por el contador titular tras conciliar bancos, cargas sociales y stock.";

function makeStandardReadyReader(): FiscalYearReaderPort {
  return makeFiscalYearReader({
    getByYear: vi.fn(async () => ({
      id: "fy_1",
      organizationId: "org_test",
      year: 2026,
      status: "OPEN" as const,
      closedAt: null,
      closedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    countPeriodsByStatus: vi.fn(async (_orgId, y) => {
      if (y === 2026) return { closed: 11, open: 1, total: 12 };
      // year+1 (or any other year): empty — passes the pre-init gate.
      return { closed: 0, open: 0, total: 0 };
    }),
    decemberPeriodOf: vi.fn(async () => ({
      id: "p_dec",
      status: "OPEN" as const,
    })),
  });
}

function makeEdgeReadyReader(): FiscalYearReaderPort {
  return makeFiscalYearReader({
    getByYear: vi.fn(async () => ({
      id: "fy_1",
      organizationId: "org_test",
      year: 2026,
      status: "OPEN" as const,
      closedAt: null,
      closedBy: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
    countPeriodsByStatus: vi.fn(async (_orgId, y) => {
      if (y === 2026) return { closed: 12, open: 0, total: 12 };
      return { closed: 0, open: 0, total: 0 };
    }),
    decemberPeriodOf: vi.fn(async () => ({
      id: "p_dec",
      status: "CLOSED" as const,
    })),
  });
}

const ORG = "org_test";
const YEAR = 2026;
const USER = "user_test";

describe("AnnualCloseService.close — pre-TX gate failures (REQ-2.1, REQ-2.3)", () => {
  it("justification < 50 chars → JustificationTooShortError, NO uow.run", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, "Cierre"),
    ).rejects.toBeInstanceOf(JustificationTooShortError);

    expect(runSpy).not.toHaveBeenCalled();
  });

  it("invalid year (outside [1900,2100]) → InvalidYearError, NO uow.run", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, 1899, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(InvalidYearError);

    expect(runSpy).not.toHaveBeenCalled();
  });

  it("FY already CLOSED → FiscalYearAlreadyClosedError, NO uow.run", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeFiscalYearReader({
        getByYear: vi.fn(async () => ({
          id: "fy_1",
          organizationId: ORG,
          year: YEAR,
          status: "CLOSED" as const,
          closedAt: new Date("2025-12-31T12:00:00Z"),
          closedBy: "user_prev",
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
      }),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(FiscalYearAlreadyClosedError);

    expect(runSpy).not.toHaveBeenCalled();
  });

  it("missing periods (count !== 12) → FiscalYearGateNotMetError, NO uow.run", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeFiscalYearReader({
        countPeriodsByStatus: vi.fn(async () => ({
          closed: 5,
          open: 5,
          total: 10,
        })),
      }),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(FiscalYearGateNotMetError);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("gate not met (standard pattern broken: months 1-11 not all closed) → FiscalYearGateNotMetError", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeFiscalYearReader({
        countPeriodsByStatus: vi.fn(async () => ({
          closed: 7,
          open: 5,
          total: 12,
        })),
        decemberPeriodOf: vi.fn(async () => ({
          id: "p_dec",
          status: "OPEN" as const,
        })),
      }),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(FiscalYearGateNotMetError);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("Dec OPEN + drafts present → DraftEntriesInDecemberError, NO uow.run", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader({
        countDraftsByPeriod: vi.fn(async () => ({
          dispatches: 1,
          payments: 0,
          journalEntries: 2,
          sales: 0,
          purchases: 0,
        })),
      }),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(DraftEntriesInDecemberError);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("year+1 already initialised (any period exists) → YearOpeningPeriodsExistError", async () => {
    const callCount = { n: 0 };
    const fyReader = makeStandardReadyReader();
    fyReader.countPeriodsByStatus = vi.fn(async (_orgId, year) => {
      callCount.n += 1;
      if (year === YEAR) return { closed: 11, open: 1, total: 12 };
      // year+1 has rows → must reject
      return { closed: 0, open: 4, total: 4 };
    });

    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: fyReader,
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(YearOpeningPeriodsExistError);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("missing result account (chart-of-accounts seed bug) → MissingResultAccountError (HTTP 500, W-7)", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const fyReader = makeStandardReadyReader();
    fyReader.findResultAccount = vi.fn(async () => null);
    const service = new AnnualCloseService({
      fiscalYearReader: fyReader,
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(MissingResultAccountError);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("year-aggregate DEBE !== HABER (unconditional, C-1+C-4) → BalanceNotZeroError", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader({
        aggregateYearDebitCreditNoTx: vi.fn(async () => ({
          debit: new Decimal("1000.00"),
          credit: new Decimal("999.99"),
        })),
      }),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(BalanceNotZeroError);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("edge path: all 12 CLOSED + Dec CLOSED + unbalanced year → BalanceNotZeroError (C-4 unconditional, NOT silently skipped)", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeEdgeReadyReader(),
      yearAccountingReader: makeYearAccountingReader({
        aggregateYearDebitCreditNoTx: vi.fn(async () => ({
          debit: new Decimal("500.00"),
          credit: new Decimal("499.50"),
        })),
      }),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(BalanceNotZeroError);
    expect(runSpy).not.toHaveBeenCalled();
  });
});

describe("AnnualCloseService.close — happy path STANDARD (months 1-11 CLOSED + Dec OPEN)", () => {
  it("orchestrates 12 inside-TX steps in order + returns AnnualCloseResult shape + correlationId", async () => {
    const ctx = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: ctx.uow,
    });

    const result = await service.close(ORG, YEAR, USER, VALID_JUSTIFICATION);

    // ── return shape ────────────────────────────────────────────────
    expect(result.fiscalYearId).toBe("fy_1");
    expect(result.year).toBe(YEAR);
    expect(result.status).toBe("CLOSED");
    expect(result.closingEntryId).toBe("je_cc_1");
    expect(result.openingEntryId).toBe("je_ca_1");
    expect(result.correlationId).toBe("corr-test-1");
    expect(result.closedAt).toBeInstanceOf(Date);
    expect(result.yearPlus1.periodIds).toHaveLength(12);
    expect(result.decClose).toBeDefined();
    expect(result.decClose?.locked).toEqual({
      dispatches: 1,
      payments: 2,
      journalEntries: 3,
      sales: 4,
      purchases: 5,
    });

    // ── 12 INSIDE-TX steps in order ─────────────────────────────────
    // (a') TOCTOU re-reads first
    expect(ctx.scope.fiscalYears.upsertOpen).toHaveBeenCalledTimes(1);
    expect(ctx.scope.yearAccountingTx.reReadFiscalYearStatusTx)
      .toHaveBeenCalledWith("fy_1");
    expect(ctx.scope.yearAccountingTx.reReadPeriodStatusTx)
      .toHaveBeenCalledWith("p_dec");
    // reReadCcExistsForYearTx RETIRED per CAN-5.2 — must NOT be called.
    expect(ctx.scope.yearAccountingTx.reReadCcExistsForYearTx)
      .not.toHaveBeenCalled();

    // (b) year-aggregate balance re-assert inside-TX
    expect(ctx.scope.yearAccountingTx.aggregateYearDebitCredit)
      .toHaveBeenCalledWith(ORG, YEAR);

    // (c) 5-asientos canonical: 4 CC + 1 CA per CAN-5.
    // Updated from legacy "single CC source + findResultAccount" — now 3 reader
    // methods (gastos/ingresos/balanceSheetAtYearEnd) + 1 TOCTOU 3.2.1.
    expect(ctx.scope.yearAccountingTx.aggregateGastosByYear)
      .toHaveBeenCalledWith(ORG, YEAR);
    expect(ctx.scope.yearAccountingTx.aggregateIngresosByYear)
      .toHaveBeenCalledWith(ORG, YEAR);
    expect(ctx.scope.yearAccountingTx.aggregateBalanceSheetAtYearEnd)
      .toHaveBeenCalledWith(ORG, YEAR);
    expect(ctx.scope.yearAccountingTx.findResultAccount)
      .toHaveBeenCalledWith(ORG);
    expect(ctx.scope.yearAccountingTx.findAccumulatedResultsAccountTx)
      .toHaveBeenCalledWith(ORG);

    // (c.2) 4 CC entries posted into Dec OPEN BEFORE lock cascade (CAN-5.5)
    const allCalls = (
      ctx.scope.closingJournals.createAndPost as ReturnType<typeof vi.fn>
    ).mock.calls;
    const ccCalls = allCalls.filter((c) => c[0].voucherTypeCode === "CC");
    expect(ccCalls).toHaveLength(4);
    for (const ccCall of ccCalls) {
      expect(ccCall[0].periodId).toBe("p_dec");
      expect(ccCall[0].sourceType).toBe("annual-close");
      expect(ccCall[0].sourceId).toBe("fy_1");
      expect(ccCall[0].createdById).toBe(USER);
    }

    // (d) lock cascade STRICT ORDER (standard path only)
    expect(ctx.scope.locking.lockDispatches).toHaveBeenCalledWith(ORG, "p_dec");
    expect(ctx.scope.locking.lockPayments).toHaveBeenCalledWith(ORG, "p_dec");
    expect(ctx.scope.locking.lockJournalEntries).toHaveBeenCalledWith(ORG, "p_dec");
    expect(ctx.scope.locking.lockSales).toHaveBeenCalledWith(ORG, "p_dec");
    expect(ctx.scope.locking.lockPurchases).toHaveBeenCalledWith(ORG, "p_dec");

    // (d.2) Dec markClosed
    expect(ctx.scope.fiscalPeriods.markClosed).toHaveBeenCalledWith(
      ORG,
      "p_dec",
      USER,
    );

    // (h) auto-create year+1 12 periods
    expect(ctx.scope.periodAutoCreator.createTwelvePeriodsForYear)
      .toHaveBeenCalledWith({
        organizationId: ORG,
        year: YEAR + 1,
        createdById: USER,
      });

    // (f) CA #5 posted into Jan year+1 period — derived in-memory from #4
    // per CAN-5.1, NOT via the retired aggregateBalanceSheetAccountsForCA.
    const caCall = allCalls.find((c) => c[0].voucherTypeCode === "CA");
    expect(caCall).toBeDefined();
    expect(caCall![0].periodId).toBe("p_y1_m1");
    expect(caCall![0].sourceType).toBe("annual-close");
    expect(caCall![0].sourceId).toBe("fy_1");
    // Legacy aggregateBalanceSheetAccountsForCA NOT used in canonical flow.
    expect(ctx.scope.yearAccountingTx.aggregateBalanceSheetAccountsForCA)
      .not.toHaveBeenCalled();

    // (g) FY markClosed LAST — FK args RETIRED per CAN-5.6.
    expect(ctx.scope.fiscalYears.markClosed).toHaveBeenCalledWith(
      expect.objectContaining({
        fiscalYearId: "fy_1",
        closedBy: USER,
      }),
    );
    const markClosedArgs = (
      ctx.scope.fiscalYears.markClosed as ReturnType<typeof vi.fn>
    ).mock.calls[0]?.[0] as Record<string, unknown>;
    expect(markClosedArgs).not.toHaveProperty("closingEntryId");
    expect(markClosedArgs).not.toHaveProperty("openingEntryId");

    // AuditContext propagated to uow.run with justification
    expect(ctx.lastCtx.current).toEqual({
      userId: USER,
      organizationId: ORG,
      justification: VALID_JUSTIFICATION,
    });
  });
});

describe("AnnualCloseService.close — edge path (all 12 CLOSED + Dec CLOSED + no CC)", () => {
  it("skips Dec lock-cascade + Dec markClosed but still runs balance gate + CC + year+1 + CA + FY markClosed", async () => {
    const ctx = makeUowWithScope({
      yearAccountingTx: {
        // edge path: reRead Dec is CLOSED (matches expectation)
        reReadPeriodStatusTx: vi.fn(async () => ({ status: "CLOSED" as const })),
      },
    });
    const service = new AnnualCloseService({
      fiscalYearReader: makeEdgeReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: ctx.uow,
    });

    const result = await service.close(ORG, YEAR, USER, VALID_JUSTIFICATION);

    // Lock cascade SKIPPED on edge path
    expect(ctx.scope.locking.lockDispatches).not.toHaveBeenCalled();
    expect(ctx.scope.locking.lockPayments).not.toHaveBeenCalled();
    expect(ctx.scope.locking.lockJournalEntries).not.toHaveBeenCalled();
    expect(ctx.scope.locking.lockSales).not.toHaveBeenCalled();
    expect(ctx.scope.locking.lockPurchases).not.toHaveBeenCalled();
    // Dec markClosed SKIPPED on edge path (Dec already CLOSED)
    expect(ctx.scope.fiscalPeriods.markClosed).not.toHaveBeenCalled();
    expect(result.decClose).toBeUndefined();

    // Still runs 4×CC + 1×CA = 5 createAndPost + year+1 + FY markClosed
    // (CAN-5 canonical 5-asientos; edge path differs only in skipping the
    // Dec lock cascade + Dec markClosed because Dec is already CLOSED).
    expect(ctx.scope.closingJournals.createAndPost).toHaveBeenCalledTimes(5);
    expect(ctx.scope.periodAutoCreator.createTwelvePeriodsForYear)
      .toHaveBeenCalledTimes(1);
    expect(ctx.scope.fiscalYears.markClosed).toHaveBeenCalledTimes(1);
    expect(result.status).toBe("CLOSED");
    expect(result.closingEntryId).toBe("je_cc_1"); // asiento #4 maps to legacy field
    expect(result.openingEntryId).toBe("je_ca_1"); // asiento #5 maps to legacy field
  });
});

describe("AnnualCloseService.close — TOCTOU re-reads (W-2, spec REQ-2.2 step a')", () => {
  it("re-read FY shows CLOSED → throws FiscalYearAlreadyClosedError + rolls back", async () => {
    const ctx = makeUowWithScope({
      yearAccountingTx: {
        reReadFiscalYearStatusTx: vi.fn(async () => ({
          status: "CLOSED" as const,
        })),
      },
    });
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: ctx.uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(FiscalYearAlreadyClosedError);
    // No CC/CA/lock attempted
    expect(ctx.scope.closingJournals.createAndPost).not.toHaveBeenCalled();
    expect(ctx.scope.fiscalYears.markClosed).not.toHaveBeenCalled();
  });

  it("standard path: re-read Dec shows CLOSED → throws PeriodAlreadyClosedError + rolls back (Dec closed underfoot)", async () => {
    const ctx = makeUowWithScope({
      yearAccountingTx: {
        reReadPeriodStatusTx: vi.fn(async () => ({
          status: "CLOSED" as const,
        })),
      },
    });
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: ctx.uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(PeriodAlreadyClosedError);
    expect(ctx.scope.closingJournals.createAndPost).not.toHaveBeenCalled();
  });

  // CC-already-exists TOCTOU re-check RETIRED per CAN-5.2 / REQ-A.8.
  // Replaced by the existing FY-status TOCTOU re-read (which throws
  // FiscalYearAlreadyClosedError on CLOSED). The W-3 markClosed guard
  // absorbs any race that slips past upsertOpen + status re-read.

  it("INSIDE-TX year-aggregate balance fails → BalanceNotZeroError + rolls back", async () => {
    const ctx = makeUowWithScope({
      yearAccountingTx: {
        aggregateYearDebitCredit: vi.fn(async () => ({
          debit: new Decimal("1000.00"),
          credit: new Decimal("900.00"),
        })),
      },
    });
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: ctx.uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(BalanceNotZeroError);
    expect(ctx.scope.closingJournals.createAndPost).not.toHaveBeenCalled();
  });
});

describe("AnnualCloseService.close — W-3 race (guarded markClosed)", () => {
  it("FiscalYearWriterTxPort.markClosed throws FiscalYearAlreadyClosedError → propagates + TX rolls back", async () => {
    const ctx = makeUowWithScope({
      fiscalYears: {
        markClosed: vi.fn(async () => {
          throw new FiscalYearAlreadyClosedError({ fiscalYearId: "fy_1" });
        }),
      },
    });
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: ctx.uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(FiscalYearAlreadyClosedError);
  });
});

// ─────────────────────────────────────────────────────────────────────────
// T-16 + T-17 RED — annual-close-canonical-flow 5-asientos rewrite
// ─────────────────────────────────────────────────────────────────────────
//
// REQ refs: REQ-2.2 (11-step canonical order) + REQ-A.1..A.8 + CAN-5 +
//   CAN-5.3 (atomic) + CAN-5.5 (step ordering) + CAN-5.6 (FK retirement) +
//   REQ-A.3 (MissingAccumulatedResultsAccountError pre-TX gate).
//
// Expected failure modes (literal):
//   - "expected mock to have been called 4 times, but was called 1" — current
//     service emits 1 CC + 1 CA = 2 createAndPost. After T-17 GREEN the
//     standard happy-path emits 4 CC + 1 CA = 5 createAndPost.
//   - "expected error to be instance of MissingAccumulatedResultsAccountError,
//     received no error" — pre-TX gate not yet wired at HEAD d3309d29.

import {
  MissingAccumulatedResultsAccountError,
} from "../../domain/errors/annual-close-errors";

describe("AnnualCloseService.close — 5-asientos canonical flow (T-16 + T-17 RED)", () => {
  function makeAccumAccReader(): FiscalYearReaderPort {
    return makeFiscalYearReader({
      getByYear: vi.fn(async () => ({
        id: "fy_1",
        organizationId: "org_test",
        year: 2026,
        status: "OPEN" as const,
        closedAt: null,
        closedBy: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      countPeriodsByStatus: vi.fn(async (_o, y) =>
        y === 2026
          ? { closed: 11, open: 1, total: 12 }
          : { closed: 0, open: 0, total: 0 },
      ),
      decemberPeriodOf: vi.fn(async () => ({
        id: "p_dec",
        status: "OPEN" as const,
      })),
      findResultAccount: vi.fn(async () => ({
        id: "acc_322",
        code: "3.2.2",
        nature: "ACREEDORA" as const,
      })),
      findAccumulatedResultsAccount: vi.fn(async () => null),
    });
  }

  it("pre-TX gate: missing 3.2.1 Resultados Acumulados → MissingAccumulatedResultsAccountError", async () => {
    const { uow, runSpy } = makeUowWithScope();
    const service = new AnnualCloseService({
      fiscalYearReader: makeAccumAccReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(MissingAccumulatedResultsAccountError);
    expect(runSpy).not.toHaveBeenCalled();
  });

  it("happy path: emits 4 CC + 1 CA = 5 createAndPost in canonical order (CAN-5 + CAN-5.5)", async () => {
    const ctx = makeUowWithScope({
      yearAccountingTx: {
        // Force all 4 asientos to emit lines so we can count 5 createAndPost.
        aggregateGastosByYear: vi.fn(async () => [
          {
            accountId: "acc_g",
            code: "5.1.1",
            nature: "DEUDORA" as const,
            type: "GASTO" as const,
            subtype: null,
            debit: new Decimal("1000"),
            credit: new Decimal("0"),
          },
        ]),
        aggregateIngresosByYear: vi.fn(async () => [
          {
            accountId: "acc_i",
            code: "4.1.1",
            nature: "ACREEDORA" as const,
            type: "INGRESO" as const,
            subtype: null,
            debit: new Decimal("0"),
            credit: new Decimal("3000"),
          },
        ]),
        aggregateBalanceSheetAtYearEnd: vi.fn(async () => [
          {
            accountId: "acc_caja",
            code: "1.1.1",
            nature: "DEUDORA" as const,
            type: "ACTIVO" as const,
            subtype: null,
            debit: new Decimal("2000"),
            credit: new Decimal("0"),
          },
          {
            accountId: "acc_321",
            code: "3.2.1",
            nature: "ACREEDORA" as const,
            type: "PATRIMONIO" as const,
            subtype: null,
            debit: new Decimal("0"),
            credit: new Decimal("2000"),
          },
        ]),
      },
    });

    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: ctx.uow,
    });

    await service.close(ORG, YEAR, USER, VALID_JUSTIFICATION);

    const createAndPost = ctx.scope.closingJournals.createAndPost as ReturnType<
      typeof vi.fn
    >;
    expect(createAndPost).toHaveBeenCalledTimes(5);

    const calls = createAndPost.mock.calls.map((c) => c[0]);
    const voucherSequence = calls.map((c) => c.voucherTypeCode);
    expect(voucherSequence).toEqual(["CC", "CC", "CC", "CC", "CA"]);

    // CAN-5.5 step ordering: ALL 4 CC into Dec OPEN BEFORE lockJournalEntries
    // + markClosed(Dec); CA into Jan year+1 AFTER createTwelvePeriodsForYear.
    const lockJEMock = ctx.scope.locking.lockJournalEntries as ReturnType<
      typeof vi.fn
    >;
    const lockJECallOrder = lockJEMock.mock.invocationCallOrder[0]!;
    const ccCallOrders = createAndPost.mock.invocationCallOrder.slice(0, 4);
    for (const ccOrder of ccCallOrders) {
      expect(ccOrder).toBeLessThan(lockJECallOrder);
    }
  });
});

describe("AnnualCloseService.close — C-5 PeriodAlreadyClosedError propagation (REQ-2.7)", () => {
  it("AnnualClosingJournalWriterTxPort.createAndPost rejects CC into CLOSED period → propagates + rolls back", async () => {
    const ctx = makeUowWithScope({
      closingJournals: {
        createAndPost: vi.fn(async () => {
          throw new PeriodAlreadyClosedError({
            periodId: "p_dec",
            status: "CLOSED",
          });
        }),
      },
    });
    const service = new AnnualCloseService({
      fiscalYearReader: makeStandardReadyReader(),
      yearAccountingReader: makeYearAccountingReader(),
      draftDocuments: makeDraftDocumentsReader(),
      uow: ctx.uow,
    });

    await expect(
      service.close(ORG, YEAR, USER, VALID_JUSTIFICATION),
    ).rejects.toBeInstanceOf(PeriodAlreadyClosedError);
    // FY markClosed NOT attempted
    expect(ctx.scope.fiscalYears.markClosed).not.toHaveBeenCalled();
  });
});

