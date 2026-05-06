/**
 * User-Phase 3 — SHARE contract test (REQ-5 Scenario 5.3).
 *
 * `getSummary().drafts` and `close() error.details` MUST be the SAME shape,
 * derived from the SAME source. The test gates the merge point: if anyone
 * re-splits the path later, the deep-equals fails loudly.
 *
 * Today this test FAILS because:
 *   (1) `countDraftDocuments` returns only 3 keys, and
 *   (2) `getSummary` builds its own 3-key `drafts` using inline
 *       `countByStatus(DRAFT)` calls.
 * After T21 + T22 + T23, both paths read from `validateCanClose()` and the
 * assertion passes.
 */
import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  ValidationError,
  PERIOD_HAS_DRAFT_ENTRIES,
} from "@/features/shared/errors";
import { MonthlyCloseService } from "../monthly-close.service";
import type { MonthlyCloseRepository } from "../monthly-close.repository";
import type { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import type { CloseRequest } from "../monthly-close.types";

// ── Shared mock factory ──────────────────────────────────────────────────────

type RepoMock = {
  [K in keyof MonthlyCloseRepository]: MonthlyCloseRepository[K];
};

function buildRepoMock(): RepoMock {
  return {
    countDraftDocuments: vi.fn(),
    sumDebitCredit: vi.fn(),
    sumDebitCreditNoTx: vi.fn(),
    lockDispatches: vi.fn(),
    lockPayments: vi.fn(),
    lockJournalEntries: vi.fn(),
    lockSales: vi.fn(),
    lockPurchases: vi.fn(),
    markPeriodClosed: vi.fn(),
    transaction: vi.fn(async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      const fakeTx = {
        $executeRawUnsafe: vi.fn(async () => 0),
      } as unknown as Prisma.TransactionClient;
      return fn(fakeTx);
    }),
    countByStatus: vi.fn().mockResolvedValue(0),
    getJournalSummaryByVoucherType: vi.fn().mockResolvedValue([]),
  } as unknown as RepoMock;
}

function buildPeriodsServiceMock(): ReturnType<typeof makeFiscalPeriodsService> {
  return {
    getById: vi.fn().mockResolvedValue({
      id: "period-1",
      isOpen: () => true,
      status: { value: "OPEN" },
    }),
  } as unknown as ReturnType<typeof makeFiscalPeriodsService>;
}

const baseInput: CloseRequest = {
  organizationId: "org-1",
  periodId: "period-1",
  userId: "user-1",
};

// ── T18 — SHARE contract ────────────────────────────────────────────────────

describe("MonthlyCloseService — getSummary/close SHARE contract (T18)", () => {
  it("getSummary and close report identical draft counts for the same period state", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    // Single fixture state: 5-key draft counts, all non-zero.
    const draftFixture = {
      dispatches: 2,
      payments: 3,
      journalEntries: 5,
      sales: 7,
      purchases: 11,
    };

    // getSummary will call countDraftDocuments once (after T23 wiring); close()
    // will call it once via validateCanClose. Mock resolves the same payload for
    // both invocations — deep-equals asserts they surface as the same shape.
    vi.mocked(repo.countDraftDocuments).mockResolvedValue(
      draftFixture as unknown as Awaited<
        ReturnType<MonthlyCloseRepository["countDraftDocuments"]>
      >,
    );

    // getSummary also consults sumDebitCreditNoTx (not under test here) —
    // stub it so the summary path doesn't crash before we can compare shapes.
    vi.mocked(repo.sumDebitCreditNoTx as ReturnType<typeof vi.fn>).mockResolvedValue({
      debit: new Prisma.Decimal("0"),
      credit: new Prisma.Decimal("0"),
    });

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    const summary = await service.getSummary("org-1", "period-1");

    let errorDetails: Record<string, unknown> | undefined;
    try {
      await service.close(baseInput);
    } catch (err) {
      if (err instanceof ValidationError && err.code === PERIOD_HAS_DRAFT_ENTRIES) {
        errorDetails = (err as ValidationError & {
          details?: Record<string, unknown>;
        }).details;
      } else {
        throw err;
      }
    }

    expect(errorDetails).toBeDefined();
    expect(summary.drafts).toEqual(errorDetails);
  });
});
