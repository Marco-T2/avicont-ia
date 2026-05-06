/**
 * Phase 5 — MonthlyCloseService.close unit tests (cierre-periodo).
 *
 * All collaborators (repo, periodsService) are mocked via vi.fn.
 * Unit tests DO NOT hit the real DB. `repo.transaction` is mocked to
 * invoke the callback with a fake TransactionClient and return its result.
 *
 * Covers:
 *   T24 — PERIOD_NOT_FOUND propagation (404).
 */
import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  PERIOD_ALREADY_CLOSED,
  PERIOD_HAS_DRAFT_ENTRIES,
  PERIOD_NOT_FOUND,
  PERIOD_UNBALANCED,
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
    lockDispatches: vi.fn(),
    lockPayments: vi.fn(),
    lockJournalEntries: vi.fn(),
    lockSales: vi.fn(),
    lockPurchases: vi.fn(),
    markPeriodClosed: vi.fn(),
    transaction: vi.fn(async (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => {
      // Minimal fake tx — only implements what setAuditContext touches.
      const fakeTx = {
        $executeRawUnsafe: vi.fn(async () => 0),
      } as unknown as Prisma.TransactionClient;
      return fn(fakeTx);
    }),
    // unused in these tests but part of the public repo surface
    countByStatus: vi.fn(),
    getJournalSummaryByVoucherType: vi.fn(),
  } as unknown as RepoMock;
}

function buildPeriodsServiceMock(): ReturnType<typeof makeFiscalPeriodsService> {
  return {
    getById: vi.fn(),
  } as unknown as ReturnType<typeof makeFiscalPeriodsService>;
}

const baseInput: CloseRequest = {
  organizationId: "org-1",
  periodId: "period-1",
  userId: "user-1",
};

// ── T24 — PERIOD_NOT_FOUND (404) ─────────────────────────────────────────────

describe("MonthlyCloseService.close — PERIOD_NOT_FOUND (T24)", () => {
  it("close throws PERIOD_NOT_FOUND (404) when period does not exist", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();
    const notFound = new NotFoundError("Período fiscal", PERIOD_NOT_FOUND);
    vi.mocked(periodsService.getById).mockRejectedValueOnce(notFound);

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    await expect(service.close(baseInput)).rejects.toSatisfy((err) => {
      return (
        err instanceof NotFoundError &&
        (err as NotFoundError).code === PERIOD_NOT_FOUND &&
        (err as NotFoundError).statusCode === 404
      );
    });

    // Locks in the NEW CloseRequest-object signature: the service MUST have
    // destructured input.organizationId and input.periodId from the single-arg
    // object and passed them as two strings to periodsService.getById.
    expect(periodsService.getById).toHaveBeenCalledWith("org-1", "period-1");
  });
});

// ── T25 — PERIOD_ALREADY_CLOSED (409) ────────────────────────────────────────

describe("MonthlyCloseService.close — PERIOD_ALREADY_CLOSED (T25)", () => {
  it("close throws PERIOD_ALREADY_CLOSED (409) when period.status = CLOSED", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    vi.mocked(periodsService.getById).mockResolvedValueOnce({
      id: "period-1",
      isOpen: () => false,
      status: { value: "CLOSED" },
    } as unknown as Awaited<ReturnType<ReturnType<typeof makeFiscalPeriodsService>["getById"]>>);

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    await expect(service.close(baseInput)).rejects.toSatisfy((err) => {
      return (
        err instanceof ConflictError &&
        (err as ConflictError).code === PERIOD_ALREADY_CLOSED &&
        (err as ConflictError).statusCode === 409
      );
    });
  });
});

// ── T26 — PERIOD_HAS_DRAFT_ENTRIES with per-entity counts ───────────────────

describe("MonthlyCloseService.close — PERIOD_HAS_DRAFT_ENTRIES (T26)", () => {
  it("close throws PERIOD_HAS_DRAFT_ENTRIES with per-entity counts", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    vi.mocked(periodsService.getById).mockResolvedValueOnce({
      id: "period-1",
      isOpen: () => true,
      status: { value: "OPEN" },
    } as unknown as Awaited<ReturnType<ReturnType<typeof makeFiscalPeriodsService>["getById"]>>);

    vi.mocked(repo.countDraftDocuments).mockResolvedValueOnce({
      dispatches: 2,
      payments: 0,
      journalEntries: 1,
      sales: 0,
      purchases: 0,
    });

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    await expect(service.close(baseInput)).rejects.toSatisfy((err) => {
      if (!(err instanceof ValidationError)) return false;
      if ((err as ValidationError).code !== PERIOD_HAS_DRAFT_ENTRIES) return false;
      if ((err as ValidationError).statusCode !== 422) return false;
      const details = (err as ValidationError & {
        details?: {
          dispatches?: number;
          payments?: number;
          journalEntries?: number;
          sales?: number;
          purchases?: number;
        };
      }).details;
      if (!details) return false;
      return (
        details.dispatches === 2 &&
        details.journalEntries === 1 &&
        details.sales === 0 &&
        details.purchases === 0
      );
    });
  });
});

