/**
 * Phase 6b — T38a RED: getSummary balance field tests (cierre-periodo).
 *
 * All collaborators (repo, periodsService) are mocked via vi.fn.
 * Tests fail until T38b extends getSummary to call sumDebitCreditNoTx.
 *
 * Covers:
 *   (a) balanced period → balance.balanced=true, totalDebit===totalCredit
 *   (b) unbalanced period → correct string-serialized Decimals + difference
 *   (c) empty period → all "0.00", balanced=true
 *   (d) MonthlyCloseSummary type MUST NOT have unbalancedEntries
 */
import { describe, it, expect, vi } from "vitest";
import { expectTypeOf } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { MonthlyCloseService } from "../monthly-close.service";
import type { MonthlyCloseRepository } from "../monthly-close.repository";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/fiscal-periods.service";
import type { MonthlyCloseSummary } from "../monthly-close.types";

// ── Shared mock factory ──────────────────────────────────────────────────────

type RepoMock = {
  [K in keyof MonthlyCloseRepository]: MonthlyCloseRepository[K];
};

function buildRepoMock(): RepoMock {
  return {
    countByStatus: vi.fn().mockResolvedValue(0),
    // 5-key default so `validateCanClose()` (called from `getSummary`) can
    // sum the fields without tripping on undefined.
    countDraftDocuments: vi.fn().mockResolvedValue({
      dispatches: 0,
      payments: 0,
      journalEntries: 0,
      sales: 0,
      purchases: 0,
    }),
    sumDebitCredit: vi.fn(),
    sumDebitCreditNoTx: vi.fn(),
    getJournalSummaryByVoucherType: vi.fn().mockResolvedValue([]),
    lockDispatches: vi.fn(),
    lockPayments: vi.fn(),
    lockJournalEntries: vi.fn(),
    lockSales: vi.fn(),
    lockPurchases: vi.fn(),
    markPeriodClosed: vi.fn(),
    transaction: vi.fn(),
  } as unknown as RepoMock;
}

function buildPeriodsServiceMock(): FiscalPeriodsService {
  return {
    getById: vi.fn().mockResolvedValue({
      id: "period-1",
      status: "OPEN",
    }),
  } as unknown as FiscalPeriodsService;
}

// ── (a) Balanced period ──────────────────────────────────────────────────────

describe("MonthlyCloseService.getSummary — balance.balanced=true (T38a-a)", () => {
  it("getSummary returns balance.balanced=true with equal debit/credit for balanced period", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    vi.mocked(repo.sumDebitCreditNoTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      debit: new Prisma.Decimal("500.00"),
      credit: new Prisma.Decimal("500.00"),
    });

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    const result = await service.getSummary("org-1", "period-1");

    expect(result.balance.balanced).toBe(true);
    expect(result.balance.totalDebit).toBe(result.balance.totalCredit);
  });
});

// ── (b) Unbalanced period — string-serialized Decimals + difference ──────────

describe("MonthlyCloseService.getSummary — string-serialized Decimals (T38a-b)", () => {
  it("getSummary returns balance object with totalDebit/totalCredit/difference as string-serialized Decimals", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    vi.mocked(repo.sumDebitCreditNoTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      debit: new Prisma.Decimal("100.00"),
      credit: new Prisma.Decimal("95.00"),
    });

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    const result = await service.getSummary("org-1", "period-1");

    expect(result.balance.totalDebit).toBe("100.00");
    expect(result.balance.totalCredit).toBe("95.00");
    expect(result.balance.difference).toBe("5.00");
    expect(result.balance.balanced).toBe(false);
  });
});

// ── (c) Empty period — all "0.00", balanced=true ─────────────────────────────

describe("MonthlyCloseService.getSummary — empty period (T38a-c)", () => {
  it("getSummary returns balance.balanced=true and totals = \"0.00\" for empty period", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    vi.mocked(repo.sumDebitCreditNoTx as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      debit: new Prisma.Decimal("0"),
      credit: new Prisma.Decimal("0"),
    });

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    const result = await service.getSummary("org-1", "period-1");

    expect(result.balance.balanced).toBe(true);
    expect(result.balance.totalDebit).toBe("0.00");
    expect(result.balance.totalCredit).toBe("0.00");
    expect(result.balance.difference).toBe("0.00");
  });
});

// ── (d) Compile-time: MonthlyCloseSummary MUST NOT have unbalancedEntries ────

describe("MonthlyCloseSummary type guard (T38a-d)", () => {
  it("MonthlyCloseSummary type does NOT include unbalancedEntries", () => {
    expectTypeOf<
      "unbalancedEntries" extends keyof MonthlyCloseSummary ? true : false
    >().toEqualTypeOf<false>();
    expect(true).toBe(true);
  });
});
