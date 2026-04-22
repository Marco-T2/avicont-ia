/**
 * User-Phase 3 — MonthlyCloseService.close unit multiplicity tests (F-03).
 *
 * One standalone `it()` per entity — REQ-8 items 3-7 — so a future regression in
 * ANY single entity's draft check manifests as its own failing test, not as a
 * bundled miss.
 *
 * Contract per test:
 *   - `countDraftDocuments` mock returns 5-key object (dispatches, payments,
 *     journalEntries, sales, purchases). Only the entity under test has `1`,
 *     the other 4 are `0`.
 *   - `close()` throws `ValidationError` with code `PERIOD_HAS_DRAFT_ENTRIES`,
 *     `details` reflects the 5 counts, and the user-facing Spanish message
 *     contains the entity noun per Spec B (es-BO).
 *
 * Fails until T21 widens `countDraftDocuments` to 5 keys, extends the
 * `ValidationError` payload, and aligns message terminology.
 */
import { describe, it, expect, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  ValidationError,
  PERIOD_HAS_DRAFT_ENTRIES,
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
    countByStatus: vi.fn(),
    getJournalSummaryByVoucherType: vi.fn(),
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

const baseInput: CloseRequest = {
  organizationId: "org-1",
  periodId: "period-1",
  userId: "user-1",
};

type Draft5 = {
  dispatches: number;
  payments: number;
  journalEntries: number;
  sales: number;
  purchases: number;
};

async function assertDraftsBlock(
  drafts: Draft5,
  expected: { messageIncludes: string; detailKey: keyof Draft5; detailValue: number },
): Promise<void> {
  const repo = buildRepoMock();
  const periodsService = buildPeriodsServiceMock();

  vi.mocked(repo.countDraftDocuments).mockResolvedValueOnce(
    drafts as unknown as Awaited<ReturnType<MonthlyCloseRepository["countDraftDocuments"]>>,
  );

  const service = new MonthlyCloseService(
    repo as unknown as MonthlyCloseRepository,
    periodsService,
  );

  await expect(service.close(baseInput)).rejects.toSatisfy((err) => {
    if (!(err instanceof ValidationError)) return false;
    if ((err as ValidationError).code !== PERIOD_HAS_DRAFT_ENTRIES) return false;
    if ((err as ValidationError).statusCode !== 422) return false;

    if (!err.message.includes(expected.messageIncludes)) return false;

    const details = (err as ValidationError & {
      details?: Partial<Draft5>;
    }).details;
    if (!details) return false;

    // Entity under test: exact expected value.
    if (details[expected.detailKey] !== expected.detailValue) return false;

    // Other entities: all must be present with value 0.
    const allKeys: Array<keyof Draft5> = [
      "dispatches",
      "payments",
      "journalEntries",
      "sales",
      "purchases",
    ];
    for (const k of allKeys) {
      if (k === expected.detailKey) continue;
      if (details[k] !== 0) return false;
    }
    return true;
  });
}

// ── T08 — Dispatch DRAFT blocks close (F-03 item 3) ─────────────────────────

describe("MonthlyCloseService.close — F-03 unit multiplicity (T08)", () => {
  it("throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Dispatch exists", async () => {
    await assertDraftsBlock(
      { dispatches: 1, payments: 0, journalEntries: 0, sales: 0, purchases: 0 },
      { messageIncludes: "despacho(s)", detailKey: "dispatches", detailValue: 1 },
    );
  });
});

// ── T09 — Payment DRAFT blocks close (F-03 item 4) ──────────────────────────

describe("MonthlyCloseService.close — F-03 unit multiplicity (T09)", () => {
  it("throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT Payment exists", async () => {
    await assertDraftsBlock(
      { dispatches: 0, payments: 1, journalEntries: 0, sales: 0, purchases: 0 },
      { messageIncludes: "pago(s)", detailKey: "payments", detailValue: 1 },
    );
  });
});

// ── T10 — JournalEntry DRAFT blocks close (F-03 item 5) ─────────────────────

describe("MonthlyCloseService.close — F-03 unit multiplicity (T10)", () => {
  it("throws PERIOD_HAS_DRAFT_ENTRIES when one DRAFT JournalEntry exists", async () => {
    // Spec B REQ-4 terminology: "asiento(s) de diario" (not bare "asiento(s)").
    await assertDraftsBlock(
      { dispatches: 0, payments: 0, journalEntries: 1, sales: 0, purchases: 0 },
      {
        messageIncludes: "asiento(s) de diario",
        detailKey: "journalEntries",
        detailValue: 1,
      },
    );
  });
});
