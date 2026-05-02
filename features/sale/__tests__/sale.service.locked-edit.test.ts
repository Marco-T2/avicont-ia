/**
 * T47 RED — LOCKED-edit enforcement in SaleService.update().
 *
 * Spec: REQ-A6 — justification length differentiated by period status.
 *
 * Current behavior (before T48): sale.service.ts calls
 *   validateLockedEdit(status, role!, undefined, justification)
 * which always triggers the PERIOD_NOT_FOUND fail-safe. Tests fail.
 *
 * Target behavior (after T48): loads period via periodsService.getById and
 * passes period.status.
 *
 * All external dependencies mocked — no DB access.
 */
import { describe, it, expect, vi } from "vitest";
import { SaleService } from "../sale.service";
import { LOCKED_EDIT_REQUIRES_JUSTIFICATION } from "@/features/shared/errors";
import type { SaleRepository } from "../sale.repository";
import type { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { SaleWithDetails } from "@/modules/sale/presentation/dto/sale-with-details";

const ORG_ID = "org-locked-edit-sale";
const SALE_ID = "sale-locked-001";
const PERIOD_ID = "period-locked-001";

function makeLockedSale(): SaleWithDetails {
  return {
    id: SALE_ID,
    organizationId: ORG_ID,
    sequenceNumber: 1,
    status: "LOCKED",
    date: new Date("2025-03-15"),
    periodId: PERIOD_ID,
    contactId: "contact-sale-001",
    description: "Venta bloqueada",
    notes: null,
    referenceNumber: null,
    journalEntryId: "entry-sale-001",
    receivableId: "recv-sale-001",
    createdById: "user-sale-001",
    createdAt: new Date(),
    updatedAt: new Date(),
    totalAmount: 100,
    displayCode: "VG-001",
    contact: {
      id: "contact-sale-001",
      name: "Cliente Bloqueado",
      type: "CLIENTE",
      paymentTermsDays: 30,
    },
    period: { id: PERIOD_ID, name: "Enero 2025", status: "CLOSED" },
    details: [],
    receivable: null,
    ivaSalesBook: null,
  } as unknown as SaleWithDetails;
}

function buildService(periodStatus: "OPEN" | "CLOSED") {
  const sale = makeLockedSale();

  const mockRepo = {
    findById: vi.fn().mockResolvedValue(sale),
  } as unknown as SaleRepository;

  const mockPeriodsService = {
    getById: vi.fn().mockResolvedValue({
      id: PERIOD_ID,
      status: periodStatus,
    }),
    list: vi.fn(),
  } as unknown as FiscalPeriodsService;

  const service = new SaleService(
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

describe("SaleService.update — LOCKED-edit enforcement (T47 RED)", () => {
  it("update LOCKED sale in CLOSED period, justification < 50 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=50", async () => {
    const { service } = buildService("CLOSED");

    await expect(
      service.update(
        ORG_ID,
        SALE_ID,
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

  it("update LOCKED sale in OPEN period, justification < 10 chars → LOCKED_EDIT_REQUIRES_JUSTIFICATION with requiredMin=10", async () => {
    const { service } = buildService("OPEN");

    await expect(
      service.update(
        ORG_ID,
        SALE_ID,
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
