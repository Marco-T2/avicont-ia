/**
 * T43 RED — LOCKED-edit enforcement in PaymentService.update().
 *
 * Spec: REQ-A6 — justification length differentiated by period status.
 *
 * Current behavior (before T44): payment.service.ts calls
 *   validateLockedEdit(status, role, undefined, justification)
 * which always triggers the PERIOD_NOT_FOUND fail-safe. Tests fail.
 *
 * Target behavior (after T44): loads period via periodsService.getById and
 * passes period.status.
 *
 * All external dependencies mocked — no DB access.
 */
import { describe, it, expect, vi } from "vitest";
import { PaymentService } from "../payment.service";
import { LOCKED_EDIT_REQUIRES_JUSTIFICATION } from "@/features/shared/errors";
import type { PaymentRepository } from "../payment.repository";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { PaymentWithRelations } from "../payment.types";

const ORG_ID = "org-locked-edit-payment";
const PAYMENT_ID = "pay-locked-001";
const PERIOD_ID = "period-locked-001";

function makeLockedPayment(): PaymentWithRelations {
  return {
    id: PAYMENT_ID,
    organizationId: ORG_ID,
    status: "LOCKED",
    method: "EFECTIVO",
    direction: "COBRO",
    date: new Date("2025-03-15"),
    amount: 100,
    description: "Pago bloqueado",
    periodId: PERIOD_ID,
    contactId: "contact-pay-001",
    referenceNumber: null,
    journalEntryId: "entry-pay-001",
    operationalDocTypeId: null,
    notes: null,
    createdById: "user-pay-001",
    createdAt: new Date(),
    updatedAt: new Date(),
    contact: {
      id: "contact-pay-001",
      name: "Cliente Bloqueado",
      type: "CLIENTE",
    },
    period: { id: PERIOD_ID, status: "CLOSED" },
    journalEntry: null,
    operationalDocType: null,
    allocations: [],
  } as unknown as PaymentWithRelations;
}

function buildService(periodStatus: "OPEN" | "CLOSED") {
  const payment = makeLockedPayment();

  const mockRepo = {
    findById: vi.fn().mockResolvedValue(payment),
  } as unknown as PaymentRepository;

  const mockPeriodsService = {
    getById: vi.fn().mockResolvedValue({
      id: PERIOD_ID,
      status: periodStatus,
    }),
    list: vi.fn(),
  } as unknown as FiscalPeriodsService;

  const service = new PaymentService(
    mockRepo,
    undefined,
    undefined,
    undefined,
    mockPeriodsService,
  );

  return { service, mockRepo, mockPeriodsService };
}

describe("PaymentService.update — LOCKED-edit enforcement (T43 RED)", () => {
  it("update LOCKED payment in CLOSED period, justification < 50 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=50", async () => {
    const { service } = buildService("CLOSED");

    await expect(
      service.update(
        ORG_ID,
        PAYMENT_ID,
        { description: "edited" },
        "admin",
        "too short justification",
        "user-admin",
      ),
    ).rejects.toMatchObject({
      code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      details: { requiredMin: 50 },
    });
  });

  it("update LOCKED payment in OPEN period, justification < 10 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=10", async () => {
    const { service } = buildService("OPEN");

    await expect(
      service.update(
        ORG_ID,
        PAYMENT_ID,
        { description: "edited" },
        "admin",
        "short",
        "user-admin",
      ),
    ).rejects.toMatchObject({
      code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
      details: { requiredMin: 10 },
    });
  });
});
