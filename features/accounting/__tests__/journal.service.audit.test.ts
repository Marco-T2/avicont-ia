/**
 * Phase 1 — setAuditContext coverage (correlation-id-coverage).
 *
 * Verifies that mutation methods on JournalService set the audit context
 * (app.current_user_id / app.current_organization_id) as the FIRST statement
 * inside the tx callback.
 *
 * Sites covered in this file:
 *   B5 — JournalService.updateEntry() DRAFT branch (refactored from a bare
 *        repo.update() call to repo.transaction(... setAuditContext + updateTx))
 *
 * Phase 2 (correlationId / WithCorrelation) is OUT OF SCOPE here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import * as auditCtx from "@/features/shared/audit-context";
import { JournalService } from "../journal.service";
import type { JournalRepository } from "../journal.repository";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { JournalEntryWithLines } from "../journal.types";
import type { Prisma } from "@/generated/prisma/client";

const ORG_ID = "org-audit-journal";
const ENTRY_ID = "je-audit-001";
const PERIOD_ID = "period-audit-001";
const USER_ID = "user-audit-001";

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

    const repo = {
      findById: vi.fn().mockResolvedValue(draft),
      transaction: vi.fn(
        async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>) =>
          fn({} as Prisma.TransactionClient),
      ),
      update: vi.fn().mockResolvedValue(draft),
      updateTx: vi.fn().mockResolvedValue(draft),
    } as unknown as JournalRepository;

    const periodsService = {
      getById: vi.fn().mockResolvedValue({ id: PERIOD_ID, status: "OPEN" }),
      list: vi.fn(),
    } as unknown as FiscalPeriodsService;

    const service = new JournalService(repo, undefined, undefined, periodsService);

    await service.updateEntry(
      ORG_ID,
      ENTRY_ID,
      { description: "edited", updatedById: USER_ID },
    );

    expect(setAuditContextSpy).toHaveBeenCalledTimes(1);
    expect(setAuditContextSpy).toHaveBeenCalledWith(
      expect.any(Object),
      USER_ID,
      ORG_ID,
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
