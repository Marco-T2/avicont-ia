import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "@/features/shared/errors";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Sale } from "../../domain/sale.entity";
import type { SaleStatus } from "../../domain/value-objects/sale-status";
import { SaleService } from "../sale.service";
import { InMemorySaleRepository } from "./fakes/in-memory-sale.repository";

const ORG = "org-1";
const OTHER_ORG = "org-2";

function buildSale(overrides: {
  id?: string;
  organizationId?: string;
  status?: SaleStatus;
  contactId?: string;
  date?: Date;
} = {}): Sale {
  return Sale.fromPersistence({
    id: overrides.id ?? `sale-${Math.random().toString(36).slice(2, 8)}`,
    organizationId: overrides.organizationId ?? ORG,
    status: overrides.status ?? "DRAFT",
    sequenceNumber: null,
    date: overrides.date ?? new Date("2025-01-15"),
    contactId: overrides.contactId ?? "contact-1",
    periodId: "period-1",
    description: "Venta test",
    referenceNumber: null,
    notes: null,
    totalAmount: MonetaryAmount.zero(),
    journalEntryId: null,
    receivableId: null,
    createdById: "user-1",
    createdAt: new Date("2025-01-15"),
    updatedAt: new Date("2025-01-15"),
    details: [],
    receivable: null,
  });
}

describe("SaleService.getById", () => {
  let repo: InMemorySaleRepository;
  let service: SaleService;

  beforeEach(() => {
    repo = new InMemorySaleRepository();
    service = new SaleService(repo);
  });

  it("returns the sale when it exists in the org", async () => {
    const sale = buildSale({ id: "sale-1" });
    repo.preload(sale);

    const found = await service.getById(ORG, "sale-1");

    expect(found.id).toBe("sale-1");
    expect(found.organizationId).toBe(ORG);
  });

  it("throws NotFoundError when the id does not exist", async () => {
    await expect(service.getById(ORG, "missing-id")).rejects.toThrow(NotFoundError);
    await expect(service.getById(ORG, "missing-id")).rejects.toThrow("Venta");
  });

  it("throws NotFoundError when the sale exists in a different org", async () => {
    const sale = buildSale({ id: "sale-1", organizationId: OTHER_ORG });
    repo.preload(sale);

    await expect(service.getById(ORG, "sale-1")).rejects.toThrow(NotFoundError);
  });
});

describe("SaleService.list", () => {
  let repo: InMemorySaleRepository;
  let service: SaleService;

  beforeEach(() => {
    repo = new InMemorySaleRepository();
    service = new SaleService(repo);
  });

  it("returns all sales of the org with no filters", async () => {
    repo.preload(
      buildSale({ id: "s1" }),
      buildSale({ id: "s2" }),
      buildSale({ id: "s3", organizationId: OTHER_ORG }),
    );

    const sales = await service.list(ORG);

    expect(sales.map((s) => s.id).sort()).toEqual(["s1", "s2"]);
  });

  it("filters by contactId", async () => {
    repo.preload(
      buildSale({ id: "s1", contactId: "c-1" }),
      buildSale({ id: "s2", contactId: "c-2" }),
    );

    const sales = await service.list(ORG, { contactId: "c-1" });

    expect(sales).toHaveLength(1);
    expect(sales[0].id).toBe("s1");
  });

  it("filters by status", async () => {
    repo.preload(
      buildSale({ id: "s1", status: "DRAFT" }),
      buildSale({ id: "s2", status: "POSTED" }),
      buildSale({ id: "s3", status: "VOIDED" }),
    );

    const sales = await service.list(ORG, { status: "POSTED" });

    expect(sales).toHaveLength(1);
    expect(sales[0].id).toBe("s2");
  });

  it("filters by date range", async () => {
    repo.preload(
      buildSale({ id: "s1", date: new Date("2025-01-05") }),
      buildSale({ id: "s2", date: new Date("2025-01-15") }),
      buildSale({ id: "s3", date: new Date("2025-02-01") }),
    );

    const sales = await service.list(ORG, {
      dateFrom: new Date("2025-01-10"),
      dateTo: new Date("2025-01-31"),
    });

    expect(sales).toHaveLength(1);
    expect(sales[0].id).toBe("s2");
  });

  it("returns empty array when nothing matches", async () => {
    const sales = await service.list(ORG);

    expect(sales).toEqual([]);
  });
});
