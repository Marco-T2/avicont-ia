/**
 * C2 — PurchaseService.regenerateJournalForIvaChange runtime INV-1 assertion.
 *
 * Mirrors sale.regenerate.runtime-assertion.test.ts. See that file for full
 * rationale.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { PurchaseService } from "../purchase.service";

const D = (v: string | number) => new Prisma.Decimal(String(v));

const ORG_ID = "org-rt-assert-purchase";
const USER_ID = "user-rt-assert-purchase";
const PURCHASE_ID = "purchase-rt-assert";
const PERIOD_ID = "period-rt-assert-purchase";
const JOURNAL_ID = "journal-rt-assert-purchase";

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
      { lineAmount: 1000, expenseAccountId: "acc-expense", description: "line" },
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

function makeService(externalTx: Prisma.TransactionClient) {
  const repo = {
    findById: vi.fn().mockResolvedValue(makePurchase()),
    transaction: vi.fn(),
  };
  const orgSettingsService = { getOrCreate: vi.fn().mockResolvedValue({}) };
  const balancesService = {
    applyVoid: vi.fn().mockResolvedValue(undefined),
    applyPost: vi.fn().mockResolvedValue(undefined),
  };
  const accountsRepo = {
    findByCode: vi.fn().mockResolvedValue({
      id: "acc-1",
      isActive: true,
      isDetail: true,
      code: "1.1.1",
    }),
    findById: vi.fn().mockResolvedValue({
      id: "acc-expense",
      isActive: true,
      isDetail: true,
      code: "5.1.1",
    }),
  };
  const journalRepo = {
    updateTx: vi.fn().mockResolvedValue({ id: JOURNAL_ID, lines: [] }),
  };

  const service = new PurchaseService(
    repo as never,
    orgSettingsService as never,
    undefined,
    undefined,
    undefined,
    balancesService as never,
    undefined,
    accountsRepo as never,
    journalRepo as never,
  );

  return { service, repo, journalRepo, externalTx };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PurchaseService.regenerateJournalForIvaChange — runtime INV-1 assertion (REQ-CORR.4)", () => {
  it("throws INV-1 violation when externalTx has app.current_user_id NULL", async () => {
    const externalTx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([{ user_id: null }]),
    } as unknown as Prisma.TransactionClient;

    const h = makeService(externalTx);

    await expect(
      h.service.regenerateJournalForIvaChange({
        organizationId: ORG_ID,
        purchaseId: PURCHASE_ID,
        userId: USER_ID,
        externalTx: h.externalTx,
        correlationId: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow(/INV-1 violation/);

    expect(h.journalRepo.updateTx).not.toHaveBeenCalled();
  });

  it("throws INV-1 violation when externalTx returns empty-string user_id", async () => {
    const externalTx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([{ user_id: "" }]),
    } as unknown as Prisma.TransactionClient;

    const h = makeService(externalTx);

    await expect(
      h.service.regenerateJournalForIvaChange({
        organizationId: ORG_ID,
        purchaseId: PURCHASE_ID,
        userId: USER_ID,
        externalTx: h.externalTx,
        correlationId: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow(/INV-1 violation/);
  });

  it("succeeds when externalTx has app.current_user_id set", async () => {
    const externalTx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([{ user_id: USER_ID }]),
      fiscalPeriod: {
        findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
      },
      journalEntry: {
        findFirst: vi.fn().mockResolvedValue({
          id: JOURNAL_ID,
          organizationId: ORG_ID,
          lines: [],
        }),
      },
    } as unknown as Prisma.TransactionClient;

    const h = makeService(externalTx);
    const cid = "00000000-0000-4000-8000-000000000002";

    const result = await h.service.regenerateJournalForIvaChange({
      organizationId: ORG_ID,
      purchaseId: PURCHASE_ID,
      userId: USER_ID,
      externalTx: h.externalTx,
      correlationId: cid,
    });

    expect(result.correlationId).toBe(cid);
    expect(h.journalRepo.updateTx).toHaveBeenCalledTimes(1);
  });
});
