import { beforeEach, describe, expect, it } from "vitest";
import { NotFoundError } from "@/features/shared/errors";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Contact } from "@/modules/contacts/domain/contact.entity";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";
import type { ContactType } from "@/modules/contacts/domain/value-objects/contact-type";
import { PaymentTermsDays } from "@/modules/contacts/domain/value-objects/payment-terms-days";
import { Payable } from "@/modules/payables/domain/payable.entity";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { OrgSettings } from "@/modules/org-settings/domain/org-settings.entity";
import { Purchase, type PurchaseType } from "../../domain/purchase.entity";
import type { PurchaseStatus } from "../../domain/value-objects/purchase-status";
import {
  PurchaseAccountNotFound,
  PurchaseContactChangeWithAllocations,
  PurchaseContactInactive,
  PurchaseContactNotProvider,
  PurchaseLockedEditMissingJustification,
  PurchasePeriodClosed,
  PurchasePostNotAllowedForRole,
} from "../errors/purchase-orchestration-errors";
import { ForbiddenError } from "@/features/shared/errors";
import { PurchaseVoidedImmutable } from "../../domain/errors/purchase-errors";
import { PurchaseDetail } from "../../domain/purchase-detail.entity";
import { PurchaseService } from "../purchase.service";
import { InMemoryPurchaseRepository } from "./fakes/in-memory-purchase.repository";
import { InMemoryPayableRepository } from "./fakes/in-memory-payable.repository";
import { InMemoryContactRepository } from "./fakes/in-memory-contact.repository";
import { InMemoryPurchaseUnitOfWork } from "./fakes/in-memory-purchase-unit-of-work";
import { InMemoryAccountLookup } from "./fakes/in-memory-account-lookup";
import { InMemoryOrgSettingsReader } from "./fakes/in-memory-org-settings-reader";
import { InMemoryFiscalPeriodsRead } from "./fakes/in-memory-fiscal-periods-read";
import { InMemoryIvaBookReader } from "./fakes/in-memory-iva-book-reader";
import { InMemoryJournalEntryFactory } from "./fakes/in-memory-journal-entry-factory";
import { InMemoryAccountBalancesRepository } from "./fakes/in-memory-account-balances.repo";
import { InMemoryPurchasePermissions } from "./fakes/in-memory-purchase-permissions";
import { InMemoryIvaBookRegenNotifier } from "./fakes/in-memory-iva-book-regen-notifier";

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

