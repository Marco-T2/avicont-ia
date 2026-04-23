/**
 * Audit F #4/#5 RED — PurchaseService.regenerateJournalForIvaChange tx threading.
 *
 * Contract under test (GREEN):
 *   - When caller passes a `tx` client, the method MUST use it directly and
 *     MUST NOT call `repo.transaction(...)` — Prisma does not support nested
 *     interactive transactions.
 *   - When caller omits `tx`, the method keeps existing behavior and calls
 *     `repo.transaction(...)` exactly once (backwards-compat with non-tx callers).
 *   - Reads that observe freshly-written IVA state (i.e. `getById`) MUST be
 *     routed through the parent tx when one is provided.
 *
 * Expected failure mode on current (pre-fix) code:
 *   - F-4-S6: `regenerateJournalForIvaChange` signature has 3 params today;
 *     passing a 4th tx arg makes TS reject the call. The test calls it as
 *     `(orgId, id, userId, tx)` and asserts `repo.transaction` = 0 calls — both
 *     fail pre-fix (the 4th arg is ignored and the method still calls
 *     `repo.transaction` internally, driving the count to 1).
 *   - F-4-S7: passes because the 3-arg path already calls `repo.transaction` —
 *     this scenario is the backwards-compat guard, expected to REMAIN green.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { PurchaseService } from "../purchase.service";

const D = (v: string | number) => new Prisma.Decimal(String(v));

const ORG_ID = "org-regen-tx";
const USER_ID = "user-regen-tx";
const PURCHASE_ID = "purchase-regen-tx";
const PERIOD_ID = "period-regen-tx";
const JOURNAL_ID = "journal-regen-tx";

function makePurchase(overrides: Record<string, unknown> = {}) {
  return {
    id: PURCHASE_ID,
    organizationId: ORG_ID,
    status: "POSTED",
    periodId: PERIOD_ID,
    period: { id: PERIOD_ID, status: "OPEN" },
    purchaseType: "COMPRA_GENERAL",
    sequenceNumber: 1,
    totalAmount: D("1000.00"),
    contactId: "contact-1",
    date: new Date("2025-03-15"),
    description: "Test",
    notes: null,
    journalEntryId: JOURNAL_ID,
    details: [
      {
        lineAmount: 1000,
        expenseAccountId: "acc-expense",
        description: "line",
      },
    ],
    ivaPurchaseBook: {
      status: "ACTIVE",
      baseIvaSujetoCf: D("1000.00"),
      dfCfIva: D("130.00"),
      importeTotal: D("1000.00"),
      exentos: D("0"),
    },
    ...overrides,
  };
}

function makeHarness() {
  // Sentinel tx client — identity-compared in assertions.
  const externalTx = {
    __externalTx: true,
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    fiscalPeriod: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }) },
    journalEntry: {
      findFirst: vi.fn().mockResolvedValue({
        id: JOURNAL_ID,
        organizationId: ORG_ID,
        lines: [],
      }),
    },
  } as unknown as Prisma.TransactionClient;

  const internalTx = {
    __internalTx: true,
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    fiscalPeriod: { findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }) },
    journalEntry: {
      findFirst: vi.fn().mockResolvedValue({
        id: JOURNAL_ID,
        organizationId: ORG_ID,
        lines: [],
      }),
    },
  } as unknown as Prisma.TransactionClient;

  const repo = {
    findById: vi.fn().mockResolvedValue(makePurchase()),
    transaction: vi
      .fn()
      .mockImplementation(async (cb: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        cb(internalTx),
      ),
  };

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({}),
  };

  const balancesService = {
    applyVoid: vi.fn().mockResolvedValue(undefined),
    applyPost: vi.fn().mockResolvedValue(undefined),
  };

  const accountsRepo = {
    findByCode: vi
      .fn()
      .mockResolvedValue({ id: "acc-1", isActive: true, isDetail: true, code: "1.1.1" }),
    findById: vi
      .fn()
      .mockResolvedValue({ id: "acc-expense", isActive: true, isDetail: true, code: "5.1.1" }),
  };

  const journalRepo = {
    updateTx: vi.fn().mockResolvedValue({ id: JOURNAL_ID, lines: [] }),
  };

  const service = new PurchaseService(
    repo as never,
    orgSettingsService as never,
    undefined, // autoEntryGenerator
    undefined, // contactsService
    undefined, // payablesRepo
    balancesService as never,
    undefined, // periodsService
    accountsRepo as never,
    journalRepo as never,
  );

  return {
    service,
    repo,
    orgSettingsService,
    balancesService,
    accountsRepo,
    journalRepo,
    externalTx,
    internalTx,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseService.regenerateJournalForIvaChange — tx threading (Audit F #4/#5)", () => {
  // ── F-4-S6 ──────────────────────────────────────────────────────────────
  it("F-4-S6 when caller passes tx, repo.transaction is NOT called (no nested tx)", async () => {
    const h = makeHarness();

    // Signature must accept optional tx as 4th param (GREEN goal).
    await (h.service as unknown as {
      regenerateJournalForIvaChange: (
        org: string,
        id: string,
        user: string,
        tx?: Prisma.TransactionClient,
      ) => Promise<unknown>;
    }).regenerateJournalForIvaChange(ORG_ID, PURCHASE_ID, USER_ID, h.externalTx);

    // CRITICAL: Prisma does not support nested interactive transactions.
    expect(h.repo.transaction).toHaveBeenCalledTimes(0);

    // The write-through-the-outer-tx must happen on the provided tx client:
    expect(h.journalRepo.updateTx).toHaveBeenCalledTimes(1);
    const txArg = h.journalRepo.updateTx.mock.calls[0][0];
    expect(txArg).toBe(h.externalTx);
  });

  // ── F-4-S7 ──────────────────────────────────────────────────────────────
  it("F-4-S7 when caller omits tx, repo.transaction is called exactly once (backwards-compat)", async () => {
    const h = makeHarness();

    await h.service.regenerateJournalForIvaChange(ORG_ID, PURCHASE_ID, USER_ID);

    expect(h.repo.transaction).toHaveBeenCalledTimes(1);
    // Internal tx is used for the journal write:
    expect(h.journalRepo.updateTx).toHaveBeenCalledTimes(1);
    const txArg = h.journalRepo.updateTx.mock.calls[0][0];
    expect(txArg).toBe(h.internalTx);
  });
});
