/**
 * T49 RED — LOCKED-edit enforcement in PurchaseService.update().
 *
 * Spec: REQ-A6 — justification length differentiated by period status.
 *
 * Current behavior (before T50): purchase.service.ts calls
 *   validateLockedEdit(status, role!, undefined, justification)
 * which always triggers the PERIOD_NOT_FOUND fail-safe. Tests fail.
 *
 * Target behavior (after T50): loads period via periodsService.getById and
 * passes period.status.
 *
 * All external dependencies mocked — no DB access.
 */
import { describe, it, expect, vi } from "vitest";
import { PurchaseService } from "../purchase.service";
import { LOCKED_EDIT_REQUIRES_JUSTIFICATION } from "@/features/shared/errors";
import type { PurchaseRepository } from "../purchase.repository";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { PurchaseWithDetails } from "../purchase.types";

const ORG_ID = "org-locked-edit-purchase";
const PURCHASE_ID = "purch-locked-001";
const PERIOD_ID = "period-locked-001";

function makeLockedPurchase(): PurchaseWithDetails {
  return {
    id: PURCHASE_ID,
    organizationId: ORG_ID,
    sequenceNumber: 1,
    purchaseType: "GENERAL",
    status: "LOCKED",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: "contact-purch-001",
    description: "Compra bloqueada",
    notes: null,
    referenceNumber: null,
    journalEntryId: "entry-purch-001",
    payableId: "pay-purch-001",
    createdById: "user-purch-001",
    createdAt: new Date(),
    updatedAt: new Date(),
    totalAmount: 100,
    shrinkagePct: null,
    displayCode: "CG-001",
    contact: {
      id: "contact-purch-001",
      name: "Proveedor Bloqueado",
      type: "PROVEEDOR",
      paymentTermsDays: 30,
    },
    details: [],
    payable: null,
    ivaPurchasesBook: null,
  } as unknown as PurchaseWithDetails;
}

function buildService(periodStatus: "OPEN" | "CLOSED") {
  const purchase = makeLockedPurchase();

  const mockRepo = {
    findById: vi.fn().mockResolvedValue(purchase),
  } as unknown as PurchaseRepository;

  const mockPeriodsService = {
    getById: vi.fn().mockResolvedValue({
      id: PERIOD_ID,
      status: periodStatus,
    }),
    list: vi.fn(),
  } as unknown as FiscalPeriodsService;

  const service = new PurchaseService(
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

describe("PurchaseService.update — LOCKED-edit enforcement (T49 RED)", () => {
  it("update LOCKED purchase in CLOSED period, justification < 50 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=50", async () => {
    const { service } = buildService("CLOSED");

    await expect(
      service.update(
        ORG_ID,
        PURCHASE_ID,
        { description: "edited" },
        "user-admin",
        "admin",
        "too short justification",
      ),
    ).rejects.toMatchObject({
      code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      details: { requiredMin: 50 },
    });
  });

  it("update LOCKED purchase in OPEN period, justification < 10 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=10", async () => {
    const { service } = buildService("OPEN");

    await expect(
      service.update(
        ORG_ID,
        PURCHASE_ID,
        { description: "edited" },
        "user-admin",
        "admin",
        "short",
      ),
    ).rejects.toMatchObject({
      code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      details: { requiredMin: 10 },
    });
  });
});
