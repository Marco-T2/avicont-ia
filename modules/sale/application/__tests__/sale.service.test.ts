import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "@/features/shared/errors";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Contact } from "@/modules/contacts/domain/contact.entity";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";
import type { ContactType } from "@/modules/contacts/domain/value-objects/contact-type";
import { PaymentTermsDays } from "@/modules/contacts/domain/value-objects/payment-terms-days";
import { Receivable } from "@/modules/receivables/domain/receivable.entity";
import {
  SaleContactInactive,
  SaleContactNotClient,
} from "../errors/sale-orchestration-errors";
import { Sale } from "../../domain/sale.entity";
import type { SaleStatus } from "../../domain/value-objects/sale-status";
import { SaleService } from "../sale.service";
import { InMemoryContactRepository } from "./fakes/in-memory-contact.repository";
import { InMemorySaleRepository } from "./fakes/in-memory-sale.repository";
import { InMemorySaleUnitOfWork } from "./fakes/in-memory-sale-unit-of-work";
import { InMemoryReceivableRepository } from "./fakes/in-memory-receivable.repository";

const ORG = "org-1";
const OTHER_ORG = "org-2";

function buildSale(overrides: {
  id?: string;
  organizationId?: string;
  status?: SaleStatus;
  contactId?: string;
  date?: Date;
  receivableId?: string | null;
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
    receivableId: overrides.receivableId === undefined ? null : overrides.receivableId,
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

describe("SaleService.getEditPreview", () => {
  let saleRepo: InMemorySaleRepository;
  let receivableRepo: InMemoryReceivableRepository;
  let service: SaleService;

  beforeEach(() => {
    saleRepo = new InMemorySaleRepository();
    receivableRepo = new InMemoryReceivableRepository();
    service = new SaleService(saleRepo, receivableRepo);
  });

  function buildReceivable(id: string, paid: number): Receivable {
    return Receivable.fromPersistence({
      id,
      organizationId: ORG,
      contactId: "contact-1",
      description: "CxC test",
      amount: MonetaryAmount.of(1000),
      paid: MonetaryAmount.of(paid),
      balance: MonetaryAmount.of(1000 - paid),
      dueDate: new Date("2025-02-15"),
      status: "PARTIAL",
      sourceType: "SALE",
      sourceId: "sale-1",
      journalEntryId: null,
      notes: null,
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
    });
  }

  it("returns empty trim preview when sale has no receivableId", async () => {
    saleRepo.preload(buildSale({ id: "sale-1", receivableId: null }));

    const preview = await service.getEditPreview(ORG, "sale-1", 500);

    expect(preview).toEqual({ trimPreview: [] });
  });

  it("throws NotFoundError when sale does not exist", async () => {
    await expect(
      service.getEditPreview(ORG, "missing", 500),
    ).rejects.toThrow(NotFoundError);
  });

  it("returns empty trim preview when newTotal >= paid", async () => {
    saleRepo.preload(buildSale({ id: "sale-1", receivableId: "r-1" }));
    receivableRepo.preloadReceivable(buildReceivable("r-1", 300));
    receivableRepo.preloadAllocations("r-1", [
      { id: "a1", amount: 200, payment: { date: new Date("2025-02-01") } },
    ]);

    const preview = await service.getEditPreview(ORG, "sale-1", 400);

    expect(preview).toEqual({ trimPreview: [] });
  });

  it("returns empty trim preview when receivable not found (paid treated as 0)", async () => {
    saleRepo.preload(buildSale({ id: "sale-1", receivableId: "r-missing" }));

    const preview = await service.getEditPreview(ORG, "sale-1", 500);

    expect(preview).toEqual({ trimPreview: [] });
  });

  it("trims allocations LIFO when newTotal < paid", async () => {
    saleRepo.preload(buildSale({ id: "sale-1", receivableId: "r-1" }));
    receivableRepo.preloadReceivable(buildReceivable("r-1", 500));
    receivableRepo.preloadAllocations("r-1", [
      { id: "a-newest", amount: 200, payment: { date: new Date("2025-03-01") } },
      { id: "a-mid", amount: 150, payment: { date: new Date("2025-02-01") } },
      { id: "a-oldest", amount: 150, payment: { date: new Date("2025-01-01") } },
    ]);

    const preview = await service.getEditPreview(ORG, "sale-1", 200);

    expect(preview.trimPreview).toEqual([
      {
        allocationId: "a-newest",
        paymentDate: "2025-03-01",
        originalAmount: "200.00",
        trimmedTo: "0.00",
      },
      {
        allocationId: "a-mid",
        paymentDate: "2025-02-01",
        originalAmount: "150.00",
        trimmedTo: "50.00",
      },
    ]);
  });

  it("propagates NotFoundError for sale in different org", async () => {
    saleRepo.preload(
      buildSale({ id: "sale-1", organizationId: OTHER_ORG, receivableId: "r-1" }),
    );

    await expect(
      service.getEditPreview(ORG, "sale-1", 100),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("SaleService.createDraft", () => {
  let saleRepo: InMemorySaleRepository;
  let contactRepo: InMemoryContactRepository;
  let uow: InMemorySaleUnitOfWork;
  let service: SaleService;

  beforeEach(() => {
    saleRepo = new InMemorySaleRepository();
    contactRepo = new InMemoryContactRepository();
    uow = new InMemorySaleUnitOfWork({ sales: saleRepo });
    service = new SaleService(saleRepo, undefined, contactRepo, uow);
  });

  function buildContact(overrides: {
    id?: string;
    type?: ContactType;
    isActive?: boolean;
  } = {}): Contact {
    return Contact.fromPersistence({
      id: overrides.id ?? "c-1",
      organizationId: ORG,
      type: overrides.type ?? "CLIENTE",
      name: "Cliente Test",
      nit: null,
      email: null,
      phone: null,
      address: null,
      paymentTermsDays: PaymentTermsDays.of(30),
      creditLimit: null,
      isActive: overrides.isActive ?? true,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    });
  }

  const draftInput = {
    contactId: "c-1",
    periodId: "period-1",
    date: new Date("2025-01-15"),
    description: "Venta a Cliente Test",
    details: [
      {
        description: "Línea 1",
        lineAmount: MonetaryAmount.of(100),
        incomeAccountId: "acc-income-1",
      },
    ],
  };

  it("persists a DRAFT sale and returns the aggregate + correlationId", async () => {
    contactRepo.preload(buildContact());
    uow.nextCorrelationId = "corr-fixed-42";

    const result = await service.createDraft(ORG, draftInput, "user-1");

    expect(result.correlationId).toBe("corr-fixed-42");
    expect(result.sale.status).toBe("DRAFT");
    expect(result.sale.organizationId).toBe(ORG);
    expect(result.sale.contactId).toBe("c-1");
    expect(result.sale.createdById).toBe("user-1");
    expect(result.sale.totalAmount.value).toBe(100);
    expect(result.sale.details).toHaveLength(1);
    expect(saleRepo.saveTxCalls).toHaveLength(1);
    expect(saleRepo.saveTxCalls[0]!.id).toBe(result.sale.id);
  });

  it("invokes the UoW with the AuditContext (userId + organizationId)", async () => {
    contactRepo.preload(buildContact());

    await service.createDraft(ORG, draftInput, "user-42");

    expect(uow.ranContexts).toEqual([
      { userId: "user-42", organizationId: ORG },
    ]);
  });

  it("throws ContactNotFound when contact does not exist", async () => {
    await expect(
      service.createDraft(ORG, draftInput, "user-1"),
    ).rejects.toThrow(ContactNotFound);

    expect(saleRepo.saveTxCalls).toEqual([]);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws SaleContactInactive when contact exists but is inactive", async () => {
    contactRepo.preload(buildContact({ isActive: false }));

    await expect(
      service.createDraft(ORG, draftInput, "user-1"),
    ).rejects.toThrow(SaleContactInactive);

    expect(saleRepo.saveTxCalls).toEqual([]);
  });

  it("throws SaleContactNotClient when contact type is not CLIENTE", async () => {
    contactRepo.preload(buildContact({ type: "PROVEEDOR" }));

    await expect(
      service.createDraft(ORG, draftInput, "user-1"),
    ).rejects.toThrow(SaleContactNotClient);

    expect(saleRepo.saveTxCalls).toEqual([]);
  });

  it("does not open the UoW when contact validation fails", async () => {
    contactRepo.preload(buildContact({ isActive: false }));

    await service
      .createDraft(ORG, draftInput, "user-1")
      .catch(() => undefined);

    expect(uow.ranContexts).toEqual([]);
  });
});