// ── T27 — PERIOD_UNBALANCED with debit/credit/diff payload ──────────────────

describe("MonthlyCloseService.close — PERIOD_UNBALANCED (T27)", () => {
  it("close throws PERIOD_UNBALANCED with debit/credit/diff payload", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    vi.mocked(periodsService.getById).mockResolvedValueOnce({
      id: "period-1",
      isOpen: () => true,
      status: { value: "OPEN" },
    } as unknown as Awaited<ReturnType<ReturnType<typeof makeFiscalPeriodsService>["getById"]>>);

    vi.mocked(repo.countDraftDocuments).mockResolvedValueOnce({
      dispatches: 0,
      payments: 0,
      journalEntries: 0,
      sales: 0,
      purchases: 0,
    });

    vi.mocked(repo.sumDebitCredit).mockResolvedValueOnce({
      debit: new Prisma.Decimal("100.00"),
      credit: new Prisma.Decimal("95.00"),
    });

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    await expect(service.close(baseInput)).rejects.toSatisfy((err) => {
      if (!(err instanceof ValidationError)) return false;
      if ((err as ValidationError).code !== PERIOD_UNBALANCED) return false;
      if ((err as ValidationError).statusCode !== 422) return false;
      const details = (err as ValidationError & {
        details?: {
          debit?: Prisma.Decimal;
          credit?: Prisma.Decimal;
          diff?: Prisma.Decimal;
        };
      }).details;
      if (!details) return false;
      if (!details.debit || !details.credit || !details.diff) return false;
      return (
        details.debit.eq(new Prisma.Decimal("100.00")) &&
        details.credit.eq(new Prisma.Decimal("95.00")) &&
        details.diff.eq(new Prisma.Decimal("5.00"))
      );
    });
  });
});

// ── T28 — Happy path: CloseResult with correlationId ────────────────────────

describe("MonthlyCloseService.close — happy path (T28)", () => {
  it("close returns CloseResult with correlationId on success", async () => {
    const repo = buildRepoMock();
    const periodsService = buildPeriodsServiceMock();

    vi.mocked(periodsService.getById).mockResolvedValueOnce({
      id: "period-1",
      isOpen: () => true,
      status: { value: "OPEN" },
    } as unknown as Awaited<ReturnType<ReturnType<typeof makeFiscalPeriodsService>["getById"]>>);

    vi.mocked(repo.countDraftDocuments).mockResolvedValueOnce({
      dispatches: 0,
      payments: 0,
      journalEntries: 0,
      sales: 0,
      purchases: 0,
    });

    vi.mocked(repo.sumDebitCredit).mockResolvedValueOnce({
      debit: new Prisma.Decimal("200.00"),
      credit: new Prisma.Decimal("200.00"),
    });

    vi.mocked(repo.lockDispatches).mockResolvedValueOnce(3);
    vi.mocked(repo.lockPayments).mockResolvedValueOnce(1);
    vi.mocked(repo.lockJournalEntries).mockResolvedValueOnce(4);
    vi.mocked(repo.lockSales).mockResolvedValueOnce(2);
    vi.mocked(repo.lockPurchases).mockResolvedValueOnce(5);

    const closedAt = new Date("2026-04-21T12:00:00.000Z");
    vi.mocked(repo.markPeriodClosed).mockResolvedValueOnce({
      closedAt,
      closedBy: "user-1",
    } as unknown as Awaited<ReturnType<MonthlyCloseRepository["markPeriodClosed"]>>);

    const service = new MonthlyCloseService(
      repo as unknown as MonthlyCloseRepository,
      periodsService,
    );

    const result = await service.close(baseInput);

    expect(result.periodId).toBe("period-1");
    expect(result.periodStatus).toBe("CLOSED");
    expect(result.closedAt).toBeInstanceOf(Date);
    expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof result.locked.sales).toBe("number");
    expect(typeof result.locked.purchases).toBe("number");
    expect(result.locked.dispatches).toBe(3);
    expect(result.locked.payments).toBe(1);
    expect(result.locked.journalEntries).toBe(4);
    expect(result.locked.sales).toBe(2);
    expect(result.locked.purchases).toBe(5);
  });
});
