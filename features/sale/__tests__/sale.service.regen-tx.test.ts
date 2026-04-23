/**
 * Audit F #4/#5 RED — SaleService.regenerateJournalForIvaChange tx threading.
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
 *   - F-4-S8: method signature has 3 params today; passing a 4th tx arg makes
 *     TS reject. Current impl also calls `repo.transaction` internally, so the
 *     assertion `repo.transaction = 0` fails (count is 1 on pre-fix code).
 *   - F-4-S9: passes because the 3-arg path already calls `repo.transaction`
 *     once — this is the backwards-compat guard, expected to REMAIN green.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { SaleService } from "../sale.service";

const D = (v: string | number) => new Prisma.Decimal(String(v));

const ORG_ID = "org-regen-tx-sale";
const USER_ID = "user-regen-tx-sale";
const SALE_ID = "sale-regen-tx";
const PERIOD_ID = "period-regen-tx-sale";
const JOURNAL_ID = "journal-regen-tx-sale";

function makeSale(overrides: Record<string, unknown> = {}) {
  return {
    id: SALE_ID,
    organizationId: ORG_ID,
    status: "POSTED",
    periodId: PERIOD_ID,
    period: { id: PERIOD_ID, status: "OPEN" },
    sequenceNumber: 1,
    totalAmount: D("2000.00"),
    contactId: "contact-2",
    date: new Date("2025-03-15"),
    description: "Test sale",
    notes: null,
    journalEntryId: JOURNAL_ID,
    details: [
      {
        lineAmount: 2000,
        incomeAccountId: "acc-income",
        description: "line",
      },
    ],
    ivaSalesBook: {
      status: "ACTIVE",
      baseIvaSujetoCf: D("2000.00"),
      dfCfIva: D("260.00"),
      importeTotal: D("2000.00"),
      exentos: D("0"),
    },
    ...overrides,
  };
}

function makeHarness() {
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
    findById: vi.fn().mockResolvedValue(makeSale()),
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
      .mockResolvedValue({ id: "acc-income", isActive: true, isDetail: true, code: "4.1.1" }),
  };

  const journalRepo = {
    updateTx: vi.fn().mockResolvedValue({ id: JOURNAL_ID, lines: [] }),
  };

  const service = new SaleService(
    repo as never,
    orgSettingsService as never,
    undefined, // autoEntryGenerator
    undefined, // contactsService
    undefined, // receivablesRepo
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

describe("SaleService.regenerateJournalForIvaChange — tx threading (Audit F #4/#5)", () => {
  // ── F-4-S8 ──────────────────────────────────────────────────────────────
  it("F-4-S8 when caller passes tx, repo.transaction is NOT called (no nested tx)", async () => {
    const h = makeHarness();

    await (h.service as unknown as {
      regenerateJournalForIvaChange: (
        org: string,
        id: string,
        user: string,
        tx?: Prisma.TransactionClient,
      ) => Promise<unknown>;
    }).regenerateJournalForIvaChange(ORG_ID, SALE_ID, USER_ID, h.externalTx);

    expect(h.repo.transaction).toHaveBeenCalledTimes(0);

    expect(h.journalRepo.updateTx).toHaveBeenCalledTimes(1);
    const txArg = h.journalRepo.updateTx.mock.calls[0][0];
    expect(txArg).toBe(h.externalTx);
  });

  // ── F-4-S9 ──────────────────────────────────────────────────────────────
  it("F-4-S9 when caller omits tx, repo.transaction is called exactly once (backwards-compat)", async () => {
    const h = makeHarness();

    await h.service.regenerateJournalForIvaChange(ORG_ID, SALE_ID, USER_ID);

    expect(h.repo.transaction).toHaveBeenCalledTimes(1);
    expect(h.journalRepo.updateTx).toHaveBeenCalledTimes(1);
    const txArg = h.journalRepo.updateTx.mock.calls[0][0];
    expect(txArg).toBe(h.internalTx);
  });
});
