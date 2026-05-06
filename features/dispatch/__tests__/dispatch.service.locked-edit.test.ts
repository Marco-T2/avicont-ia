/**
 * T41 RED — LOCKED-edit enforcement in DispatchService.update().
 *
 * Spec: REQ-A6 (audit-log/spec.md) — justification length differentiated by
 * period status: OPEN requires 10 chars, CLOSED requires 50 chars.
 *
 * Current behavior (before T42): dispatch.service.ts calls
 *   validateLockedEdit(status, role!, undefined, justification)
 * which always triggers the PERIOD_NOT_FOUND fail-safe, regardless of the
 * actual period status. Tests therefore fail.
 *
 * Target behavior (after T42): dispatch.service.ts loads the period via
 * periodsService.getById(organizationId, dispatch.periodId) and passes
 * period.status. Then:
 *   - CLOSED period: justification >= 50 chars passes; < 50 fails with
 *     LOCKED_EDIT_REQUIRES_JUSTIFICATION and requiredMin=50.
 *   - OPEN period: justification >= 10 passes; < 10 fails with requiredMin=10.
 *
 * All external dependencies mocked — no DB access.
 */
import { describe, it, expect, vi } from "vitest";
import { DispatchService } from "../dispatch.service";
import { LOCKED_EDIT_REQUIRES_JUSTIFICATION } from "@/features/shared/errors";
import type { DispatchRepository } from "../dispatch.repository";
import type { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import type { DispatchWithDetails } from "../dispatch.types";

const ORG_ID = "org-locked-edit-dispatch";
const DISPATCH_ID = "disp-locked-001";
const PERIOD_ID = "period-locked-001";

function makeLockedDispatch(): DispatchWithDetails {
  return {
    id: DISPATCH_ID,
    organizationId: ORG_ID,
    sequenceNumber: 1,
    dispatchType: "NOTA_DESPACHO",
    status: "LOCKED",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: "contact-disp-001",
    description: "Despacho bloqueado",
    notes: null,
    referenceNumber: null,
    journalEntryId: "entry-disp-001",
    receivableId: "recv-disp-001",
    createdById: "user-disp-001",
    createdAt: new Date(),
    updatedAt: new Date(),
    totalAmount: 100,
    displayCode: "ND-001",
    contact: {
      id: "contact-disp-001",
      name: "Cliente Bloqueado",
      type: "CLIENTE",
      paymentTermsDays: 30,
    },
    details: [],
    receivable: null,
  } as unknown as DispatchWithDetails;
}

function buildService(periodStatus: "OPEN" | "CLOSED") {
  const dispatch = makeLockedDispatch();

  const mockRepo = {
    findById: vi.fn().mockResolvedValue(dispatch),
  } as unknown as DispatchRepository;

  const mockPeriodsService = {
    getById: vi.fn().mockResolvedValue({
      id: PERIOD_ID,
      isOpen: () => periodStatus === "OPEN",
      status: { value: periodStatus },
    }),
    list: vi.fn(),
  } as unknown as ReturnType<typeof makeFiscalPeriodsService>;

  const service = new DispatchService(
    mockRepo,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    mockPeriodsService,
  );

  return { service, mockRepo, mockPeriodsService };
}

describe("DispatchService.update — LOCKED-edit enforcement (T41 RED)", () => {
  it("update LOCKED dispatch in CLOSED period, justification < 50 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=50", async () => {
    const { service } = buildService("CLOSED");

    await expect(
      service.update(
        ORG_ID,
        DISPATCH_ID,
        { description: "edited" },
        "admin",
        "too short justification", // 23 chars < 50
        "user-admin",
      ),
    ).rejects.toMatchObject({
      code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      details: { requiredMin: 50 },
    });
  });

  it("update LOCKED dispatch in CLOSED period, justification >= 50 chars → does NOT throw LOCKED_EDIT_REQUIRES_JUSTIFICATION", async () => {
    const { service } = buildService("CLOSED");
    const fiftyChar =
      "This justification is exactly fifty characters ok!"; // 50 chars
    expect(fiftyChar.length).toBe(50);

    // We don't care whether the update then succeeds (repo writes not mocked);
    // we assert it does NOT throw LOCKED_EDIT_REQUIRES_JUSTIFICATION.
    await expect(
      service.update(
        ORG_ID,
        DISPATCH_ID,
        { description: "edited" },
        "admin",
        fiftyChar,
        "user-admin",
      ),
    ).rejects.not.toMatchObject({ code: LOCKED_EDIT_REQUIRES_JUSTIFICATION });
  });

  it("update LOCKED dispatch in OPEN period, justification < 10 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=10", async () => {
    const { service } = buildService("OPEN");

    await expect(
      service.update(
        ORG_ID,
        DISPATCH_ID,
        { description: "edited" },
        "admin",
        "short", // 5 chars < 10
        "user-admin",
      ),
    ).rejects.toMatchObject({
      code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      details: { requiredMin: 10 },
    });
  });

  it("update LOCKED dispatch in OPEN period, justification >= 10 chars → does NOT throw LOCKED_EDIT_REQUIRES_JUSTIFICATION", async () => {
    const { service } = buildService("OPEN");

    await expect(
      service.update(
        ORG_ID,
        DISPATCH_ID,
        { description: "edited" },
        "admin",
        "ten-chars!", // 10 chars
        "user-admin",
      ),
    ).rejects.not.toMatchObject({ code: LOCKED_EDIT_REQUIRES_JUSTIFICATION });
  });
});
