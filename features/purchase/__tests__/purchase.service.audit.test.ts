/**
 * Phase 2 — correlationId emission for PurchaseService.
 * (correlation-id-coverage, Group D, sites D12-D17)
 *
 * REQ-CORR.2: each mutating method must return a result with a non-null
 * correlationId (UUID v4), and setAuditContext must be called with that
 * exact UUID as the 5th argument (via withAuditTx).
 *
 * Sites covered:
 *   D12 — PurchaseService.post()
 *   D13 — PurchaseService.createAndPost()
 *   D14 — PurchaseService.update() LOCKED branch
 *   D15 — PurchaseService.editPosted() (via update() POSTED path)
 *   D16 — PurchaseService.void()
 *   D17 — PurchaseService.regenerateJournalForIvaChange() standalone path
 *
 * Note: D17 standalone already uses the 5-arg setAuditContext manually —
 * the test verifies it returns correlationId and calls setAuditContext with 5 args.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import * as auditCtx from "@/features/shared/audit-context";
import * as permissions from "@/features/permissions/server";
import { PurchaseService } from "../purchase.service";

const ORG_ID = "org-purchase-audit";
const PURCHASE_ID = "purchase-audit-001";
const PERIOD_ID = "period-audit-purchase";
const USER_ID = "user-audit-purchase";
const JOURNAL_ID = "journal-audit-purchase";
const PAYABLE_ID = "payable-audit-purchase";
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeDraftPurchase() {
  return {
    id: PURCHASE_ID,
    organizationId: ORG_ID,
    status: "DRAFT",
    periodId: PERIOD_ID,
    period: { id: PERIOD_ID, status: "OPEN" },
    sequenceNumber: null,
    totalAmount: new Prisma.Decimal("1000.00"),
    contactId: "contact-001",
    date: new Date("2025-03-15"),
    description: "Compra test",
    notes: null,
    journalEntryId: null,
    payableId: null,
    createdById: USER_ID,
    purchaseType: "COMPRA_GENERAL",
    shrinkagePct: null,
    details: [
      {
        lineAmount: new Prisma.Decimal("1000.00"),
        expenseAccountId: "acc-expense",
        description: "línea",
        order: 0,
      },
    ],
    ivaPurchaseBook: null,
    contact: {
      id: "contact-001",
      name: "Proveedor",
      type: "PROVEEDOR",
      paymentTermsDays: 30,
    },
    displayCode: null,
  };
}

function makePostedPurchase() {
  return {
    ...makeDraftPurchase(),
    status: "POSTED",
    sequenceNumber: 1,
    journalEntryId: JOURNAL_ID,
    payableId: PAYABLE_ID,
  };
}

function makeLockedPurchase() {
  return {
    ...makePostedPurchase(),
    status: "LOCKED",
  };
}

function makeFakeTx() {
  return {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ user_id: USER_ID }]),
    purchase: {
      update: vi.fn().mockResolvedValue(makeLockedPurchase()),
    },
    purchaseDetail: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    journalEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    accountsPayable: {
      findFirst: vi.fn().mockResolvedValue({ paid: new Prisma.Decimal("0") }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    paymentAllocation: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    fiscalPeriod: {
      findFirstOrThrow: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
    },
    ivaPurchaseBook: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

function buildService(initial: ReturnType<typeof makeDraftPurchase>) {
  const fakeTx = makeFakeTx();

  const repo = {
    findById: vi.fn().mockResolvedValue(initial),
    transaction: vi.fn(async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(fakeTx)),
    getNextSequenceNumber: vi.fn().mockResolvedValue(1),
    updateStatusTx: vi.fn().mockResolvedValue({ ...initial, status: "POSTED" }),
    createPostedTx: vi.fn().mockResolvedValue({ ...initial, id: PURCHASE_ID }),
    linkJournalAndPayable: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(initial),
    updateTx: vi.fn().mockResolvedValue(initial),
  };

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({
      cxpAccountCode: "2.1.1",
      expenseAccountCode: "5.1.1",
      ivaAccountCode: "2.1.3",
      roundingThreshold: 0,
    }),
  };

  const autoEntryGenerator = {
    generate: vi.fn().mockResolvedValue({ id: JOURNAL_ID, lines: [] }),
  };

  const balancesService = {
    applyPost: vi.fn().mockResolvedValue(undefined),
    applyVoid: vi.fn().mockResolvedValue(undefined),
  };

  const periodsService = {
    getById: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
  };

  const contactsService = {
    getActiveById: vi.fn().mockResolvedValue({
      id: "contact-001",
      name: "Proveedor",
      type: "PROVEEDOR",
      paymentTermsDays: 30,
    }),
  };

  const payablesRepo = {
    createTx: vi.fn().mockResolvedValue({ id: PAYABLE_ID }),
    voidTx: vi.fn().mockResolvedValue(undefined),
  };

  const accountsRepo = {
    findByCode: vi.fn().mockResolvedValue({ id: "acc-1", isActive: true, isDetail: true }),
    findById: vi.fn().mockResolvedValue({ id: "acc-expense", isActive: true, isDetail: true, code: "5.1.1" }),
  };

  const journalRepo = {
    updateTx: vi.fn().mockResolvedValue({ id: JOURNAL_ID, lines: [] }),
  };

  // Constructor order: repo, orgSettingsService, autoEntryGenerator,
  // contactsService, payablesRepo, balancesService, periodsService,
  // accountsRepo, journalRepo, ivaBooksService
  const service = new PurchaseService(
    repo as never,
    orgSettingsService as never,
    autoEntryGenerator as never,
    contactsService as never,
    payablesRepo as never,
    balancesService as never,
    periodsService as never,
    accountsRepo as never,
    journalRepo as never,
    undefined, // ivaBooksService
  );

  return { service, repo, fakeTx, autoEntryGenerator };
}

describe("PurchaseService — Phase 2 correlationId emission", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setAuditContextSpy = vi.spyOn(auditCtx, "setAuditContext").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── D12: post() ─────────────────────────────────────────────────────────────
  it("D12: post() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeDraftPurchase());

    const result = await service.post(ORG_ID, PURCHASE_ID, USER_ID);

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);

    const cid = (result as { correlationId: string }).correlationId;
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      cid,
    );
  });

  // ── D13: createAndPost() ─────────────────────────────────────────────────────
  it("D13: createAndPost() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeDraftPurchase());
    vi.spyOn(permissions, "canPost").mockResolvedValue(true);

    const result = await service.createAndPost(
      ORG_ID,
      {
        contactId: "contact-001",
        description: "Compra test",
        date: "2025-03-15",
        periodId: PERIOD_ID,
        purchaseType: "COMPRA_GENERAL",
        details: [{ expenseAccountId: "acc-expense", lineAmount: 1000, description: "línea", order: 0 }],
      } as never,
      { userId: USER_ID, role: "admin" },
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D14: update() LOCKED branch ──────────────────────────────────────────────
  it("D14: update() LOCKED branch returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeLockedPurchase() as never);

    const result = await service.update(
      ORG_ID,
      PURCHASE_ID,
      { description: "editado locked" },
      USER_ID,
      "admin",
      "justificacion valida para locked purchase",
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D15: editPosted() via update() POSTED branch ─────────────────────────────
  it("D15: update() POSTED branch (editPosted) returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedPurchase() as never);

    const result = await service.update(
      ORG_ID,
      PURCHASE_ID,
      { description: "editado posted" },
      USER_ID,
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D16: void() ─────────────────────────────────────────────────────────────
  it("D16: void() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedPurchase() as never);

    const result = await service.void(ORG_ID, PURCHASE_ID, USER_ID);

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── W-1.d: update() DRAFT branch ──────────────────────────────────────────
  it("W-1.d: update() DRAFT branch calls setAuditContext with the returned correlationId (REQ-CORR.2)", async () => {
    const { service } = buildService(makeDraftPurchase() as never); // status = DRAFT

    const result = await service.update(
      ORG_ID,
      PURCHASE_ID,
      { description: "editado draft" },
      USER_ID,
    );

    expect(result).toHaveProperty("correlationId");
    const cid = (result as { correlationId: string }).correlationId;
    expect(cid).toMatch(UUID_V4_REGEX);

    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined, // no justification for DRAFT
      cid,
    );
  });

  // ── D17: regenerateJournalForIvaChange() standalone ──────────────────────────
  it("D17: regenerateJournalForIvaChange() standalone returns result with UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedPurchase() as never);

    const result = await service.regenerateJournalForIvaChange({
      organizationId: ORG_ID,
      purchaseId: PURCHASE_ID,
      userId: USER_ID,
    });

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);

    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      (result as { correlationId: string }).correlationId,
    );
  });
});
