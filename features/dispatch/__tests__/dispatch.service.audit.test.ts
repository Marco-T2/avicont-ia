/**
 * Phase 1 — setAuditContext coverage (correlation-id-coverage).
 *
 * Verifies that mutation methods on DispatchService set the audit context
 * (app.current_user_id / app.current_organization_id) as the FIRST statement
 * inside the tx callback. This is the wiring that lets the `audit_trigger_fn`
 * Postgres trigger emit `changedById` non-null when a row is mutated.
 *
 * Approach: spy on `setAuditContext` from `@/features/shared/audit-context`,
 * mock all collaborator dependencies enough to reach the tx callback.
 *
 * Sites covered in this file:
 *   B1 — DispatchService.post()       (new wiring in this PR)
 *   B2 — DispatchService.recreate()   (new wiring in this PR)
 *
 * Phase 2 (correlationId / WithCorrelation) is OUT OF SCOPE here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as auditCtx from "@/features/shared/audit-context";
import { DispatchService } from "../dispatch.service";
import type { DispatchRepository } from "../dispatch.repository";
import type { OrgSettingsService } from "@/features/org-settings/server";
import type { ReceivablesRepository } from "@/features/receivables/server";
import type { AccountBalancesService } from "@/features/account-balances/server";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { DispatchWithDetails } from "../dispatch.types";
import type { Prisma } from "@/generated/prisma/client";

const ORG_ID = "org-audit-disp";
const DISPATCH_ID = "disp-audit-001";
const PERIOD_ID = "period-audit-001";
const USER_ID = "user-audit-001";

function makePostedDraft(): DispatchWithDetails {
  return {
    id: DISPATCH_ID,
    organizationId: ORG_ID,
    sequenceNumber: null,
    dispatchType: "NOTA_DESPACHO",
    status: "DRAFT",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: "contact-disp-001",
    description: "Despacho a contabilizar",
    notes: null,
    referenceNumber: null,
    journalEntryId: null,
    receivableId: null,
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    totalAmount: 0,
    displayCode: null,
    contact: {
      id: "contact-disp-001",
      name: "Cliente Test",
      type: "CLIENTE",
      paymentTermsDays: 30,
    },
    details: [
      {
        id: "det-001",
        lineAmount: 100,
      },
    ],
    receivable: null,
  } as unknown as DispatchWithDetails;
}

function makePostedDispatch(): DispatchWithDetails {
  return {
    ...makePostedDraft(),
    status: "POSTED",
    sequenceNumber: 1,
    journalEntryId: "entry-001",
    receivableId: "recv-001",
    totalAmount: 100,
  } as unknown as DispatchWithDetails;
}

function buildService(initial: DispatchWithDetails) {
  let current = initial;

  const fakeTx = {
    paymentAllocation: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    accountsReceivable: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    journalEntry: {
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
  } as unknown as Prisma.TransactionClient;

  const repo = {
    findById: vi.fn(async () => current),
    transaction: vi.fn(
      async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(fakeTx),
    ),
    getNextSequenceNumber: vi.fn().mockResolvedValue(1),
    updateStatusTx: vi.fn().mockResolvedValue(undefined),
    linkJournalAndReceivable: vi.fn().mockResolvedValue(undefined),
    cloneToDraft: vi.fn().mockResolvedValue({ id: "new-draft-id" }),
  } as unknown as DispatchRepository;

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({
      cxcAccountCode: "1.1.2",
      roundingThreshold: 0,
    }),
  } as unknown as OrgSettingsService;

  const autoEntryGenerator = {
    generate: vi.fn().mockResolvedValue({ id: "entry-new", lines: [] }),
  };

  const receivablesRepo = {
    createTx: vi.fn().mockResolvedValue({ id: "recv-new" }),
    voidTx: vi.fn().mockResolvedValue(undefined),
  } as unknown as ReceivablesRepository;

  const balancesService = {
    applyPost: vi.fn().mockResolvedValue(undefined),
    applyVoid: vi.fn().mockResolvedValue(undefined),
  } as unknown as AccountBalancesService;

  const periodsService = {
    getById: vi.fn().mockResolvedValue({
      id: PERIOD_ID,
      status: "OPEN",
    }),
    list: vi.fn(),
  } as unknown as FiscalPeriodsService;

  // Cast around the optional injection signature.
  const service = new DispatchService(
    repo,
    orgSettingsService,
    autoEntryGenerator as never,
    undefined, // contactsService — not used on post/recreate happy paths
    receivablesRepo,
    balancesService,
    periodsService,
  );

  return { service, repo, autoEntryGenerator, fakeTx };
}

describe("DispatchService — Phase 1 setAuditContext coverage", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setAuditContextSpy = vi
      .spyOn(auditCtx, "setAuditContext")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── B1: post() ─────────────────────────────────────────────────────────────
  it("B1: post() calls setAuditContext FIRST inside the tx with (tx, userId, orgId)", async () => {
    const { service, autoEntryGenerator } = buildService(makePostedDraft());

    await service.post(ORG_ID, DISPATCH_ID, USER_ID);

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
    );

    // Order: setAuditContext must run BEFORE the auto entry generator
    // (which is the first business-logic write inside the tx callback).
    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const generateOrder = (autoEntryGenerator.generate as unknown as ReturnType<typeof vi.fn>)
      .mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(generateOrder);
  });

  // ── B2: recreate() ─────────────────────────────────────────────────────────
  it("B2: recreate() calls setAuditContext FIRST inside the tx with (tx, userId, orgId)", async () => {
    const { service, repo } = buildService(makePostedDispatch());

    await service.recreate(ORG_ID, DISPATCH_ID, USER_ID);

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
    );

    // Order: setAuditContext must run BEFORE updateStatusTx (the first
    // mutation inside voidCascadeTx, which is the first action of recreate).
    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const updateStatusOrder = (
      repo.updateStatusTx as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(updateStatusOrder);
  });
});
