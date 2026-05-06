/**
 * User-Phase 3 — MonthlyCloseService.validateCanClose() dedicated unit tests (T19b).
 *
 * The shared SOT for "can this period be closed?" (REQ-5 / Design B3) MUST have
 * its own dedicated tests so that regressions in the merge point manifest as
 * direct failures here, not as side-effect failures in `close()` or
 * `getSummary()` consumer tests. This keeps diagnosis cheap.
 *
 * Visibility is `public` (not `private` as earlier design drafts) so this file
 * can call the method directly without bracket-notation escape hatches. The
 * architectural rationale: a shared SOT with multiple legitimate call sites
 * (close + summary today; potential UI pre-flight tomorrow) should be honestly
 * public.
 *
 * Fails until T20 introduces the method — both tests FAIL because the method
 * does not exist yet.
 */
import { describe, it, expect, vi } from "vitest";
import { MonthlyCloseService } from "../monthly-close.service";
import type { MonthlyCloseRepository } from "../monthly-close.repository";
import type { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";

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
    transaction: vi.fn(),
    countByStatus: vi.fn(),
    getJournalSummaryByVoucherType: vi.fn(),
  } as unknown as RepoMock;
}

function buildPeriodsServiceMock(): ReturnType<typeof makeFiscalPeriodsService> {
  return {
    getById: vi.fn(),
  } as unknown as ReturnType<typeof makeFiscalPeriodsService>;
}

// ── T19b.1 — drafts exist → canClose=false, total=sum(5) ─────────────────────

describe("MonthlyCloseService.validateCanClose — drafts exist (T19b)", () => {
  it("returns 7-key object with entity counts, total, and canClose=false when drafts exist", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    vi.mocked(repo.countDraftDocuments).mockResolvedValueOnce(
      {
        dispatches: 1,
        payments: 2,
        journalEntries: 3,
        sales: 4,
        purchases: 5,
      } as unknown as Awaited<
        ReturnType<MonthlyCloseRepository["countDraftDocuments"]>
      >,
    );

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    // `validateCanClose` is public; this call shape is the contract.
    const result = await (
      service as unknown as {
        validateCanClose: (
          organizationId: string,
          periodId: string,
        ) => Promise<{
          dispatches: number;
          payments: number;
          journalEntries: number;
          sales: number;
          purchases: number;
          total: number;
          canClose: boolean;
        }>;
      }
    ).validateCanClose("org-1", "period-1");

    expect(result).toEqual({
      dispatches: 1,
      payments: 2,
      journalEntries: 3,
      sales: 4,
      purchases: 5,
      total: 15,
      canClose: false,
    });
  });
});

// ── T19b.2 — all zeros → canClose=true, total=0 ──────────────────────────────

describe("MonthlyCloseService.validateCanClose — all zero drafts (T19b)", () => {
  it("returns canClose=true and total=0 when all entity counts are zero", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    vi.mocked(repo.countDraftDocuments).mockResolvedValueOnce(
      {
        dispatches: 0,
        payments: 0,
        journalEntries: 0,
        sales: 0,
        purchases: 0,
      } as unknown as Awaited<
        ReturnType<MonthlyCloseRepository["countDraftDocuments"]>
      >,
    );

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    const result = await (
      service as unknown as {
        validateCanClose: (
          organizationId: string,
          periodId: string,
        ) => Promise<{
          dispatches: number;
          payments: number;
          journalEntries: number;
          sales: number;
          purchases: number;
          total: number;
          canClose: boolean;
        }>;
      }
    ).validateCanClose("org-1", "period-1");

    expect(result.total).toBe(0);
    expect(result.canClose).toBe(true);
    expect(result.dispatches).toBe(0);
    expect(result.payments).toBe(0);
    expect(result.journalEntries).toBe(0);
    expect(result.sales).toBe(0);
    expect(result.purchases).toBe(0);
  });
});
