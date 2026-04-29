import { beforeEach, describe, expect, it } from "vitest";
import { ForbiddenError, NotFoundError } from "@/features/shared/errors";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Contact } from "@/modules/contacts/domain/contact.entity";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";
import type { ContactType } from "@/modules/contacts/domain/value-objects/contact-type";
import { PaymentTermsDays } from "@/modules/contacts/domain/value-objects/payment-terms-days";
import { Receivable } from "@/modules/receivables/domain/receivable.entity";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { OrgSettings } from "@/modules/org-settings/domain/org-settings.entity";
import {
  SaleAccountNotFound,
  SaleContactInactive,
  SaleContactNotClient,
  SaleLockedEditMissingJustification,
  SalePeriodClosed,
  SalePostNotAllowedForRole,
} from "../errors/sale-orchestration-errors";
import { SaleVoidedImmutable } from "../../domain/errors/sale-errors";
import { Sale } from "../../domain/sale.entity";
import type { SaleStatus } from "../../domain/value-objects/sale-status";
import { SaleService } from "../sale.service";
import { InMemoryContactRepository } from "./fakes/in-memory-contact.repository";
import { InMemorySaleRepository } from "./fakes/in-memory-sale.repository";
import { InMemorySaleUnitOfWork } from "./fakes/in-memory-sale-unit-of-work";
import { InMemoryReceivableRepository } from "./fakes/in-memory-receivable.repository";
import { InMemoryAccountLookup } from "./fakes/in-memory-account-lookup";
import { InMemoryAccountBalancesRepository } from "./fakes/in-memory-account-balances.repo";
import { InMemoryFiscalPeriodsRead } from "./fakes/in-memory-fiscal-periods-read";
import { InMemoryIvaBookReader } from "./fakes/in-memory-iva-book-reader";
import { InMemoryJournalEntryFactory } from "./fakes/in-memory-journal-entry-factory";
import { InMemoryOrgSettingsReader } from "./fakes/in-memory-org-settings-reader";
import { InMemorySalePermissions } from "./fakes/in-memory-sale-permissions";

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
    service = new SaleService({ repo });
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
    service = new SaleService({ repo });
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
    service = new SaleService({ repo: saleRepo, receivables: receivableRepo });
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
    service = new SaleService({
      repo: saleRepo,
      contacts: contactRepo,
      uow,
    });
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

