/**
 * Phase 2 — correlationId emission for SaleService.
 * (correlation-id-coverage, Group D, sites D6-D10)
 *
 * REQ-CORR.2: each mutating method must return a result with a non-null
 * correlationId (UUID v4), and setAuditContext must be called with that
 * exact UUID as the 5th argument (via withAuditTx).
 *
 * Sites covered:
 *   D6  — SaleService.post()
 *   D7  — SaleService.createAndPost()
 *   D8  — SaleService.update() LOCKED branch
 *   D9  — SaleService.editPosted() (via update() POSTED path)
 *   D10 — SaleService.void()
 *
 * D11 (regenerateJournalForIvaChange) is verified in the existing regen-tx
 * and discriminated-union test files.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import * as auditCtx from "@/features/shared/audit-context";
import * as permissions from "@/features/permissions/server";
import { SaleService } from "../sale.service";

const D = (v: string | number) => new Prisma.Decimal(String(v));
const ORG_ID = "org-sale-audit";
const SALE_ID = "sale-audit-001";
const PERIOD_ID = "period-audit-sale";
const USER_ID = "user-audit-sale";
const JOURNAL_ID = "journal-audit-sale";
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeDraftSale() {
  return {
    id: SALE_ID,
    organizationId: ORG_ID,
    status: "DRAFT",
    periodId: PERIOD_ID,
    period: { id: PERIOD_ID, status: "OPEN" },
    sequenceNumber: null,
    totalAmount: D("1000.00"),
    contactId: "contact-001",
    date: new Date("2025-03-15"),
    description: "Venta test",
    notes: null,
    journalEntryId: null,
    receivableId: null,
    createdById: USER_ID,
    details: [{ lineAmount: 1000, incomeAccountId: "acc-income", description: "línea", order: 0 }],
    ivaSalesBook: null,
    contact: { id: "contact-001", name: "Cliente", type: "CLIENTE", paymentTermsDays: 30 },
  };
}

function makePostedSale() {
  return {
    ...makeDraftSale(),
    status: "POSTED",
    sequenceNumber: 1,
    journalEntryId: JOURNAL_ID,
    receivableId: "recv-001",
    ivaSalesBook: null,
  };
}

function makeLockedSale() {
  return {
    ...makePostedSale(),
    status: "LOCKED",
    createdById: USER_ID,
  };
}

function makeFakeTx() {
  return {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ user_id: USER_ID }]),
    sale: {
      update: vi.fn().mockResolvedValue(makeLockedSale()),
    },
    saleDetail: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    journalEntry: {
      findFirst: vi.fn().mockResolvedValue({ id: JOURNAL_ID, organizationId: ORG_ID, lines: [] }),
      update: vi.fn().mockResolvedValue({}),
    },
    accountsReceivable: {
      findFirst: vi.fn().mockResolvedValue({ paid: D("0") }),
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
    ivaSalesBook: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;
}

function buildService(initial: ReturnType<typeof makeDraftSale>) {
  const fakeTx = makeFakeTx();

  const repo = {
    findById: vi.fn().mockResolvedValue(initial),
    transaction: vi.fn(async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(fakeTx)),
    getNextSequenceNumber: vi.fn().mockResolvedValue(1),
    updateStatusTx: vi.fn().mockResolvedValue({ ...initial, status: "POSTED" }),
    createPostedTx: vi.fn().mockResolvedValue({ ...initial, id: SALE_ID }),
    linkJournalAndReceivable: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(initial),
  };

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({
      cxcAccountCode: "1.1.2",
      salesAccountCode: "4.1.1",
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
      id: "contact-001", name: "Cliente", type: "CLIENTE", paymentTermsDays: 30,
    }),
  };

  const receivablesRepo = {
    createTx: vi.fn().mockResolvedValue({ id: "recv-001" }),
    voidTx: vi.fn().mockResolvedValue(undefined),
  };

  const accountsRepo = {
    findByCode: vi.fn().mockResolvedValue({ id: "acc-1", isActive: true, isDetail: true }),
    findById: vi.fn().mockResolvedValue({ id: "acc-income", isActive: true, isDetail: true }),
  };

  const journalRepo = {
    updateTx: vi.fn().mockResolvedValue({ id: JOURNAL_ID, lines: [] }),
  };

  // Constructor order: repo, orgSettingsService, autoEntryGenerator,
  // contactsService, receivablesRepo, balancesService, periodsService,
  // accountsRepo, journalRepo, ivaBooksService
  const service = new SaleService(
    repo as never,
    orgSettingsService as never,
    autoEntryGenerator as never,
    contactsService as never,
    receivablesRepo as never,
    balancesService as never,
    periodsService as never,
    accountsRepo as never,
    journalRepo as never,
    undefined, // ivaBooksService
  );

  return { service, repo, fakeTx, autoEntryGenerator };
}

describe("SaleService — Phase 2 correlationId emission", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setAuditContextSpy = vi.spyOn(auditCtx, "setAuditContext").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── D6: post() ──────────────────────────────────────────────────────────────
  it("D6: post() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeDraftSale());

    const result = await service.post(ORG_ID, SALE_ID, USER_ID);

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

  // ── D7: createAndPost() ─────────────────────────────────────────────────────
  it("D7: createAndPost() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeDraftSale());
    vi.spyOn(permissions, "canPost").mockResolvedValue(true);

    const result = await service.createAndPost(
      ORG_ID,
      {
        contactId: "contact-001",
        description: "Venta test",
        date: "2025-03-15",
        periodId: PERIOD_ID,
        details: [{ incomeAccountId: "acc-income", lineAmount: 1000, description: "línea", order: 0 }],
      },
      { userId: USER_ID, role: "admin" },
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D8: update() LOCKED branch ──────────────────────────────────────────────
  it("D8: update() LOCKED branch returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeLockedSale() as never);

    const result = await service.update(
      ORG_ID,
      SALE_ID,
      { description: "editado locked" },
      USER_ID,
      "admin",
      "justificacion valida para locked sale",
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D9: editPosted() via update() POSTED branch ─────────────────────────────
  it("D9: update() POSTED branch (editPosted) returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedSale() as never);

    const result = await service.update(
      ORG_ID,
      SALE_ID,
      { description: "editado posted" },
      USER_ID,
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D10: void() ─────────────────────────────────────────────────────────────
  it("D10: void() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedSale() as never);

    const result = await service.void(ORG_ID, SALE_ID, USER_ID);

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });
});
