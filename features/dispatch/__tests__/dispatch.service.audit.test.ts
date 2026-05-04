/**
 * Phase 1 + Phase 2 — setAuditContext coverage + correlationId emission
 * (correlation-id-coverage).
 *
 * Phase 1: Verifies that mutation methods on DispatchService set the audit
 * context (app.current_user_id / app.current_organization_id) as the FIRST
 * statement inside the tx callback.
 *
 * Phase 2: Verifies that each mutation method returns a result containing a
 * non-null correlationId (UUID v4), and that setAuditContext is called with
 * that exact correlationId as the 5th argument (via withAuditTx).
 *
 * Sites covered in this file:
 *   B1  — DispatchService.post()            (Phase 1 — new wiring in PR)
 *   B2  — DispatchService.recreate()        (Phase 1 — new wiring in PR)
 *   D18 — DispatchService.createAndPost()   (Phase 2)
 *   D19 — DispatchService.update() LOCKED   (Phase 2)
 *   D20 — DispatchService.updatePostedDispatchTx() via update() POSTED (Phase 2)
 *   D21 — DispatchService.post()            (Phase 2)
 *   D22 — DispatchService.void()            (Phase 2)
 *   D23 — DispatchService.recreate()        (Phase 2)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as auditCtx from "@/features/shared/audit-context";
import { DispatchService } from "../dispatch.service";
import type { DispatchRepository } from "../dispatch.repository";
import type { OrgSettingsService } from "@/modules/org-settings/presentation/server";
import type { ReceivablesRepository } from "@/features/receivables/server";
import type { AccountBalancesService } from "@/features/account-balances/server";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { DispatchWithDetails } from "../dispatch.types";
import type { Prisma } from "@/generated/prisma/client";

const ORG_ID = "org-audit-disp";
const DISPATCH_ID = "disp-audit-001";
const PERIOD_ID = "period-audit-001";
const USER_ID = "user-audit-001";
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

function makeLockedDispatch(): DispatchWithDetails {
  return {
    ...makePostedDispatch(),
    status: "LOCKED",
    createdById: USER_ID,
  } as unknown as DispatchWithDetails;
}

function makeFakeTx(): Prisma.TransactionClient {
  return {
    $executeRawUnsafe: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ user_id: USER_ID }]),
    paymentAllocation: {
      findMany: vi.fn().mockResolvedValue([]),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    accountsReceivable: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue({ paid: 0 }),
      update: vi.fn().mockResolvedValue({}),
    },
    journalEntry: {
      findFirst: vi.fn().mockResolvedValue({
        id: "entry-001",
        organizationId: ORG_ID,
        lines: [],
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    journalLine: {
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    dispatch: {
      update: vi.fn().mockResolvedValue(makeLockedDispatch()),
    },
  } as unknown as Prisma.TransactionClient;
}

function buildService(initial: DispatchWithDetails) {
  let current = initial;
  const fakeTx = makeFakeTx();

  const repo = {
    findById: vi.fn(async () => current),
    transaction: vi.fn(
      async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) => fn(fakeTx),
    ),
    getNextSequenceNumber: vi.fn().mockResolvedValue(1),
    updateStatusTx: vi.fn().mockImplementation(async (_tx: unknown, _orgId: string, _id: string, status: string) => {
      current = { ...current, status } as DispatchWithDetails;
      return undefined;
    }),
    linkJournalAndReceivable: vi.fn().mockResolvedValue(undefined),
    cloneToDraft: vi.fn().mockResolvedValue({ id: "new-draft-id" }),
    createPostedTx: vi.fn().mockResolvedValue({ ...initial, id: DISPATCH_ID }),
    updateTx: vi.fn().mockResolvedValue(initial),
  } as unknown as DispatchRepository;

  const orgSettingsService = {
    getOrCreate: vi.fn().mockResolvedValue({
      toSnapshot: () => ({
        cxcAccountCode: "1.1.2",
        roundingThreshold: 0,
      }),
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

  const accountsRepo = {
    findByCode: vi.fn().mockResolvedValue({ id: "acc-1", isActive: true, isDetail: true }),
  };

  const contactsService = {
    getActiveById: vi.fn().mockResolvedValue({
      id: "contact-disp-001",
      name: "Cliente Test",
      type: "CLIENTE",
      paymentTermsDays: 30,
    }),
  };

  // Cast around the optional injection signature.
  const service = new DispatchService(
    repo,
    orgSettingsService,
    autoEntryGenerator as never,
    contactsService as never,
    receivablesRepo,
    balancesService,
    periodsService,
    accountsRepo as never,
  );

  return { service, repo, autoEntryGenerator, fakeTx };
}

// ── Phase 1: B1/B2 with updated 5-arg assertions ───────────────────────────────

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
  it("B1: post() calls setAuditContext FIRST inside the tx with (tx, userId, orgId, ...)", async () => {
    const { service, autoEntryGenerator } = buildService(makePostedDraft());

    await service.post(ORG_ID, DISPATCH_ID, USER_ID);

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx calls setAuditContext with 5 args
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    // Order: setAuditContext must run BEFORE the auto entry generator
    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const generateOrder = (autoEntryGenerator.generate as unknown as ReturnType<typeof vi.fn>)
      .mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(generateOrder);
  });

  // ── B2: recreate() ─────────────────────────────────────────────────────────
  it("B2: recreate() calls setAuditContext FIRST inside the tx with (tx, userId, orgId, ...)", async () => {
    const { service, repo } = buildService(makePostedDispatch());

    await service.recreate(ORG_ID, DISPATCH_ID, USER_ID);

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx calls setAuditContext with 5 args
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    // Order: setAuditContext must run BEFORE updateStatusTx
    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const updateStatusOrder = (
      repo.updateStatusTx as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(updateStatusOrder);
  });
});

// ── Phase 2: D18-D23 ───────────────────────────────────────────────────────────

describe("DispatchService — Phase 2 correlationId emission", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setAuditContextSpy = vi.spyOn(auditCtx, "setAuditContext").mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── D18: createAndPost() ───────────────────────────────────────────────────
  it("D18: createAndPost() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedDraft());

    const result = await service.createAndPost(
      ORG_ID,
      {
        contactId: "contact-disp-001",
        dispatchType: "NOTA_DESPACHO",
        description: "Despacho test",
        date: new Date("2025-03-15"),
        periodId: PERIOD_ID,
        details: [{ productTypeId: "p1", grossWeight: 100, boxes: 2, unitPrice: 10, description: "línea" }],
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

  // ── D19: update() LOCKED branch ────────────────────────────────────────────
  it("D19: update() LOCKED branch returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makeLockedDispatch());

    const result = await service.update(
      ORG_ID,
      DISPATCH_ID,
      { description: "editado locked" },
      "admin",
      "justificacion valida",
      USER_ID,
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D20: update() POSTED branch (updatePostedDispatchTx) ───────────────────
  it("D20: update() POSTED branch (updatePostedDispatchTx) returns result with UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedDispatch());

    const result = await service.update(
      ORG_ID,
      DISPATCH_ID,
      { description: "editado posted" },
      undefined,
      undefined,
      USER_ID,
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D21: post() ───────────────────────────────────────────────────────────
  it("D21: post() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedDraft());

    const result = await service.post(ORG_ID, DISPATCH_ID, USER_ID);

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

  // ── D22: void() ───────────────────────────────────────────────────────────
  it("D22: void() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedDispatch());

    const result = await service.void(ORG_ID, DISPATCH_ID, USER_ID);

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── D23: recreate() ───────────────────────────────────────────────────────
  it("D23: recreate() returns a result with a UUID v4 correlationId", async () => {
    const { service } = buildService(makePostedDispatch());

    const result = await service.recreate(ORG_ID, DISPATCH_ID, USER_ID);

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);
  });

  // ── W-1.a: update() DRAFT branch ──────────────────────────────────────────
  it("W-1.a: update() DRAFT branch calls setAuditContext with the returned correlationId (REQ-CORR.2)", async () => {
    const { service } = buildService(makePostedDraft()); // status = DRAFT

    const result = await service.update(
      ORG_ID,
      DISPATCH_ID,
      { description: "editado draft" },
      undefined,
      undefined,
      USER_ID,
    );

    expect(result).toHaveProperty("correlationId");
    const cid = (result as { correlationId: string }).correlationId;
    expect(cid).toMatch(UUID_V4_REGEX);

    // The REAL invariant: setAuditContext must have been called with the exact
    // correlationId that was returned — proving withAuditTx was used, not a
    // fabricated crypto.randomUUID() AFTER the fact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined, // no justification for DRAFT
      cid,
    );
  });
});