describe("PurchaseService.getEditPreview", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let payableRepo: InMemoryPayableRepository;
  let service: PurchaseService;

  beforeEach(() => {
    purchaseRepo = new InMemoryPurchaseRepository();
    payableRepo = new InMemoryPayableRepository();
    service = new PurchaseService({ repo: purchaseRepo, payables: payableRepo });
  });

  function buildPayable(id: string, paid: number): Payable {
    return Payable.fromPersistence({
      id,
      organizationId: ORG,
      contactId: "contact-1",
      description: "CxP test",
      amount: MonetaryAmount.of(1000),
      paid: MonetaryAmount.of(paid),
      balance: MonetaryAmount.of(1000 - paid),
      dueDate: new Date("2025-02-15"),
      status: "PARTIAL",
      sourceType: "PURCHASE",
      sourceId: "purchase-1",
      journalEntryId: null,
      notes: null,
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
    });
  }

  it("returns empty trim preview when purchase has no payableId", async () => {
    purchaseRepo.preload(buildPurchase({ id: "purchase-1", payableId: null }));

    const preview = await service.getEditPreview(ORG, "purchase-1", 500);

    expect(preview).toEqual({ trimPreview: [] });
  });

  it("throws NotFoundError when purchase does not exist", async () => {
    await expect(
      service.getEditPreview(ORG, "missing", 500),
    ).rejects.toThrow(NotFoundError);
  });

  it("returns empty trim preview when newTotal >= paid", async () => {
    purchaseRepo.preload(buildPurchase({ id: "purchase-1", payableId: "p-1" }));
    payableRepo.preloadPayable(buildPayable("p-1", 300));
    payableRepo.preloadAllocations("p-1", [
      { id: "a1", amount: 200, payment: { date: new Date("2025-02-01") } },
    ]);

    const preview = await service.getEditPreview(ORG, "purchase-1", 400);

    expect(preview).toEqual({ trimPreview: [] });
  });

  it("returns empty trim preview when payable not found (paid treated as 0)", async () => {
    purchaseRepo.preload(
      buildPurchase({ id: "purchase-1", payableId: "p-missing" }),
    );

    const preview = await service.getEditPreview(ORG, "purchase-1", 500);

    expect(preview).toEqual({ trimPreview: [] });
  });

  it("trims allocations LIFO when newTotal < paid", async () => {
    purchaseRepo.preload(buildPurchase({ id: "purchase-1", payableId: "p-1" }));
    payableRepo.preloadPayable(buildPayable("p-1", 500));
    payableRepo.preloadAllocations("p-1", [
      { id: "a-newest", amount: 200, payment: { date: new Date("2025-03-01") } },
      { id: "a-mid", amount: 150, payment: { date: new Date("2025-02-01") } },
      { id: "a-oldest", amount: 150, payment: { date: new Date("2025-01-01") } },
    ]);

    const preview = await service.getEditPreview(ORG, "purchase-1", 200);

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

  it("propagates NotFoundError for purchase in different org", async () => {
    purchaseRepo.preload(
      buildPurchase({ id: "purchase-1", organizationId: OTHER_ORG, payableId: "p-1" }),
    );

    await expect(
      service.getEditPreview(ORG, "purchase-1", 100),
    ).rejects.toThrow(NotFoundError);
  });
});

describe("PurchaseService.createDraft", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let contactRepo: InMemoryContactRepository;
  let uow: InMemoryPurchaseUnitOfWork;
  let service: PurchaseService;

  beforeEach(() => {
    purchaseRepo = new InMemoryPurchaseRepository();
    contactRepo = new InMemoryContactRepository();
    uow = new InMemoryPurchaseUnitOfWork({ purchases: purchaseRepo });
    service = new PurchaseService({
      repo: purchaseRepo,
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
      type: overrides.type ?? "PROVEEDOR",
      name: "Proveedor Test",
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
    purchaseType: "COMPRA_GENERAL" as PurchaseType,
    contactId: "c-1",
    periodId: "period-1",
    date: new Date("2025-01-15"),
    description: "Compra a Proveedor Test",
    details: [
      {
        description: "Línea 1",
        lineAmount: MonetaryAmount.of(100),
        expenseAccountId: "acc-expense-1",
      },
    ],
  };

  it("persists a DRAFT purchase and returns the aggregate + correlationId", async () => {
    contactRepo.preload(buildContact());
    uow.nextCorrelationId = "corr-fixed-42";

    const result = await service.createDraft(ORG, draftInput, "user-1");

    expect(result.correlationId).toBe("corr-fixed-42");
    expect(result.purchase.status).toBe("DRAFT");
    expect(result.purchase.organizationId).toBe(ORG);
    expect(result.purchase.contactId).toBe("c-1");
    expect(result.purchase.createdById).toBe("user-1");
    expect(result.purchase.totalAmount.value).toBe(100);
    expect(result.purchase.details).toHaveLength(1);
    expect(purchaseRepo.saveTxCalls).toHaveLength(1);
    expect(purchaseRepo.saveTxCalls[0]!.id).toBe(result.purchase.id);
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

    expect(purchaseRepo.saveTxCalls).toEqual([]);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws PurchaseContactInactive when contact exists but is inactive", async () => {
    contactRepo.preload(buildContact({ isActive: false }));

    await expect(
      service.createDraft(ORG, draftInput, "user-1"),
    ).rejects.toThrow(PurchaseContactInactive);

    expect(purchaseRepo.saveTxCalls).toEqual([]);
  });

  it("throws PurchaseContactNotProvider when contact type is not PROVEEDOR", async () => {
    contactRepo.preload(buildContact({ type: "CLIENTE" }));

    await expect(
      service.createDraft(ORG, draftInput, "user-1"),
    ).rejects.toThrow(PurchaseContactNotProvider);

    expect(purchaseRepo.saveTxCalls).toEqual([]);
  });

  it("does not open the UoW when contact validation fails", async () => {
    contactRepo.preload(buildContact({ isActive: false }));

    await service
      .createDraft(ORG, draftInput, "user-1")
      .catch(() => undefined);

    expect(uow.ranContexts).toEqual([]);
  });
});

describe("PurchaseService.post", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let payableRepo: InMemoryPayableRepository;
  let contactRepo: InMemoryContactRepository;
  let accountLookup: InMemoryAccountLookup;
  let orgSettings: InMemoryOrgSettingsReader;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let ivaBookReader: InMemoryIvaBookReader;
  let journalEntryFactory: InMemoryJournalEntryFactory;
  let accountBalances: InMemoryAccountBalancesRepository;
  let uow: InMemoryPurchaseUnitOfWork;
  let service: PurchaseService;

  function buildPostContact(): Contact {
    return Contact.fromPersistence({
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

  function buildDraftPurchase(
    overrides: { purchaseType?: PurchaseType; expenseAccountId?: string } = {},
  ): Purchase {
    const purchaseType = overrides.purchaseType ?? "COMPRA_GENERAL";
    const needsExpense =
      purchaseType === "COMPRA_GENERAL" || purchaseType === "SERVICIO";
    return Purchase.createDraft({
      organizationId: ORG,
      purchaseType,
      contactId: "c-1",
      periodId: "period-1",
      date: new Date("2025-01-15"),
      description: "Compra test",
      createdById: "user-1",
      details: [
        {
          description: "Línea 1",
          lineAmount: MonetaryAmount.of(1000),
          ...(needsExpense
            ? { expenseAccountId: overrides.expenseAccountId ?? "acc-expense-1" }
            : {}),
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
      description: "CG-001 - Compra test",
      periodId: "period-1",
      voucherTypeId: "voucher-CE",
      contactId: "c-1",
      sourceType: "purchase",
      sourceId: "purchase-1",
      aiOriginalText: null,
      createdById: "user-1",
      updatedById: null,
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      lines: [],
    });
  }

  beforeEach(() => {
    purchaseRepo = new InMemoryPurchaseRepository();
    payableRepo = new InMemoryPayableRepository();
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
      id: "acc-expense-1",
      code: "5.1.5",
      isDetail: true,
      isActive: true,
    });
    fiscalPeriods.preload("period-1", "OPEN");

    // Stub createTx in payableRepo for post flow (paridad sale stub receivableRepo.createTx)
    (payableRepo as unknown as {
      createTx: (tx: unknown, data: { sourceId: string }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => ({ id: `payable-${data.sourceId}` });

    uow = new InMemoryPurchaseUnitOfWork({
      purchases: purchaseRepo,
      accountBalances,
      payables: payableRepo,
      journalEntryFactory,
    });

    service = new PurchaseService({
      repo: purchaseRepo,
      payables: payableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
      ivaBookReader,
    });
  });

  it("posts a DRAFT purchase: sequence allocated, journal generated, balances applied, payable created, purchase linked", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    const result = await service.post(ORG, draft.id, "user-1");

    expect(result.purchase.status).toBe("POSTED");
    expect(result.purchase.sequenceNumber).toBe(1);
    expect(result.purchase.journalEntryId).toBe("journal-1");
    expect(result.purchase.payableId).toBe(`payable-${draft.id}`);
    expect(journalEntryFactory.purchaseCalls).toHaveLength(1);
    expect(accountBalances.applyPostCalls).toHaveLength(1);
    expect(purchaseRepo.updateTxCalls).toHaveLength(1);
    expect(purchaseRepo.updateTxCalls[0]!.options).toEqual({ replaceDetails: false });
  });

  it("propagates AuditContext into the UoW", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    await service.post(ORG, draft.id, "user-42");

    expect(uow.ranContexts).toEqual([
      { userId: "user-42", organizationId: ORG },
    ]);
  });

  it("throws NotFoundError when purchase does not exist", async () => {
    await expect(service.post(ORG, "missing", "user-1")).rejects.toThrow(
      NotFoundError,
    );
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws PurchasePeriodClosed when period is CLOSED", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);
    fiscalPeriods.preload("period-1", "CLOSED");

    await expect(service.post(ORG, draft.id, "user-1")).rejects.toThrow(
      PurchasePeriodClosed,
    );
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws PurchaseAccountNotFound when expense account is not in lookup (COMPRA_GENERAL)", async () => {
    const draft = buildDraftPurchase({ expenseAccountId: "acc-missing" });
    purchaseRepo.preload(draft);

    await expect(service.post(ORG, draft.id, "user-1")).rejects.toThrow(
      PurchaseAccountNotFound,
    );
    expect(uow.ranContexts).toEqual([]);
  });

  it("uses paymentTermsDays from contact for payable dueDate", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    let capturedDueDate: Date | undefined;
    (payableRepo as unknown as {
      createTx: (tx: unknown, data: { dueDate: Date; sourceId: string }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => {
      capturedDueDate = data.dueDate;
      return { id: `payable-${data.sourceId}` };
    };

    await service.post(ORG, draft.id, "user-1");

    const expected = new Date("2025-01-15").getTime() + 30 * 86400000;
    expect(capturedDueDate?.getTime()).toBe(expected);
  });

  it("invokes the journal factory with displayCode 'CG-001' for COMPRA_GENERAL", async () => {
    const draft = buildDraftPurchase({ purchaseType: "COMPRA_GENERAL" });
    purchaseRepo.preload(draft);
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    await service.post(ORG, draft.id, "user-1");

    expect(journalEntryFactory.purchaseCalls[0]!.description).toBe(
      "CG-001 - Compra test",
    );
  });

  it("uses displayCode prefix 'FL' for FLETE and skips expense account lookup", async () => {
    const draft = buildDraftPurchase({ purchaseType: "FLETE" });
    purchaseRepo.preload(draft);
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    await service.post(ORG, draft.id, "user-1");

    expect(journalEntryFactory.purchaseCalls[0]!.description).toBe(
      "FL-001 - Compra test",
    );
    expect(accountLookup.callsByIds[0]!.ids).toEqual([]);
  });

  it("emits IVA-aware entry lines when ivaBookReader returns a snapshot", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);
    journalEntryFactory.enqueuePurchase(buildJournalStub());
    ivaBookReader.preload(draft.id, {
      id: "iva-1",
      purchaseId: draft.id,
      ivaRate: 0.13,
      ivaAmount: 130,
      netAmount: 1000,
      exentos: 0,
    });

    await service.post(ORG, draft.id, "user-1");

    const lines = journalEntryFactory.purchaseCalls[0]!.lines;
    // IVA crédito fiscal account 1.1.8 (paridad legacy purchase)
    expect(lines.some((l) => l.accountCode === "1.1.8")).toBe(true);
  });
});

describe("PurchaseService.createAndPost", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let payableRepo: InMemoryPayableRepository;
  let contactRepo: InMemoryContactRepository;
  let accountLookup: InMemoryAccountLookup;
  let orgSettings: InMemoryOrgSettingsReader;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let ivaBookReader: InMemoryIvaBookReader;
  let journalEntryFactory: InMemoryJournalEntryFactory;
  let accountBalances: InMemoryAccountBalancesRepository;
  let purchasePermissions: InMemoryPurchasePermissions;
  let uow: InMemoryPurchaseUnitOfWork;
  let service: PurchaseService;

  const ROLE_ADMIN = "ADMIN";
  const ROLE_OPERADOR = "OPERADOR";

  function buildPostContact(): Contact {
    return Contact.fromPersistence({
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
      description: "CG-001 - Compra nueva",
      periodId: "period-1",
      voucherTypeId: "voucher-CE",
      contactId: "c-1",
      sourceType: "purchase",
      sourceId: "purchase-new",
      aiOriginalText: null,
      createdById: "user-1",
      updatedById: null,
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      lines: [],
    });
  }

  const input = {
    purchaseType: "COMPRA_GENERAL" as PurchaseType,
    contactId: "c-1",
    periodId: "period-1",
    date: new Date("2025-01-15"),
    description: "Compra nueva",
    details: [
      {
        description: "Línea 1",
        lineAmount: MonetaryAmount.of(1000),
        expenseAccountId: "acc-expense-1",
      },
    ],
  };

  beforeEach(() => {
    purchaseRepo = new InMemoryPurchaseRepository();
    payableRepo = new InMemoryPayableRepository();
    contactRepo = new InMemoryContactRepository();
    accountLookup = new InMemoryAccountLookup();
    orgSettings = new InMemoryOrgSettingsReader();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    ivaBookReader = new InMemoryIvaBookReader();
    journalEntryFactory = new InMemoryJournalEntryFactory();
    accountBalances = new InMemoryAccountBalancesRepository();
    purchasePermissions = new InMemoryPurchasePermissions();

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
      id: "acc-expense-1",
      code: "5.1.5",
      isDetail: true,
      isActive: true,
    });
    fiscalPeriods.preload("period-1", "OPEN");
    purchasePermissions.allow(ROLE_ADMIN);

    (payableRepo as unknown as {
      createTx: (tx: unknown, data: { sourceId: string; dueDate: Date }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => ({ id: `payable-${data.sourceId}` });

    uow = new InMemoryPurchaseUnitOfWork({
      purchases: purchaseRepo,
      accountBalances,
      payables: payableRepo,
      journalEntryFactory,
    });

    service = new PurchaseService({
      repo: purchaseRepo,
      payables: payableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
      ivaBookReader,
      purchasePermissions,
    });
  });

  it("creates and posts atomically when role has permission", async () => {
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    const result = await service.createAndPost(ORG, input, {
      userId: "user-1",
      role: ROLE_ADMIN,
    });

    expect(result.purchase.status).toBe("POSTED");
    expect(result.purchase.sequenceNumber).toBe(1);
    expect(result.purchase.journalEntryId).toBe("journal-1");
    expect(result.purchase.payableId).toMatch(/^payable-/);
    expect(purchaseRepo.saveTxCalls).toHaveLength(1);
    expect(purchaseRepo.updateTxCalls).toHaveLength(0);
  });

  it("records PurchasePermissions canPost call with role + 'purchases' scope + orgId", async () => {
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    await service.createAndPost(ORG, input, {
      userId: "user-1",
      role: ROLE_ADMIN,
    });

    expect(purchasePermissions.canPostCalls).toEqual([
      { role: ROLE_ADMIN, scope: "purchases", organizationId: ORG },
    ]);
  });

  it("throws PurchasePostNotAllowedForRole when role is denied", async () => {
    await expect(
      service.createAndPost(ORG, input, {
        userId: "user-1",
        role: ROLE_OPERADOR,
      }),
    ).rejects.toThrow(PurchasePostNotAllowedForRole);

    expect(uow.ranContexts).toEqual([]);
    expect(purchaseRepo.saveTxCalls).toEqual([]);
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

  it("throws PurchaseContactInactive when contact is inactive", async () => {
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
    ).rejects.toThrow(PurchaseContactInactive);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws PurchaseContactNotProvider when contact type is not PROVEEDOR", async () => {
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
    ).rejects.toThrow(PurchaseContactNotProvider);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws PurchasePeriodClosed when period is CLOSED", async () => {
    fiscalPeriods.preload("period-1", "CLOSED");

    await expect(
      service.createAndPost(ORG, input, {
        userId: "user-1",
        role: ROLE_ADMIN,
      }),
    ).rejects.toThrow(PurchasePeriodClosed);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws PurchaseAccountNotFound when expense account is not in lookup", async () => {
    accountLookup = new InMemoryAccountLookup();
    service = new PurchaseService({
      repo: purchaseRepo,
      payables: payableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
      ivaBookReader,
      purchasePermissions,
    });

    await expect(
      service.createAndPost(ORG, input, {
        userId: "user-1",
        role: ROLE_ADMIN,
      }),
    ).rejects.toThrow(PurchaseAccountNotFound);
    expect(uow.ranContexts).toEqual([]);
  });

  it("propagates AuditContext into the UoW", async () => {
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    await service.createAndPost(ORG, input, {
      userId: "user-77",
      role: ROLE_ADMIN,
    });

    expect(uow.ranContexts).toEqual([
      { userId: "user-77", organizationId: ORG },
    ]);
  });

  it("does NOT consult ivaBookReader (createAndPost is non-IVA fast path)", async () => {
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    await service.createAndPost(ORG, input, {
      userId: "user-1",
      role: ROLE_ADMIN,
    });

    expect(ivaBookReader.calls).toEqual([]);
  });

  it("uses paymentTermsDays from contact for payable dueDate", async () => {
    journalEntryFactory.enqueuePurchase(buildJournalStub());

    let capturedDueDate: Date | undefined;
    (payableRepo as unknown as {
      createTx: (tx: unknown, data: { dueDate: Date; sourceId: string }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => {
      capturedDueDate = data.dueDate;
      return { id: `payable-${data.sourceId}` };
    };

    await service.createAndPost(ORG, input, {
      userId: "user-1",
      role: ROLE_ADMIN,
    });

    const expected = new Date("2025-01-15").getTime() + 30 * 86400000;
    expect(capturedDueDate?.getTime()).toBe(expected);
  });
});

describe("PurchaseService.update — DRAFT branch", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let contactRepo: InMemoryContactRepository;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let uow: InMemoryPurchaseUnitOfWork;
  let service: PurchaseService;

  function buildDraftPurchase(overrides: { contactId?: string } = {}): Purchase {
    return Purchase.createDraft({
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      contactId: overrides.contactId ?? "c-1",
      periodId: "period-1",
      date: new Date("2025-01-15"),
      description: "Original",
      createdById: "user-1",
      details: [
        {
          description: "Línea original",
          lineAmount: MonetaryAmount.of(500),
          expenseAccountId: "acc-expense-1",
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
      type: overrides.type ?? "PROVEEDOR",
      name: "Proveedor Nuevo",
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
    purchaseRepo = new InMemoryPurchaseRepository();
    contactRepo = new InMemoryContactRepository();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    uow = new InMemoryPurchaseUnitOfWork({ purchases: purchaseRepo });
    service = new PurchaseService({
      repo: purchaseRepo,
      contacts: contactRepo,
      uow,
      fiscalPeriods,
    });
  });

  it("updates header only without replaceDetails", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);

    const result = await service.update(
      ORG,
      draft.id,
      { description: "Editada" },
      { userId: "user-1" },
    );

    expect(result.purchase.description).toBe("Editada");
    expect(purchaseRepo.updateTxCalls).toHaveLength(1);
    expect(purchaseRepo.updateTxCalls[0]!.options).toEqual({ replaceDetails: false });
  });

  it("replaces details when input.details is present", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);

    const result = await service.update(
      ORG,
      draft.id,
      {
        details: [
          {
            description: "Nueva línea",
            lineAmount: MonetaryAmount.of(750),
            expenseAccountId: "acc-expense-1",
          },
        ],
      },
      { userId: "user-1" },
    );

    expect(result.purchase.totalAmount.value).toBe(750);
    expect(purchaseRepo.updateTxCalls[0]!.options).toEqual({ replaceDetails: true });
  });

  it("validates contact when changing contactId — happy path PROVEEDOR", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);
    contactRepo.preload(buildContact({ id: "c-2" }));

    const result = await service.update(
      ORG,
      draft.id,
      { contactId: "c-2" },
      { userId: "user-1" },
    );

    expect(result.purchase.contactId).toBe("c-2");
  });

  it("throws PurchaseContactInactive when changing to inactive contact", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);
    contactRepo.preload(buildContact({ id: "c-2", isActive: false }));

    await expect(
      service.update(ORG, draft.id, { contactId: "c-2" }, { userId: "user-1" }),
    ).rejects.toThrow(PurchaseContactInactive);
    expect(purchaseRepo.updateTxCalls).toEqual([]);
  });

  it("throws PurchaseContactNotProvider when changing to non-PROVEEDOR contact", async () => {
    const draft = buildDraftPurchase();
    purchaseRepo.preload(draft);
    contactRepo.preload(buildContact({ id: "c-2", type: "CLIENTE" }));

    await expect(
      service.update(ORG, draft.id, { contactId: "c-2" }, { userId: "user-1" }),
    ).rejects.toThrow(PurchaseContactNotProvider);
    expect(purchaseRepo.updateTxCalls).toEqual([]);
  });

  it("throws PurchaseVoidedImmutable when purchase is VOIDED", async () => {
    const voided = Purchase.fromPersistence({
      id: "voided-purchase",
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      status: "VOIDED",
      sequenceNumber: 1,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Anulada",
      referenceNumber: null,
      notes: null,
      totalAmount: MonetaryAmount.of(500),
      ruta: null,
      farmOrigin: null,
      chickenCount: null,
      shrinkagePct: null,
      totalGrossKg: null,
      totalNetKg: null,
      totalShrinkKg: null,
      totalShortageKg: null,
      totalRealNetKg: null,
      journalEntryId: "journal-1",
      payableId: null,
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [],
      payable: null,
    });
    purchaseRepo.preload(voided);

    await expect(
      service.update(ORG, "voided-purchase", { description: "x" }, { userId: "user-1" }),
    ).rejects.toThrow(PurchaseVoidedImmutable);
  });
});

describe("PurchaseService.update — LOCKED branch", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let contactRepo: InMemoryContactRepository;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let uow: InMemoryPurchaseUnitOfWork;
  let service: PurchaseService;

  function buildLockedPurchase(): Purchase {
    return Purchase.fromPersistence({
      id: "locked-purchase",
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      status: "LOCKED",
      sequenceNumber: 1,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Bloqueada",
      referenceNumber: null,
      notes: null,
      totalAmount: MonetaryAmount.of(500),
      ruta: null,
      farmOrigin: null,
      chickenCount: null,
      shrinkagePct: null,
      totalGrossKg: null,
      totalNetKg: null,
      totalShrinkKg: null,
      totalShortageKg: null,
      totalRealNetKg: null,
      journalEntryId: "journal-1",
      payableId: "payable-1",
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [],
      payable: null,
    });
  }

  beforeEach(() => {
    purchaseRepo = new InMemoryPurchaseRepository();
    contactRepo = new InMemoryContactRepository();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    fiscalPeriods.preload("period-1", "OPEN");
    uow = new InMemoryPurchaseUnitOfWork({ purchases: purchaseRepo });
    service = new PurchaseService({
      repo: purchaseRepo,
      contacts: contactRepo,
      uow,
      fiscalPeriods,
    });
  });

  it("succeeds for admin role + period OPEN + 10+ char justification", async () => {
    purchaseRepo.preload(buildLockedPurchase());

    const result = await service.update(
      ORG,
      "locked-purchase",
      { description: "Editada bloqueada" },
      { userId: "user-1", role: "admin", justification: "Corrección de descripción" },
    );

    expect(result.purchase.description).toBe("Editada bloqueada");
    expect(uow.ranContexts).toEqual([
      {
        userId: "user-1",
        organizationId: ORG,
        justification: "Corrección de descripción",
      },
    ]);
  });

  it("throws ForbiddenError when role is not admin/owner", async () => {
    purchaseRepo.preload(buildLockedPurchase());

    await expect(
      service.update(
        ORG,
        "locked-purchase",
        { description: "Editada bloqueada" },
        { userId: "user-1", role: "OPERADOR", justification: "1234567890" },
      ),
    ).rejects.toThrow(ForbiddenError);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws PurchaseLockedEditMissingJustification with requiredMin=10 when OPEN + <10", async () => {
    purchaseRepo.preload(buildLockedPurchase());

    const error = await service
      .update(
        ORG,
        "locked-purchase",
        { description: "x" },
        { userId: "user-1", role: "admin", justification: "corto" },
      )
      .catch((e) => e);

    expect(error).toBeInstanceOf(PurchaseLockedEditMissingJustification);
    expect(error.details).toEqual({ requiredMin: 10 });
    expect(uow.ranContexts).toEqual([]);
  });

  it("requires justification ≥50 chars when period CLOSED", async () => {
    purchaseRepo.preload(buildLockedPurchase());
    fiscalPeriods.preload("period-1", "CLOSED");

    const error = await service
      .update(
        ORG,
        "locked-purchase",
        { description: "x" },
        {
          userId: "user-1",
          role: "owner",
          justification: "Tres veces diez chars exactamente",
        },
      )
      .catch((e) => e);

    expect(error).toBeInstanceOf(PurchaseLockedEditMissingJustification);
    expect(error.details).toEqual({ requiredMin: 50 });
  });

  it("succeeds for owner role + period CLOSED + 50+ char justification", async () => {
    purchaseRepo.preload(buildLockedPurchase());
    fiscalPeriods.preload("period-1", "CLOSED");

    const long =
      "Justificación muy completa que supera los cincuenta caracteres requeridos por compliance";

    const result = await service.update(
      ORG,
      "locked-purchase",
      { description: "Editada en CLOSED" },
      { userId: "user-1", role: "owner", justification: long },
    );

    expect(result.purchase.description).toBe("Editada en CLOSED");
  });

  it("ignores input.details on LOCKED (legacy parity — header only)", async () => {
    purchaseRepo.preload(buildLockedPurchase());

    const result = await service.update(
      ORG,
      "locked-purchase",
      {
        description: "Solo header",
        details: [
          {
            description: "Detalle ignorado",
            lineAmount: MonetaryAmount.of(999),
            expenseAccountId: "acc-x",
          },
        ],
      },
      { userId: "user-1", role: "admin", justification: "Cambio menor de descripción" },
    );

    expect(purchaseRepo.updateTxCalls[0]!.options).toEqual({ replaceDetails: false });
    expect(result.purchase.totalAmount.value).toBe(500);
  });
});

describe("PurchaseService.update — POSTED branch", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let payableRepo: InMemoryPayableRepository;
  let contactRepo: InMemoryContactRepository;
  let accountLookup: InMemoryAccountLookup;
  let orgSettings: InMemoryOrgSettingsReader;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let journalEntryFactory: InMemoryJournalEntryFactory;
  let accountBalances: InMemoryAccountBalancesRepository;
  let ivaBookRegen: InMemoryIvaBookRegenNotifier;
  let uow: InMemoryPurchaseUnitOfWork;
  let service: PurchaseService;

  function buildPostedPurchase(overrides: { payableId?: string | null } = {}): Purchase {
    return Purchase.fromPersistence({
      id: "posted-purchase",
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      status: "POSTED",
      sequenceNumber: 7,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Compra posteada",
      referenceNumber: null,
      notes: null,
      totalAmount: MonetaryAmount.of(1000),
      ruta: null,
      farmOrigin: null,
      chickenCount: null,
      shrinkagePct: null,
      totalGrossKg: null,
      totalNetKg: null,
      totalShrinkKg: null,
      totalShortageKg: null,
      totalRealNetKg: null,
      journalEntryId: "journal-1",
      payableId: overrides.payableId === undefined ? "payable-1" : overrides.payableId,
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [PurchaseDetailFactory("acc-expense-1", 1000)],
      payable: null,
    });
  }

  function PurchaseDetailFactory(expenseAccountId: string, amount: number) {
    return PurchaseDetail.fromPersistence({
      id: `det-${Math.random().toString(36).slice(2, 8)}`,
      purchaseId: "posted-purchase",
      description: "Línea original",
      lineAmount: MonetaryAmount.of(amount),
      order: 0,
      expenseAccountId,
    });
  }

  function buildJournalStub(id: string): Journal {
    return Journal.fromPersistence({
      id,
      organizationId: ORG,
      status: "POSTED",
      number: 7,
      referenceNumber: null,
      date: new Date("2025-01-15"),
      description: "CG-007 - Compra posteada",
      periodId: "period-1",
      voucherTypeId: "voucher-CE",
      contactId: "c-1",
      sourceType: "purchase",
      sourceId: "posted-purchase",
      aiOriginalText: null,
      createdById: "user-1",
      updatedById: null,
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      lines: [],
    });
  }

  function buildExistingPayable(paid: number): Payable {
    return Payable.fromPersistence({
      id: "payable-1",
      organizationId: ORG,
      contactId: "c-1",
      description: "CxP",
      amount: MonetaryAmount.of(1000),
      paid: MonetaryAmount.of(paid),
      balance: MonetaryAmount.of(1000 - paid),
      dueDate: new Date("2025-02-15"),
      status: paid === 0 ? "PENDING" : paid === 1000 ? "PAID" : "PARTIAL",
      sourceType: "purchase",
      sourceId: "posted-purchase",
      journalEntryId: "journal-1",
      notes: null,
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
    });
  }

  beforeEach(() => {
    purchaseRepo = new InMemoryPurchaseRepository();
    payableRepo = new InMemoryPayableRepository();
    contactRepo = new InMemoryContactRepository();
    accountLookup = new InMemoryAccountLookup();
    orgSettings = new InMemoryOrgSettingsReader();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    journalEntryFactory = new InMemoryJournalEntryFactory();
    accountBalances = new InMemoryAccountBalancesRepository();
    ivaBookRegen = new InMemoryIvaBookRegenNotifier();

    contactRepo.preload(
      Contact.fromPersistence({
        id: "c-1",
        organizationId: ORG,
        type: "PROVEEDOR",
        name: "Proveedor Original",
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
      id: "acc-expense-1",
      code: "5.1.5",
      isDetail: true,
      isActive: true,
    });
    fiscalPeriods.preload("period-1", "OPEN");

    uow = new InMemoryPurchaseUnitOfWork({
      purchases: purchaseRepo,
      accountBalances,
      payables: payableRepo,
      journalEntryFactory,
      ivaBookRegenNotifier: ivaBookRegen,
    });

    service = new PurchaseService({
      repo: purchaseRepo,
      payables: payableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
    });
  });

  it("regenerates journal + applies void/post + persists purchase on POSTED edit (header only)", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    const oldJ = buildJournalStub("journal-1");
    const newJ = buildJournalStub("journal-1");
    journalEntryFactory.enqueueRegenPurchase({ old: oldJ, new: newJ });
    payableRepo.preloadPayable(buildExistingPayable(0));

    const result = await service.update(
      ORG,
      purchase.id,
      { description: "Header editada" },
      { userId: "user-1" },
    );

    expect(result.purchase.description).toBe("Header editada");
    expect(journalEntryFactory.regenPurchaseCalls).toHaveLength(1);
    expect(journalEntryFactory.regenPurchaseCalls[0]!.oldJournalId).toBe("journal-1");
    expect(accountBalances.applyVoidCalls).toHaveLength(1);
    expect(accountBalances.applyPostCalls).toHaveLength(1);
    expect(purchaseRepo.updateTxCalls).toHaveLength(1);
  });

  it("recomputes payable amount/paid/balance and updates when payable exists", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    journalEntryFactory.enqueueRegenPurchase({
      old: buildJournalStub("journal-1"),
      new: buildJournalStub("journal-1"),
    });
    payableRepo.preloadPayable(buildExistingPayable(400));

    await service.update(
      ORG,
      purchase.id,
      {
        details: [
          {
            description: "Línea menor",
            lineAmount: MonetaryAmount.of(700),
            expenseAccountId: "acc-expense-1",
          },
        ],
      },
      { userId: "user-1" },
    );

    expect(payableRepo.updateCalls).toHaveLength(1);
    const updated = payableRepo.updateCalls[0]!;
    expect(updated.amount.value).toBe(700);
    expect(updated.paid.value).toBe(400);
    expect(updated.balance.value).toBe(300);
    expect(updated.status).toBe("PARTIAL");
    expect(payableRepo.applyTrimPlanCalls).toEqual([]);
  });

  it("trims allocations LIFO when paid > newTotal", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    journalEntryFactory.enqueueRegenPurchase({
      old: buildJournalStub("journal-1"),
      new: buildJournalStub("journal-1"),
    });
    payableRepo.preloadPayable(buildExistingPayable(900));
    payableRepo.preloadAllocations("payable-1", [
      { id: "a-newest", amount: 500, payment: { date: new Date("2025-03-01") } },
      { id: "a-mid", amount: 400, payment: { date: new Date("2025-02-01") } },
    ]);

    await service.update(
      ORG,
      purchase.id,
      {
        details: [
          {
            description: "Total reducido",
            lineAmount: MonetaryAmount.of(500),
            expenseAccountId: "acc-expense-1",
          },
        ],
      },
      { userId: "user-1" },
    );

    expect(payableRepo.applyTrimPlanCalls).toHaveLength(1);
    const trim = payableRepo.applyTrimPlanCalls[0]!;
    expect(trim.items.map((i) => i.allocationId)).toEqual(["a-newest"]);
    expect(trim.items[0]!.newAmount).toBeCloseTo(100, 2);
  });

  it("emits IVA-aware entry lines when ivaBookRegenNotifier returns a snapshot", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    journalEntryFactory.enqueueRegenPurchase({
      old: buildJournalStub("journal-1"),
      new: buildJournalStub("journal-1"),
    });
    ivaBookRegen.respondWith(purchase.id, {
      baseIvaSujetoCf: 1000,
      dfCfIva: 130,
      importeTotal: 1000,
    });

    await service.update(
      ORG,
      purchase.id,
      { description: "Con IVA" },
      { userId: "user-1" },
    );

    const lines = journalEntryFactory.regenPurchaseCalls[0]!.template.lines;
    // IVA crédito fiscal account 1.1.8 (paridad legacy purchase)
    expect(lines.some((l) => l.accountCode === "1.1.8")).toBe(true);
  });

  it("throws PurchasePeriodClosed when period is CLOSED", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    fiscalPeriods.preload("period-1", "CLOSED");

    await expect(
      service.update(ORG, purchase.id, { description: "x" }, { userId: "user-1" }),
    ).rejects.toThrow(PurchasePeriodClosed);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws PurchaseContactChangeWithAllocations when contactId changes and payable has active allocations", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    payableRepo.preloadAllocations("payable-1", [
      { id: "a-1", amount: 500, payment: { date: new Date("2025-02-01") } },
    ]);
    contactRepo.preload(
      Contact.fromPersistence({
        id: "c-2",
        organizationId: ORG,
        type: "PROVEEDOR",
        name: "Otro",
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
      service.update(ORG, purchase.id, { contactId: "c-2" }, { userId: "user-1" }),
    ).rejects.toThrow(PurchaseContactChangeWithAllocations);
    expect(uow.ranContexts).toEqual([]);
  });

  it("syncs payable.contactId when purchase.contactId changes without active allocations", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    journalEntryFactory.enqueueRegenPurchase({
      old: buildJournalStub("journal-1"),
      new: buildJournalStub("journal-1"),
    });
    payableRepo.preloadPayable(buildExistingPayable(0));
    contactRepo.preload(
      Contact.fromPersistence({
        id: "c-2",
        organizationId: ORG,
        type: "PROVEEDOR",
        name: "Nuevo Proveedor",
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

    await service.update(
      ORG,
      purchase.id,
      { contactId: "c-2" },
      { userId: "user-1" },
    );

    expect(payableRepo.updateCalls).toHaveLength(1);
    expect(payableRepo.updateCalls[0]!.contactId).toBe("c-2");
  });

  it("throws PurchaseAccountNotFound when expense account is not in lookup", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    accountLookup = new InMemoryAccountLookup();
    service = new PurchaseService({
      repo: purchaseRepo,
      payables: payableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
    });

    await expect(
      service.update(ORG, purchase.id, { description: "x" }, { userId: "user-1" }),
    ).rejects.toThrow(PurchaseAccountNotFound);
    expect(uow.ranContexts).toEqual([]);
  });

  it("propagates AuditContext into the UoW", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    journalEntryFactory.enqueueRegenPurchase({
      old: buildJournalStub("journal-1"),
      new: buildJournalStub("journal-1"),
    });

    await service.update(
      ORG,
      purchase.id,
      { description: "x" },
      { userId: "user-99" },
    );

    expect(uow.ranContexts).toEqual([
      { userId: "user-99", organizationId: ORG },
    ]);
  });

  it("skips payable update when purchase.payableId is null", async () => {
    const purchase = buildPostedPurchase({ payableId: null });
    purchaseRepo.preload(purchase);
    journalEntryFactory.enqueueRegenPurchase({
      old: buildJournalStub("journal-1"),
      new: buildJournalStub("journal-1"),
    });

    await service.update(
      ORG,
      purchase.id,
      { description: "x" },
      { userId: "user-1" },
    );

    expect(payableRepo.updateCalls).toEqual([]);
  });
});
