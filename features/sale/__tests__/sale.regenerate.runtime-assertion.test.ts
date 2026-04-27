/**
 * C2 — SaleService.regenerateJournalForIvaChange runtime INV-1 assertion.
 *
 * Per design D2.d, when called with `externalTx`, the method MUST verify
 * that `app.current_user_id` is set on the outer transaction. The check uses
 * `current_setting('app.current_user_id', true)` — the missing-default-true
 * second arg makes it return NULL when the variable is absent (instead of
 * throwing), so `assertAuditContextSet` raises an INV-1 error.
 *
 * REQ-CORR.4 anti-scenario: caller passes externalTx without first calling
 * setAuditContext on it. The runtime guard MUST detect this and refuse.
 *
 * RED expected failure mode:
 *   - Pre-fix code does not assert audit context — it proceeds and the
 *     downstream Postgres trigger fails opaquely. This test asserts a
 *     specific INV-1 error message which is absent pre-fix.
 *
 * GREEN: assertAuditContextSet throws an Error("INV-1 violation: ...") that
 *        names the caller and the required fix path.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { SaleService } from "../sale.service";

const D = (v: string | number) => new Prisma.Decimal(String(v));

const ORG_ID = "org-rt-assert-sale";
const USER_ID = "user-rt-assert-sale";
const SALE_ID = "sale-rt-assert";
const PERIOD_ID = "period-rt-assert-sale";
const JOURNAL_ID = "journal-rt-assert-sale";

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
      { lineAmount: 2000, incomeAccountId: "acc-income", description: "line" },
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

function makeService(externalTx: Prisma.TransactionClient) {
  const repo = {
    findById: vi.fn().mockResolvedValue(makeSale()),
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
      id: "acc-income",
      isActive: true,
      isDetail: true,
      code: "4.1.1",
    }),
  };
  const journalRepo = {
    updateTx: vi.fn().mockResolvedValue({ id: JOURNAL_ID, lines: [] }),
  };

  const service = new SaleService(
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

describe("SaleService.regenerateJournalForIvaChange — runtime INV-1 assertion (REQ-CORR.4)", () => {
  it("throws INV-1 violation when externalTx has app.current_user_id NULL", async () => {
    // Simulates the anti-scenario: caller passed externalTx but forgot
    // setAuditContext, so current_setting('app.current_user_id', true) → NULL.
    const externalTx = {
      $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
      $queryRaw: vi.fn().mockResolvedValue([{ user_id: null }]),
    } as unknown as Prisma.TransactionClient;

    const h = makeService(externalTx);

    await expect(
      h.service.regenerateJournalForIvaChange({
        organizationId: ORG_ID,
        saleId: SALE_ID,
        userId: USER_ID,
        externalTx: h.externalTx,
        correlationId: "00000000-0000-4000-8000-000000000001",
      }),
    ).rejects.toThrow(/INV-1 violation/);

    // The journal write MUST NOT have happened.
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
        saleId: SALE_ID,
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
      saleId: SALE_ID,
      userId: USER_ID,
      externalTx: h.externalTx,
      correlationId: cid,
    });

    expect(result.correlationId).toBe(cid);
    expect(h.journalRepo.updateTx).toHaveBeenCalledTimes(1);
  });
});