describe("SaleService.post", () => {
  let saleRepo: InMemorySaleRepository;
  let receivableRepo: InMemoryReceivableRepository;
  let contactRepo: InMemoryContactRepository;
  let accountLookup: InMemoryAccountLookup;
  let orgSettings: InMemoryOrgSettingsReader;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let ivaBookReader: InMemoryIvaBookReader;
  let journalEntryFactory: InMemoryJournalEntryFactory;
  let accountBalances: InMemoryAccountBalancesRepository;
  let uow: InMemorySaleUnitOfWork;
  let service: SaleService;

  function buildPostContact(): Contact {
    return Contact.fromPersistence({
      id: "c-1",
      organizationId: ORG,
      type: "CLIENTE",
      name: "Cliente",
      nit: null,
      email: null,
      phone: null,
      address: null,
      paymentTermsDays: PaymentTermsDays.of(30),
      creditLimit: null,
      isActive: true,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    });
  }

  function buildDefaultSettings(): OrgSettings {
    return OrgSettings.createDefault({
      id: "settings-1",
      organizationId: ORG,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    });
  }

  function buildDraftSale(): Sale {
    return Sale.createDraft({
      organizationId: ORG,
      contactId: "c-1",
      periodId: "period-1",
      date: new Date("2025-01-15"),
      description: "Venta test",
      createdById: "user-1",
      details: [
        {
          description: "Línea 1",
          lineAmount: MonetaryAmount.of(1000),
          incomeAccountId: "acc-income-1",
        },
      ],
    });
  }

  function buildJournalStub(): Journal {
    return Journal.fromPersistence({
      id: "journal-1",
      organizationId: ORG,
      status: "POSTED",
      number: 1,
      referenceNumber: null,
      date: new Date("2025-01-15"),
      description: "VG-001 - Venta test",
      periodId: "period-1",
      voucherTypeId: "voucher-CI",
      contactId: "c-1",
      sourceType: "sale",
      sourceId: "sale-1",
      aiOriginalText: null,
      createdById: "user-1",
      updatedById: null,
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      lines: [],
    });
  }

  beforeEach(() => {
    saleRepo = new InMemorySaleRepository();
    receivableRepo = new InMemoryReceivableRepository();
    contactRepo = new InMemoryContactRepository();
    accountLookup = new InMemoryAccountLookup();
    orgSettings = new InMemoryOrgSettingsReader();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    ivaBookReader = new InMemoryIvaBookReader();
    journalEntryFactory = new InMemoryJournalEntryFactory();
    accountBalances = new InMemoryAccountBalancesRepository();

    contactRepo.preload(buildPostContact());
    orgSettings.preload(ORG, buildDefaultSettings());
    accountLookup.preload({
      id: "acc-income-1",
      code: "4.1.1",
      isDetail: true,
      isActive: true,
    });
    fiscalPeriods.preload("period-1", "OPEN");

    // Stub createTx in receivableRepo for post flow
    (receivableRepo as unknown as {
      createTx: (tx: unknown, data: { sourceId: string }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => ({ id: `receivable-${data.sourceId}` });

    uow = new InMemorySaleUnitOfWork({
      sales: saleRepo,
      accountBalances,
      receivables: receivableRepo,
    });

    service = new SaleService({
      repo: saleRepo,
      receivables: receivableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
      ivaBookReader,
      journalEntryFactory,
    });
  });

  it("posts a DRAFT sale: sequence allocated, journal generated, balances applied, receivable created, sale linked", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    const result = await service.post(ORG, draft.id, "user-1");

    expect(result.sale.status).toBe("POSTED");
    expect(result.sale.sequenceNumber).toBe(1);
    expect(result.sale.journalEntryId).toBe("journal-1");
    expect(result.sale.receivableId).toBe(`receivable-${draft.id}`);
    expect(journalEntryFactory.calls).toHaveLength(1);
    expect(accountBalances.applyPostCalls).toHaveLength(1);
    expect(saleRepo.updateTxCalls).toHaveLength(1);
    expect(saleRepo.updateTxCalls[0]!.options).toEqual({ replaceDetails: false });
  });

  it("propagates AuditContext into the UoW", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    await service.post(ORG, draft.id, "user-42");

    expect(uow.ranContexts).toEqual([
      { userId: "user-42", organizationId: ORG },
    ]);
  });

  it("throws NotFoundError when sale does not exist", async () => {
    await expect(service.post(ORG, "missing", "user-1")).rejects.toThrow(
      NotFoundError,
    );
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws SalePeriodClosed when period is CLOSED", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    fiscalPeriods.preload("period-1", "CLOSED");

    await expect(service.post(ORG, draft.id, "user-1")).rejects.toThrow(
      SalePeriodClosed,
    );
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws SaleAccountNotFound when income account is not in lookup", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    accountLookup = new InMemoryAccountLookup();
    service = new SaleService({
      repo: saleRepo,
      receivables: receivableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
      ivaBookReader,
      journalEntryFactory,
    });

    await expect(service.post(ORG, draft.id, "user-1")).rejects.toThrow(
      SaleAccountNotFound,
    );
    expect(uow.ranContexts).toEqual([]);
  });

  it("uses paymentTermsDays from contact for receivable dueDate", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    let capturedDueDate: Date | undefined;
    (receivableRepo as unknown as {
      createTx: (tx: unknown, data: { dueDate: Date; sourceId: string }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => {
      capturedDueDate = data.dueDate;
      return { id: `receivable-${data.sourceId}` };
    };

    await service.post(ORG, draft.id, "user-1");

    const expected = new Date("2025-01-15").getTime() + 30 * 86400000;
    expect(capturedDueDate?.getTime()).toBe(expected);
  });

  it("invokes the journal factory with display code 'VG-001' in description", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    await service.post(ORG, draft.id, "user-1");

    expect(journalEntryFactory.calls[0]!.description).toBe("VG-001 - Venta test");
  });

  it("emits IVA-aware entry lines when ivaBookReader returns a snapshot", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());
    ivaBookReader.preload(draft.id, {
      id: "iva-1",
      saleId: draft.id,
      ivaRate: 0.13,
      ivaAmount: 130,
      netAmount: 1000,
    });

    await service.post(ORG, draft.id, "user-1");

    const lines = journalEntryFactory.calls[0]!.lines;
    expect(lines.some((l) => l.accountCode === "2.1.6")).toBe(true);
  });
});

