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
  PERIOD_ALREADY_CLOSED,
  PERIOD_NOT_FOUND,
} from "@/features/shared/errors";
import { MonthlyCloseService } from "../monthly-close.service";
import type { MonthlyCloseRepository } from "../monthly-close.repository";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/fiscal-periods.service";
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
      return fn({} as Prisma.TransactionClient);
    }),
    // unused in these tests but part of the public repo surface
    countByStatus: vi.fn(),
    getJournalSummaryByVoucherType: vi.fn(),
  } as unknown as RepoMock;
}

function buildPeriodsServiceMock(): FiscalPeriodsService {
  return {
    getById: vi.fn(),
  } as unknown as FiscalPeriodsService;
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
      status: "CLOSED",
    } as Awaited<ReturnType<FiscalPeriodsService["getById"]>>);

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
