import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "@/features/shared/errors";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Purchase, type PurchaseType } from "../../domain/purchase.entity";
import type { PurchaseStatus } from "../../domain/value-objects/purchase-status";
import { PurchaseService } from "../purchase.service";
import { InMemoryPurchaseRepository } from "./fakes/in-memory-purchase.repository";

const ORG = "org-1";
const OTHER_ORG = "org-2";

function buildPurchase(overrides: {
  id?: string;
  organizationId?: string;
  status?: PurchaseStatus;
  contactId?: string;
  date?: Date;
  purchaseType?: PurchaseType;
  payableId?: string | null;
} = {}): Purchase {
  return Purchase.fromPersistence({
    id: overrides.id ?? `purchase-${Math.random().toString(36).slice(2, 8)}`,
    organizationId: overrides.organizationId ?? ORG,
    purchaseType: overrides.purchaseType ?? "COMPRA_GENERAL",
    status: overrides.status ?? "DRAFT",
    sequenceNumber: null,
    date: overrides.date ?? new Date("2025-01-15"),
    contactId: overrides.contactId ?? "contact-1",
    periodId: "period-1",
    description: "Compra test",
    referenceNumber: null,
    notes: null,
    totalAmount: MonetaryAmount.zero(),
    ruta: null,
    farmOrigin: null,
    chickenCount: null,
    shrinkagePct: null,
    totalGrossKg: null,
    totalNetKg: null,
    totalShrinkKg: null,
    totalShortageKg: null,
    totalRealNetKg: null,
    journalEntryId: null,
    payableId: overrides.payableId === undefined ? null : overrides.payableId,
    createdById: "user-1",
    createdAt: new Date("2025-01-15"),
    updatedAt: new Date("2025-01-15"),
    details: [],
    payable: null,
  });
}

describe("PurchaseService.getById", () => {
  let repo: InMemoryPurchaseRepository;
  let service: PurchaseService;

  beforeEach(() => {
    repo = new InMemoryPurchaseRepository();
    service = new PurchaseService({ repo });
  });

  it("returns the purchase when it exists in the org", async () => {
    const purchase = buildPurchase({ id: "purchase-1" });
    repo.preload(purchase);

    const found = await service.getById(ORG, "purchase-1");

    expect(found.id).toBe("purchase-1");
    expect(found.organizationId).toBe(ORG);
  });

  it("throws NotFoundError when the id does not exist", async () => {
    await expect(service.getById(ORG, "missing-id")).rejects.toThrow(NotFoundError);
    await expect(service.getById(ORG, "missing-id")).rejects.toThrow("Compra");
  });

  it("throws NotFoundError when the purchase exists in a different org", async () => {
    const purchase = buildPurchase({ id: "purchase-1", organizationId: OTHER_ORG });
    repo.preload(purchase);

    await expect(service.getById(ORG, "purchase-1")).rejects.toThrow(NotFoundError);
  });
});

describe("PurchaseService.list", () => {
  let repo: InMemoryPurchaseRepository;
  let service: PurchaseService;

  beforeEach(() => {
    repo = new InMemoryPurchaseRepository();
    service = new PurchaseService({ repo });
  });

  it("returns all purchases of the org with no filters", async () => {
    repo.preload(
      buildPurchase({ id: "p1" }),
      buildPurchase({ id: "p2" }),
      buildPurchase({ id: "p3", organizationId: OTHER_ORG }),
    );

    const purchases = await service.list(ORG);

    expect(purchases.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
  });

  it("filters by contactId", async () => {
    repo.preload(
      buildPurchase({ id: "p1", contactId: "c-1" }),
      buildPurchase({ id: "p2", contactId: "c-2" }),
    );

    const purchases = await service.list(ORG, { contactId: "c-1" });

    expect(purchases).toHaveLength(1);
    expect(purchases[0].id).toBe("p1");
  });

  it("filters by status", async () => {
    repo.preload(
      buildPurchase({ id: "p1", status: "DRAFT" }),
      buildPurchase({ id: "p2", status: "POSTED" }),
      buildPurchase({ id: "p3", status: "VOIDED" }),
    );

    const purchases = await service.list(ORG, { status: "POSTED" });

    expect(purchases).toHaveLength(1);
    expect(purchases[0].id).toBe("p2");
  });

  it("filters by date range", async () => {
    repo.preload(
      buildPurchase({ id: "p1", date: new Date("2025-01-05") }),
      buildPurchase({ id: "p2", date: new Date("2025-01-15") }),
      buildPurchase({ id: "p3", date: new Date("2025-02-01") }),
    );

    const purchases = await service.list(ORG, {
      dateFrom: new Date("2025-01-10"),
      dateTo: new Date("2025-01-31"),
    });

    expect(purchases).toHaveLength(1);
    expect(purchases[0].id).toBe("p2");
  });

  it("returns empty array when nothing matches", async () => {
    const purchases = await service.list(ORG);

    expect(purchases).toEqual([]);
  });
});