describe("SaleService.createAndPost", () => {
  let saleRepo: InMemorySaleRepository;
  let receivableRepo: InMemoryReceivableRepository;
  let contactRepo: InMemoryContactRepository;
  let accountLookup: InMemoryAccountLookup;
  let orgSettings: InMemoryOrgSettingsReader;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let ivaBookReader: InMemoryIvaBookReader;
  let journalEntryFactory: InMemoryJournalEntryFactory;
  let accountBalances: InMemoryAccountBalancesRepository;
  let salePermissions: InMemorySalePermissions;
  let uow: InMemorySaleUnitOfWork;
  let service: SaleService;

  const ROLE_ADMIN = "ADMIN";
  const ROLE_OPERADOR = "OPERADOR";

  function buildPostContact(): Contact {
    return Contact.fromPersistence({
      id: "c-1",
      organizationId: ORG,
      type: "CLIENTE",
      name: "Cliente",
      nit: null,
      email: null,
      phone: null,
      address: null,
      paymentTermsDays: PaymentTermsDays.of(30),
      creditLimit: null,
      isActive: true,
      createdAt: new Date("2025-01-01"),
      updatedAt: new Date("2025-01-01"),
    });
  }

  function buildJournalStub(): Journal {
    return Journal.fromPersistence({
      id: "journal-1",
      organizationId: ORG,
      status: "POSTED",
      number: 1,
      referenceNumber: null,
      date: new Date("2025-01-15"),
      description: "VG-001 - Venta nueva",
      periodId: "period-1",
      voucherTypeId: "voucher-CI",
      contactId: "c-1",
      sourceType: "sale",
      sourceId: "sale-new",
      aiOriginalText: null,
      createdById: "user-1",
      updatedById: null,
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      lines: [],
    });
  }

  const input = {
    contactId: "c-1",
    periodId: "period-1",
    date: new Date("2025-01-15"),
    description: "Venta nueva",
    details: [
      {
        description: "Línea 1",
        lineAmount: MonetaryAmount.of(1000),
        incomeAccountId: "acc-income-1",
      },
    ],
  };

  beforeEach(() => {
    saleRepo = new InMemorySaleRepository();
    receivableRepo = new InMemoryReceivableRepository();
    contactRepo = new InMemoryContactRepository();
    accountLookup = new InMemoryAccountLookup();
    orgSettings = new InMemoryOrgSettingsReader();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    ivaBookReader = new InMemoryIvaBookReader();
    journalEntryFactory = new InMemoryJournalEntryFactory();
    accountBalances = new InMemoryAccountBalancesRepository();
    salePermissions = new InMemorySalePermissions();

    contactRepo.preload(buildPostContact());
    orgSettings.preload(
      ORG,
      OrgSettings.createDefault({
        id: "settings-1",
        organizationId: ORG,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      }),
    );
    accountLookup.preload({
      id: "acc-income-1",
      code: "4.1.1",
      isDetail: true,
      isActive: true,
    });
    fiscalPeriods.preload("period-1", "OPEN");
    salePermissions.allow(ROLE_ADMIN);

    (receivableRepo as unknown as {
      createTx: (tx: unknown, data: { sourceId: string; dueDate: Date }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => ({ id: `receivable-${data.sourceId}` });

    uow = new InMemorySaleUnitOfWork({
      sales: saleRepo,
      accountBalances,
      receivables: receivableRepo,
    });

    service = new SaleService({
      repo: saleRepo,
      receivables: receivableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
      ivaBookReader,
      journalEntryFactory,
      salePermissions,
    });
  });

  it("creates and posts atomically when role has permission", async () => {
    journalEntryFactory.enqueue(buildJournalStub());

    const result = await service.createAndPost(ORG, input, {
      userId: "user-1",
      role: ROLE_ADMIN,
    });

    expect(result.sale.status).toBe("POSTED");
    expect(result.sale.sequenceNumber).toBe(1);
    expect(result.sale.journalEntryId).toBe("journal-1");
    expect(result.sale.receivableId).toMatch(/^receivable-/);
    expect(saleRepo.saveTxCalls).toHaveLength(1);
    expect(saleRepo.updateTxCalls).toHaveLength(0);
  });

  it("records SalePermissions canPost call with role + 'sales' scope + orgId", async () => {
    journalEntryFactory.enqueue(buildJournalStub());

    await service.createAndPost(ORG, input, {
      userId: "user-1",
      role: ROLE_ADMIN,
    });

    expect(salePermissions.canPostCalls).toEqual([
      { role: ROLE_ADMIN, scope: "sales", organizationId: ORG },
    ]);
  });

  it("throws SalePostNotAllowedForRole when role is denied", async () => {
    await expect(
      service.createAndPost(ORG, input, {
        userId: "user-1",
        role: ROLE_OPERADOR,
      }),
    ).rejects.toThrow(SalePostNotAllowedForRole);

    expect(uow.ranContexts).toEqual([]);
    expect(saleRepo.saveTxCalls).toEqual([]);
  });

  it("throws ContactNotFound when contact does not exist", async () => {
    contactRepo.reset();

    await expect(
      service.createAndPost(ORG, input, {
        userId: "user-1",
        role: ROLE_ADMIN,
      }),
    ).rejects.toThrow(ContactNotFound);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws SaleContactInactive when contact is inactive", async () => {
    contactRepo.reset();
    contactRepo.preload(
      Contact.fromPersistence({
        id: "c-1",
        organizationId: ORG,
        type: "CLIENTE",
        name: "Cliente",
        nit: null,
        email: null,
        phone: null,
        address: null,
        paymentTermsDays: PaymentTermsDays.of(30),
        creditLimit: null,
        isActive: false,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      }),
    );

    await expect(
      service.createAndPost(ORG, input, {
        userId: "user-1",
        role: ROLE_ADMIN,
      }),
    ).rejects.toThrow(SaleContactInactive);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws SaleContactNotClient when contact type is not CLIENTE", async () => {
    contactRepo.reset();
    contactRepo.preload(
      Contact.fromPersistence({
        id: "c-1",
        organizationId: ORG,
        type: "PROVEEDOR",
        name: "Proveedor",
        nit: null,
        email: null,
        phone: null,
        address: null,
        paymentTermsDays: PaymentTermsDays.of(30),
        creditLimit: null,
        isActive: true,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      }),
    );

    await expect(
      service.createAndPost(ORG, input, {
        userId: "user-1",
        role: ROLE_ADMIN,
      }),
    ).rejects.toThrow(SaleContactNotClient);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws SalePeriodClosed when period is CLOSED", async () => {
    fiscalPeriods.preload("period-1", "CLOSED");

    await expect(
      service.createAndPost(ORG, input, {
        userId: "user-1",
        role: ROLE_ADMIN,
      }),
    ).rejects.toThrow(SalePeriodClosed);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws SaleAccountNotFound when income account is not in lookup", async () => {
    accountLookup = new InMemoryAccountLookup();
    service = new SaleService({
      repo: saleRepo,
      receivables: receivableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
      ivaBookReader,
      journalEntryFactory,
      salePermissions,
    });

    await expect(
      service.createAndPost(ORG, input, {
        userId: "user-1",
        role: ROLE_ADMIN,
      }),
    ).rejects.toThrow(SaleAccountNotFound);
    expect(uow.ranContexts).toEqual([]);
  });

  it("propagates AuditContext into the UoW", async () => {
    journalEntryFactory.enqueue(buildJournalStub());

    await service.createAndPost(ORG, input, {
      userId: "user-77",
      role: ROLE_ADMIN,
    });

    expect(uow.ranContexts).toEqual([
      { userId: "user-77", organizationId: ORG },
    ]);
  });

  it("does NOT consult ivaBookReader (createAndPost is non-IVA fast path)", async () => {
    journalEntryFactory.enqueue(buildJournalStub());

    await service.createAndPost(ORG, input, {
      userId: "user-1",
      role: ROLE_ADMIN,
    });

    expect(ivaBookReader.calls).toEqual([]);
  });

  it("uses paymentTermsDays from contact for receivable dueDate", async () => {
    journalEntryFactory.enqueue(buildJournalStub());

    let capturedDueDate: Date | undefined;
    (receivableRepo as unknown as {
      createTx: (tx: unknown, data: { dueDate: Date; sourceId: string }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => {
      capturedDueDate = data.dueDate;
      return { id: `receivable-${data.sourceId}` };
    };

    await service.createAndPost(ORG, input, {
      userId: "user-1",
      role: ROLE_ADMIN,
    });

    const expected = new Date("2025-01-15").getTime() + 30 * 86400000;
    expect(capturedDueDate?.getTime()).toBe(expected);
  });
});

describe("SaleService.update — DRAFT branch", () => {
  let saleRepo: InMemorySaleRepository;
  let contactRepo: InMemoryContactRepository;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let uow: InMemorySaleUnitOfWork;
  let service: SaleService;

  function buildDraftSale(overrides: { contactId?: string } = {}): Sale {
    return Sale.createDraft({
      organizationId: ORG,
      contactId: overrides.contactId ?? "c-1",
      periodId: "period-1",
      date: new Date("2025-01-15"),
      description: "Original",
      createdById: "user-1",
      details: [
        {
          description: "Línea original",
          lineAmount: MonetaryAmount.of(500),
          incomeAccountId: "acc-income-1",
        },
      ],
    });
  }

  function buildContact(overrides: {
    id?: string;
    type?: ContactType;
    isActive?: boolean;
  } = {}): Contact {
    return Contact.fromPersistence({
      id: overrides.id ?? "c-2",
      organizationId: ORG,
      type: overrides.type ?? "CLIENTE",
      name: "Cliente Nuevo",
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

  beforeEach(() => {
    saleRepo = new InMemorySaleRepository();
    contactRepo = new InMemoryContactRepository();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    uow = new InMemorySaleUnitOfWork({ sales: saleRepo });
    service = new SaleService({
      repo: saleRepo,
      contacts: contactRepo,
      uow,
      fiscalPeriods,
    });
  });

  it("updates header only without replaceDetails", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);

    const result = await service.update(
      ORG,
      draft.id,
      { description: "Editada" },
      { userId: "user-1" },
    );

    expect(result.sale.description).toBe("Editada");
    expect(saleRepo.updateTxCalls).toHaveLength(1);
    expect(saleRepo.updateTxCalls[0]!.options).toEqual({ replaceDetails: false });
  });

  it("replaces details when input.details is present", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);

    const result = await service.update(
      ORG,
      draft.id,
      {
        details: [
          {
            description: "Nueva línea",
            lineAmount: MonetaryAmount.of(750),
            incomeAccountId: "acc-income-1",
          },
        ],
      },
      { userId: "user-1" },
    );

    expect(result.sale.totalAmount.value).toBe(750);
    expect(saleRepo.updateTxCalls[0]!.options).toEqual({ replaceDetails: true });
  });

  it("validates contact when changing contactId — happy path CLIENTE", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    contactRepo.preload(buildContact({ id: "c-2" }));

    const result = await service.update(
      ORG,
      draft.id,
      { contactId: "c-2" },
      { userId: "user-1" },
    );

    expect(result.sale.contactId).toBe("c-2");
  });

  it("throws SaleContactInactive when changing to inactive contact", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    contactRepo.preload(buildContact({ id: "c-2", isActive: false }));

    await expect(
      service.update(ORG, draft.id, { contactId: "c-2" }, { userId: "user-1" }),
    ).rejects.toThrow(SaleContactInactive);
    expect(saleRepo.updateTxCalls).toEqual([]);
  });

  it("throws SaleContactNotClient when changing to non-CLIENTE contact", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    contactRepo.preload(buildContact({ id: "c-2", type: "PROVEEDOR" }));

    await expect(
      service.update(ORG, draft.id, { contactId: "c-2" }, { userId: "user-1" }),
    ).rejects.toThrow(SaleContactNotClient);
    expect(saleRepo.updateTxCalls).toEqual([]);
  });

  it("throws SaleVoidedImmutable when sale is VOIDED", async () => {
    const voided = Sale.fromPersistence({
      id: "voided-sale",
      organizationId: ORG,
      status: "VOIDED",
      sequenceNumber: 1,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Anulada",
      referenceNumber: null,
      notes: null,
      totalAmount: MonetaryAmount.of(500),
      journalEntryId: "journal-1",
      receivableId: null,
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [],
      receivable: null,
    });
    saleRepo.preload(voided);

    await expect(
      service.update(ORG, "voided-sale", { description: "x" }, { userId: "user-1" }),
    ).rejects.toThrow(SaleVoidedImmutable);
  });
});

describe("SaleService.update — LOCKED branch", () => {
  let saleRepo: InMemorySaleRepository;
  let contactRepo: InMemoryContactRepository;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let uow: InMemorySaleUnitOfWork;
  let service: SaleService;

  function buildLockedSale(): Sale {
    return Sale.fromPersistence({
      id: "locked-sale",
      organizationId: ORG,
      status: "LOCKED",
      sequenceNumber: 1,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Bloqueada",
      referenceNumber: null,
      notes: null,
      totalAmount: MonetaryAmount.of(500),
      journalEntryId: "journal-1",
      receivableId: "receivable-1",
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [],
      receivable: null,
    });
  }

  beforeEach(() => {
    saleRepo = new InMemorySaleRepository();
    contactRepo = new InMemoryContactRepository();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    fiscalPeriods.preload("period-1", "OPEN");
    uow = new InMemorySaleUnitOfWork({ sales: saleRepo });
    service = new SaleService({
      repo: saleRepo,
      contacts: contactRepo,
      uow,
      fiscalPeriods,
    });
  });

  it("succeeds for admin role + period OPEN + 10+ char justification", async () => {
    saleRepo.preload(buildLockedSale());

    const result = await service.update(
      ORG,
      "locked-sale",
      { description: "Editada bloqueada" },
      { userId: "user-1", role: "admin", justification: "Corrección de descripción" },
    );

    expect(result.sale.description).toBe("Editada bloqueada");
    expect(uow.ranContexts).toEqual([
      {
        userId: "user-1",
        organizationId: ORG,
        justification: "Corrección de descripción",
      },
    ]);
  });

  it("throws ForbiddenError when role is not admin/owner", async () => {
    saleRepo.preload(buildLockedSale());

    await expect(
      service.update(
        ORG,
        "locked-sale",
        { description: "Editada bloqueada" },
        { userId: "user-1", role: "OPERADOR", justification: "1234567890" },
      ),
    ).rejects.toThrow(ForbiddenError);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws SaleLockedEditMissingJustification with requiredMin=10 when period OPEN + justification < 10", async () => {
    saleRepo.preload(buildLockedSale());

    const error = await service
      .update(
        ORG,
        "locked-sale",
        { description: "x" },
        { userId: "user-1", role: "admin", justification: "corto" },
      )
      .catch((e) => e);

    expect(error).toBeInstanceOf(SaleLockedEditMissingJustification);
    expect(error.details).toEqual({ requiredMin: 10 });
    expect(uow.ranContexts).toEqual([]);
  });

  it("requires justification ≥50 chars when period CLOSED", async () => {
    saleRepo.preload(buildLockedSale());
    fiscalPeriods.preload("period-1", "CLOSED");

    const error = await service
      .update(
        ORG,
        "locked-sale",
        { description: "x" },
        {
          userId: "user-1",
          role: "owner",
          justification: "Tres veces diez chars exactamente",
        },
      )
      .catch((e) => e);

    expect(error).toBeInstanceOf(SaleLockedEditMissingJustification);
    expect(error.details).toEqual({ requiredMin: 50 });
  });

  it("succeeds for owner role + period CLOSED + 50+ char justification", async () => {
    saleRepo.preload(buildLockedSale());
    fiscalPeriods.preload("period-1", "CLOSED");

    const long =
      "Justificación muy completa que supera los cincuenta caracteres requeridos por compliance";

    const result = await service.update(
      ORG,
      "locked-sale",
      { description: "Editada en CLOSED" },
      { userId: "user-1", role: "owner", justification: long },
    );

    expect(result.sale.description).toBe("Editada en CLOSED");
  });

  it("ignores input.details on LOCKED (legacy parity — header only)", async () => {
    saleRepo.preload(buildLockedSale());

    const result = await service.update(
      ORG,
      "locked-sale",
      {
        description: "Solo header",
        details: [
          {
            description: "Detalle ignorado",
            lineAmount: MonetaryAmount.of(999),
            incomeAccountId: "acc-x",
          },
        ],
      },
      { userId: "user-1", role: "admin", justification: "Cambio menor de descripción" },
    );

    expect(saleRepo.updateTxCalls[0]!.options).toEqual({ replaceDetails: false });
    expect(result.sale.totalAmount.value).toBe(500);
  });
});
