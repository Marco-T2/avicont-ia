/**
 * Phase 1 + Phase 2 — setAuditContext coverage + correlationId emission
 * (correlation-id-coverage).
 *
 * Phase 1: Verifies that mutation methods on JournalService call setAuditContext
 * as the FIRST statement inside the tx callback.
 *
 * Phase 2: Verifies that each mutation method returns a result containing a
 * non-null correlationId (UUID v4), and that setAuditContext is called with
 * that exact correlationId as the 5th argument (via withAuditTx).
 *
 * Sites covered in this file:
 *   B5  — JournalService.updateEntry() DRAFT branch (Phase 1)
 *   D1  — JournalService.createAndPost()              (Phase 2)
 *   D2  — JournalService.updateEntry() LOCKED branch  (Phase 2)
 *   D3  — JournalService.updateEntry() DRAFT branch   (Phase 2)
 *   D4  — JournalService.updatePostedManualEntryTx()  (Phase 2)
 *   D5  — JournalService.transitionStatus()           (Phase 2)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as auditCtx from "@/features/shared/audit-context";
import * as permissions from "@/features/permissions/server";
import { JournalService } from "../journal.service";
import type { JournalRepository } from "../journal.repository";
import type { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import type { AccountBalancesService } from "@/features/account-balances/server";
import type { VoucherTypesService } from "@/modules/voucher-types/presentation/server";
import type { JournalEntryWithLines } from "../journal.types";
import type { Prisma } from "@/generated/prisma/client";

const ORG_ID = "org-audit-journal";
const ENTRY_ID = "je-audit-001";
const PERIOD_ID = "period-audit-001";
const USER_ID = "user-audit-001";
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeDraftEntry(): JournalEntryWithLines {
  return {
    id: ENTRY_ID,
    organizationId: ORG_ID,
    status: "DRAFT",
    sourceType: null,
    sourceId: null,
    number: 1,
    date: new Date("2025-03-15"),
    description: "Asiento DRAFT",
    periodId: PERIOD_ID,
    voucherTypeId: "vt-001",
    referenceNumber: null,
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    lines: [],
  } as unknown as JournalEntryWithLines;
}

function makeLockedEntry(): JournalEntryWithLines {
  return {
    ...makeDraftEntry(),
    status: "LOCKED",
  } as unknown as JournalEntryWithLines;
}

function makePostedEntry(): JournalEntryWithLines {
  return {
    ...makeDraftEntry(),
    status: "POSTED",
    sourceType: null, // manual entry — eligible for updatePostedManualEntryTx
    lines: [
      { id: "l1", debit: 100, credit: 0, accountId: "acc-1" },
      { id: "l2", debit: 0, credit: 100, accountId: "acc-2" },
    ],
  } as unknown as JournalEntryWithLines;
}

function makeBasicRepo(entry: JournalEntryWithLines): JournalRepository {
  return {
    findById: vi.fn().mockResolvedValue(entry),
    transaction: vi.fn(
      async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
        fn({} as Prisma.TransactionClient),
    ),
    update: vi.fn().mockResolvedValue(entry),
    updateTx: vi.fn().mockResolvedValue(entry),
    createWithRetryTx: vi.fn().mockResolvedValue({ ...entry, status: "DRAFT" }),
    updateStatusTx: vi.fn().mockResolvedValue({ ...entry, status: "POSTED" }),
  } as unknown as JournalRepository;
}

function makePeriodsService(status = "OPEN"): ReturnType<typeof makeFiscalPeriodsService> {
  return {
    getById: vi.fn().mockResolvedValue({ id: PERIOD_ID, isOpen: () => status === "OPEN", status: { value: status } }),
    list: vi.fn(),
  } as unknown as ReturnType<typeof makeFiscalPeriodsService>;
}

function makeBalancesService(): AccountBalancesService {
  return {
    applyPost: vi.fn().mockResolvedValue(undefined),
    applyVoid: vi.fn().mockResolvedValue(undefined),
  } as unknown as AccountBalancesService;
}

function makeVoucherTypesService(): VoucherTypesService {
  return {
    getById: vi.fn().mockResolvedValue({ id: "vt-001", code: "M", name: "Manual" }),
    findByCode: vi.fn().mockResolvedValue({ id: "vt-001", code: "M", name: "Manual" }),
  } as unknown as VoucherTypesService;
}

// ── Phase 1 ────────────────────────────────────────────────────────────────────

describe("JournalService — Phase 1 setAuditContext coverage", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setAuditContextSpy = vi
      .spyOn(auditCtx, "setAuditContext")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── B5: updateEntry() DRAFT branch ─────────────────────────────────────────
  it("B5: updateEntry() DRAFT branch calls setAuditContext FIRST inside the tx with (tx, userId, orgId)", async () => {
    const draft = makeDraftEntry();
    const repo = makeBasicRepo(draft);
    const periodsService = makePeriodsService();
    const service = new JournalService(repo, undefined, undefined, periodsService);

    await service.updateEntry(
      ORG_ID,
      ENTRY_ID,
      { description: "edited", updatedById: USER_ID },
    );

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    // Phase 2: withAuditTx invokes setAuditContext with 5 args
    // (tx, userId, orgId, justification|undefined, correlationId).
    // Phase 1 contract — userId + orgId in slots 2/3 — remains intact.
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      expect.any(String),
    );

    // Order: setAuditContext must run BEFORE the repo write (updateTx).
    const auditOrder = setAuditContextSpy.mock.invocationCallOrder[0];
    const updateTxOrder = (
      repo.updateTx as unknown as ReturnType<typeof vi.fn>
    ).mock.invocationCallOrder[0];
    expect(auditOrder).toBeLessThan(updateTxOrder);

    // Sanity: the legacy bare update() must NOT be called on the DRAFT branch.
    expect(repo.update).not.toHaveBeenCalled();
  });
});

// ── Phase 2 ────────────────────────────────────────────────────────────────────

describe("JournalService — Phase 2 correlationId emission", () => {
  let setAuditContextSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    setAuditContextSpy = vi
      .spyOn(auditCtx, "setAuditContext")
      .mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── D1: createAndPost() ────────────────────────────────────────────────────
  it("D1: createAndPost() returns a result with a UUID v4 correlationId, and setAuditContext receives it as 5th arg", async () => {
    const draft = makeDraftEntry();
    const posted = { ...draft, status: "POSTED" } as JournalEntryWithLines;
    const repo: JournalRepository = {
      findById: vi.fn().mockResolvedValue(draft),
      transaction: vi.fn(
        async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
          fn({} as Prisma.TransactionClient),
      ),
      createWithRetryTx: vi.fn().mockResolvedValue(draft),
      updateStatusTx: vi.fn().mockResolvedValue(posted),
    } as unknown as JournalRepository;
    const balancesService = makeBalancesService();
    const periodsService = makePeriodsService();
    const voucherTypesService = makeVoucherTypesService();
    const accountsRepo = {
      findById: vi.fn().mockResolvedValue({ id: "acc-1", isActive: true, isDetail: true, requiresContact: false }),
    };

    // Mock canPost to allow posting (bypass RBAC for unit test)
    vi.spyOn(permissions, "canPost").mockResolvedValue(true);

    const service = new JournalService(
      repo,
      accountsRepo as never,
      balancesService,
      periodsService,
      voucherTypesService,
    );

    const result = await service.createAndPost(
      ORG_ID,
      {
        description: "Asiento test",
        date: new Date("2025-03-15T00:00:00Z"),
        periodId: PERIOD_ID,
        voucherTypeId: "vt-001",
        referenceNumber: 1,
        createdById: USER_ID,
        lines: [
          { accountId: "acc-1", debit: 100, credit: 0, order: 0 },
          { accountId: "acc-2", debit: 0, credit: 100, order: 1 },
        ],
      },
      { userId: USER_ID, role: "admin" },
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);

    const capturedCorrelationId = (result as { correlationId: string }).correlationId;
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      capturedCorrelationId,
    );
  });

  // ── D2: updateEntry() LOCKED branch ────────────────────────────────────────
  it("D2: updateEntry() LOCKED branch returns a result with a UUID v4 correlationId", async () => {
    const locked = makeLockedEntry();
    const repo = makeBasicRepo(locked);
    const periodsService = makePeriodsService();
    const service = new JournalService(repo, undefined, undefined, periodsService);

    const result = await service.updateEntry(
      ORG_ID,
      ENTRY_ID,
      { description: "edited locked", updatedById: USER_ID },
      "admin",
      "justificacion valida para locked",
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);

    const capturedCorrelationId = (result as { correlationId: string }).correlationId;
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      "justificacion valida para locked",
      capturedCorrelationId,
    );
  });

  // ── D3: updateEntry() DRAFT branch ─────────────────────────────────────────
  it("D3: updateEntry() DRAFT branch returns a result with a UUID v4 correlationId", async () => {
    const draft = makeDraftEntry();
    const repo = makeBasicRepo(draft);
    const periodsService = makePeriodsService();
    const service = new JournalService(repo, undefined, undefined, periodsService);

    const result = await service.updateEntry(
      ORG_ID,
      ENTRY_ID,
      { description: "edited draft", updatedById: USER_ID },
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);

    const capturedCorrelationId = (result as { correlationId: string }).correlationId;
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      capturedCorrelationId,
    );
  });

  // ── D4: updatePostedManualEntryTx() (via POSTED branch of updateEntry) ──────
  it("D4: updateEntry() POSTED branch (updatePostedManualEntryTx) returns result with UUID v4 correlationId", async () => {
    const posted = makePostedEntry();
    const updated = { ...posted, description: "edited posted" } as JournalEntryWithLines;
    const repo: JournalRepository = {
      findById: vi.fn().mockResolvedValue(posted),
      transaction: vi.fn(
        async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
          fn({} as Prisma.TransactionClient),
      ),
      updateTx: vi.fn().mockResolvedValue(updated),
    } as unknown as JournalRepository;
    const balancesService = makeBalancesService();
    const periodsService = makePeriodsService();

    const service = new JournalService(repo, undefined, balancesService, periodsService);

    const result = await service.updateEntry(
      ORG_ID,
      ENTRY_ID,
      { description: "edited posted", updatedById: USER_ID },
    );

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);

    const capturedCorrelationId = (result as { correlationId: string }).correlationId;
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      capturedCorrelationId,
    );
  });

  // ── D5: transitionStatus() ─────────────────────────────────────────────────
  it("D5: transitionStatus() returns result with UUID v4 correlationId, setAuditContext receives it", async () => {
    const draft = makeDraftEntry();
    const posted = { ...draft, status: "POSTED" } as JournalEntryWithLines;
    const repo: JournalRepository = {
      findById: vi.fn().mockResolvedValue(draft),
      transaction: vi.fn(
        async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
          fn({} as Prisma.TransactionClient),
      ),
      updateStatusTx: vi.fn().mockResolvedValue(posted),
    } as unknown as JournalRepository;
    const balancesService = makeBalancesService();
    const periodsService = makePeriodsService();

    const service = new JournalService(repo, undefined, balancesService, periodsService);

    const result = await service.transitionStatus(ORG_ID, ENTRY_ID, "POSTED", USER_ID);

    expect(result).toHaveProperty("correlationId");
    expect((result as { correlationId: string }).correlationId).toMatch(UUID_V4_REGEX);

    const capturedCorrelationId = (result as { correlationId: string }).correlationId;
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
      undefined,
      capturedCorrelationId,
    );
  });
});
