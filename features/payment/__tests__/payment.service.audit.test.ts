/**
 * Phase 1 — setAuditContext coverage (correlation-id-coverage).
 *
 * Verifies that mutation methods on PaymentService set the audit context
 * (app.current_user_id / app.current_organization_id) as the FIRST statement
 * inside the tx callback.
 *
 * Approach: spy on `setAuditContext` from `@/features/shared/audit-context`,
 * mock collaborator dependencies enough to reach the tx callback.
 *
 * Sites covered in this file:
 *   B3 — PaymentService.post()
 *   B4 — PaymentService.applyCreditOnly()
 *
 * Phase 2 (correlationId / WithCorrelation) is OUT OF SCOPE here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as auditCtx from "@/features/shared/audit-context";
import { PaymentService } from "../payment.service";
import type { PaymentRepository } from "../payment.repository";
import type { OrgSettingsService } from "@/features/org-settings/server";
import type { AccountBalancesService } from "@/features/account-balances/server";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { PaymentWithRelations } from "../payment.types";
import type { Prisma } from "@/generated/prisma/client";

const ORG_ID = "org-audit-pay";
const PAYMENT_ID = "pay-audit-001";
const PERIOD_ID = "period-audit-001";
const USER_ID = "user-audit-001";
const SOURCE_PAYMENT_ID = "pay-source-001";
const RECEIVABLE_ID = "recv-001";
const CONTACT_ID = "contact-001";

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

function buildService(initial: PaymentWithRelations) {
  const fakeTx = {
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
    accountsPayable: {
      findUnique: vi.fn(),
    },
    paymentAllocation: {
      create: vi.fn().mockResolvedValue({}),
    },
    journalEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    contact: {
      findUnique: vi.fn().mockResolvedValue({ id: CONTACT_ID, type: "CLIENTE" }),
    },
  } as unknown as Prisma.TransactionClient;

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

  const service = new PaymentService(
    repo,
    orgSettingsService,
    autoEntryGenerator as never,
    balancesService,
    periodsService,
  );

  return { service, repo, autoEntryGenerator, fakeTx };
}

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
  it("B3: post() calls setAuditContext FIRST inside the tx with (tx, userId, orgId)", async () => {
    const { service, repo } = buildService(makeDraftPayment());

    await service.post(ORG_ID, PAYMENT_ID, USER_ID);

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const updateStatusOrder = (
      repo.updateStatusTx as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(updateStatusOrder);
  });

  // ── B4: applyCreditOnly() ──────────────────────────────────────────────────
  it("B4: applyCreditOnly() calls setAuditContext FIRST inside the tx with (tx, userId, orgId)", async () => {
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
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
    );

    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const updateCxCOrder = (
      repo.updateCxCPaymentTx as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(updateCxCOrder);
  });
});
