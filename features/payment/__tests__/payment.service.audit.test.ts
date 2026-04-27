/**
 * Phase 1 + Phase 2 — setAuditContext coverage + correlationId emission
 * (correlation-id-coverage).
 *
 * Phase 1: Verifies that mutation methods on PaymentService set the audit
 * context (app.current_user_id / app.current_organization_id) as the FIRST
 * statement inside the tx callback.
 *
 * Phase 2: Verifies that each mutation method returns a result containing a
 * non-null correlationId (UUID v4), and that setAuditContext is called with
 * that exact correlationId as the 5th argument (via withAuditTx).
 *
 * Sites covered in this file:
 *   B3  — PaymentService.post()                 (Phase 1 — new wiring in PR)
 *   B4  — PaymentService.applyCreditOnly()       (Phase 1 — new wiring in PR)
 *   D24 — PaymentService.createAndPost()         (Phase 2)
 *   D25 — PaymentService.update() LOCKED         (Phase 2)
 *   D26 — PaymentService.post()                  (Phase 2)
 *   D27 — PaymentService.void()                  (Phase 2)
 *   D28 — PaymentService.updateAllocations()     (Phase 2)
 *   D29 — PaymentService.updatePostedPaymentTx() via update() POSTED (Phase 2)
 *   D30 — PaymentService.applyCreditOnly()       (Phase 2)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as auditCtx from "@/features/shared/audit-context";
import { PaymentService } from "../payment.service";
import type { PaymentRepository } from "../payment.repository";
import type { OrgSettingsService } from "@/features/org-settings/server";
import type { AccountBalancesService } from "@/features/account-balances/server";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { AccountsRepository } from "@/features/accounting/accounts.repository";
import type { PaymentWithRelations } from "../payment.types";
import type { Prisma } from "@/generated/prisma/client";

const ORG_ID = "org-audit-pay";
const PAYMENT_ID = "pay-audit-001";
const PERIOD_ID = "period-audit-001";
const USER_ID = "user-audit-001";
const SOURCE_PAYMENT_ID = "pay-source-001";
const RECEIVABLE_ID = "recv-001";
const CONTACT_ID = "contact-001";
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeDraftPayment(): PaymentWithRelations {
  return {
    id: PAYMENT_ID,
    organizationId: ORG_ID,
    sequenceNumber: null,
    paymentNumber: null,
    direction: "COBRO",
    method: "CASH",
    status: "DRAFT",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: CONTACT_ID,
    description: "Pago test",
    notes: null,
    referenceNumber: null,
    journalEntryId: null,
    amount: 100,
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    contact: { id: CONTACT_ID, name: "Cliente", type: "CLIENTE" },
    allocations: [],
  } as unknown as PaymentWithRelations;
}

function makePostedPayment(): PaymentWithRelations {
  return {
    ...makeDraftPayment(),
    status: "POSTED",
    journalEntryId: "entry-001",
    sequenceNumber: 1,
    allocations: [],
  } as unknown as PaymentWithRelations;
}

function makeLockedPayment(): PaymentWithRelations {
  return {
    ...makePostedPayment(),
    status: "LOCKED",
    createdById: USER_ID,
  } as unknown as PaymentWithRelations;
}

function makeSourcePayment(): PaymentWithRelations {
  return {
    ...makeDraftPayment(),
    id: SOURCE_PAYMENT_ID,
    status: "POSTED",
    journalEntryId: null,
    amount: 500,
    contactId: CONTACT_ID,
    allocations: [],
  } as unknown as PaymentWithRelations;
}

function makeFakeTx(): Prisma.TransactionClient {
  return {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ user_id: USER_ID }]),
    accountsReceivable: {
      findUnique: vi.fn().mockResolvedValue({
        id: RECEIVABLE_ID,
        organizationId: ORG_ID,
        status: "PENDING",
        amount: 1000,
        paid: 0,
        balance: 1000,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    accountsPayable: {
      findUnique: vi.fn(),
    },
    paymentAllocation: {
      create: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    journalEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    contact: {
      findUnique: vi.fn().mockResolvedValue({ id: CONTACT_ID, type: "CLIENTE" }),
    },
  } as unknown as Prisma.TransactionClient;
}

function buildService(initial: PaymentWithRelations) {
  const fakeTx = makeFakeTx();

  const repo = {
    findById: vi.fn(async () => initial),
    findByIdTx: vi.fn(async () => makeSourcePayment()),
    transaction: vi.fn(
      async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(fakeTx),
    ),
    updateStatusTx: vi.fn().mockResolvedValue(undefined),
    linkJournalEntry: vi.fn().mockResolvedValue(undefined),
    updateCxCPaymentTx: vi.fn().mockResolvedValue(undefined),
    updateCxPPaymentTx: vi.fn().mockResolvedValue(undefined),
    updateTx: vi.fn().mockResolvedValue(initial),
    update: vi.fn().mockResolvedValue(initial),
    createPostedTx: vi.fn().mockResolvedValue({ ...initial, id: PAYMENT_ID }),
    updateAllocations: vi.fn().mockResolvedValue(undefined),
    findById_orThrow: vi.fn(),
  } as unknown as PaymentRepository;

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({
      cxcAccountCode: "1.1.2",
      cxpAccountCode: "2.1.1",
      cashAccountCode: "1.1.1",
      bankAccountCode: "1.1.1",
      checkAccountCode: "1.1.1",
      cardAccountCode: "1.1.1",
      transferAccountCode: "1.1.1",
      cajaGeneralAccountCode: "1.1.1",
      bancoAccountCode: "1.1.1",
      roundingThreshold: 0,
    }),
  } as unknown as OrgSettingsService;

  const autoEntryGenerator = {
    generate: vi.fn().mockResolvedValue({ id: "entry-new", lines: [] }),
  };

  const balancesService = {
    applyPost: vi.fn().mockResolvedValue(undefined),
    applyVoid: vi.fn().mockResolvedValue(undefined),
  } as unknown as AccountBalancesService;

  const periodsService = {
    getById: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
    list: vi.fn(),
  } as unknown as FiscalPeriodsService;

  const accountsRepo = {
    findByCode: vi.fn().mockResolvedValue({ id: "acc-1", isActive: true, isDetail: true }),
    findById: vi.fn().mockResolvedValue({ id: "acc-1", isActive: true, isDetail: true }),
  } as unknown as AccountsRepository;

  const journalRepo = {
    updateTx: vi.fn().mockResolvedValue({ id: "entry-updated", lines: [] }),
  };

  const service = new PaymentService(
    repo,
    orgSettingsService,
    autoEntryGenerator as never,
    balancesService,
    periodsService,
    accountsRepo,
    journalRepo as never,
  );

  return { service, repo, autoEntryGenerator, fakeTx };
}

// ── Phase 1: B3/B4 with updated 5-arg assertions ───────────────────────────────

describe("PaymentService — Phase 1 setAuditContext coverage", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setAuditContextSpy = vi
      .spyOn(auditCtx, "setAuditContext")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── B3: post() ─────────────────────────────────────────────────────────────
  it("B3: post() calls setAuditContext FIRST inside the tx with (tx, userId, orgId, ...)", async () => {
    const { service, repo } = buildService(makeDraftPayment());

    await service.post(ORG_ID, PAYMENT_ID, USER_ID);

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx calls setAuditContext with 5 args
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const updateStatusOrder = (
      repo.updateStatusTx as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(updateStatusOrder);
  });

  // ── B4: applyCreditOnly() ──────────────────────────────────────────────────
  it("B4: applyCreditOnly() calls setAuditContext FIRST inside the tx with (tx, userId, orgId, ...)", async () => {
    const sourcePay = makeSourcePayment();
    const repo = {
      findById: vi.fn(async () => sourcePay),
      findByIdTx: vi.fn(async () => sourcePay),
      transaction: vi.fn(
        async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
          fn({
            accountsReceivable: {
              findUnique: vi.fn().mockResolvedValue({
                id: RECEIVABLE_ID,
                organizationId: ORG_ID,
                status: "PENDING",
                amount: 1000,
                paid: 0,
                balance: 1000,
              }),
            },
            paymentAllocation: { create: vi.fn().mockResolvedValue({}) },
            journalEntry: { findFirst: vi.fn().mockResolvedValue(null) },
          } as unknown as Prisma.TransactionClient),
      ),
      updateCxCPaymentTx: vi.fn().mockResolvedValue(undefined),
    } as unknown as PaymentRepository;

    const orgSettingsService = {
      getOrCreate: vi.fn().mockResolvedValue({}),
    } as unknown as OrgSettingsService;

    const balancesService = {
      applyPost: vi.fn(),
      applyVoid: vi.fn(),
    } as unknown as AccountBalancesService;

    const periodsService = {
      getById: vi.fn(),
      list: vi.fn(),
    } as unknown as FiscalPeriodsService;

    const service = new PaymentService(
      repo,
      orgSettingsService,
      {} as never,
      balancesService,
      periodsService,
    );

    await service.applyCreditOnly(ORG_ID, USER_ID, CONTACT_ID, [
      { sourcePaymentId: SOURCE_PAYMENT_ID, receivableId: RECEIVABLE_ID, amount: 50 },
    ]);

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx calls setAuditContext with 5 args
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const updateCxCOrder = (
      repo.updateCxCPaymentTx as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(updateCxCOrder);
  });
});

// ── Phase 2: D24-D30 ───────────────────────────────────────────────────────────

describe("PaymentService — Phase 2 correlationId emission", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setAuditContextSpy = vi.spyOn(auditCtx, "setAuditContext").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── D24: createAndPost() ───────────────────────────────────────────────────
  it("D24: createAndPost() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeDraftPayment());

    const result = await service.createAndPost(
      ORG_ID,
      {
        contactId: CONTACT_ID,
        description: "Pago test",
        date: new Date("2025-03-15"),
        periodId: PERIOD_ID,
        method: "CASH",
        amount: 100,
        allocations: [{ receivableId: RECEIVABLE_ID, amount: 100 }],
        direction: "COBRO",
      } as never,
      USER_ID,
    );

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

  // ── D25: update() LOCKED branch ────────────────────────────────────────────
  it("D25: update() LOCKED branch returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeLockedPayment());

    const result = await service.update(
      ORG_ID,
      PAYMENT_ID,
      { description: "editado locked" },
      "admin",
      "justificacion valida",
      USER_ID,
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D26: post() ───────────────────────────────────────────────────────────
  it("D26: post() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeDraftPayment());

    const result = await service.post(ORG_ID, PAYMENT_ID, USER_ID);

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

  // ── D27: void() ───────────────────────────────────────────────────────────
  it("D27: void() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedPayment());

    const result = await service.void(ORG_ID, PAYMENT_ID, USER_ID);

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D28: updateAllocations() ──────────────────────────────────────────────
  it("D28: updateAllocations() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedPayment());

    const result = await service.updateAllocations(
      ORG_ID,
      PAYMENT_ID,
      [{ receivableId: RECEIVABLE_ID, amount: 100 }],
      USER_ID,
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D29: update() POSTED branch (updatePostedPaymentTx) ───────────────────
  it("D29: update() POSTED branch (updatePostedPaymentTx) returns result with UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedPayment());

    const result = await service.update(
      ORG_ID,
      PAYMENT_ID,
      { description: "editado posted" },
      undefined,
      undefined,
      USER_ID,
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D30: applyCreditOnly() ─────────────────────────────────────────────────
  it("D30: applyCreditOnly() returns a result with a UUID v4 correlationId", async () => {
    const sourcePay = makeSourcePayment();
    const repo = {
      findById: vi.fn(async () => sourcePay),
      findByIdTx: vi.fn(async () => sourcePay),
      transaction: vi.fn(
        async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
          fn({
            $queryRaw: vi.fn().mockResolvedValue([{ user_id: USER_ID }]),
            accountsReceivable: {
              findUnique: vi.fn().mockResolvedValue({
                id: RECEIVABLE_ID,
                organizationId: ORG_ID,
                status: "PENDING",
                amount: 1000,
                paid: 0,
                balance: 1000,
              }),
            },
            paymentAllocation: { create: vi.fn().mockResolvedValue({}) },
            journalEntry: { findFirst: vi.fn().mockResolvedValue(null) },
          } as unknown as Prisma.TransactionClient),
      ),
      updateCxCPaymentTx: vi.fn().mockResolvedValue(undefined),
    } as unknown as PaymentRepository;

    const orgSettingsService = {
      getOrCreate: vi.fn().mockResolvedValue({}),
    } as unknown as OrgSettingsService;
    const balancesService = { applyPost: vi.fn(), applyVoid: vi.fn() } as unknown as AccountBalancesService;
    const periodsService = { getById: vi.fn(), list: vi.fn() } as unknown as FiscalPeriodsService;

    const service = new PaymentService(
      repo,
      orgSettingsService,
      {} as never,
      balancesService,
      periodsService,
    );

    const result = await service.applyCreditOnly(ORG_ID, USER_ID, CONTACT_ID, [
      { sourcePaymentId: SOURCE_PAYMENT_ID, receivableId: RECEIVABLE_ID, amount: 50 },
    ]);

    expect(result).toHaveProperty("correlationId");
    expect((result as unknown as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });
});
