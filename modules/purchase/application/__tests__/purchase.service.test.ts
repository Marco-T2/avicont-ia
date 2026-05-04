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
import {
  PurchaseNotDraft,
  PurchaseVoidedImmutable,
} from "../../domain/errors/purchase-errors";
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
import { InMemoryIvaBookVoidCascade } from "./fakes/in-memory-iva-book-void-cascade";
import { InMemoryJournalEntries } from "./fakes/in-memory-journal-entries.repo";
import { InMemoryJournalEntriesRead } from "./fakes/in-memory-journal-entries-read";

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

  /**
   * Audit-5 D-A3-2 RED — paridad legacy regla #1 invariante D-A3-2.
   *
   * Schema Purchase tiene `purchaseType` discriminator (4 valores: FLETE,
   * POLLO_FAENADO, COMPRA_GENERAL, SERVICIO). Legacy purchase.repository
   * aplicaba filtro `if (filters?.purchaseType) where.purchaseType =
   * filters.purchaseType` antes del `findMany` (post-A3-C8 atomic delete
   * commit 4aa8480). Consumer real:
   * `app/api/organizations/[orgSlug]/purchases/route.ts:23` lee
   * `searchParams.get("purchaseType")` y lo pasa vía
   * `purchaseFiltersSchema.parse` → `purchaseService.list(orgId, filters)`
   * (legacy hoy; cutover POC #11.0c → hex hex-routing dropea silente sin fix).
   *
   * El port `PurchaseFilters` actual NO acepta `purchaseType` — copy-paste
   * shape sale-hex (sale schema sin discriminator) aplicado a purchase sin
   * verificar asimetría legacy. Fake `findAll` honra el contrato del port
   * (no filtra por purchaseType), por eso A2 pasó verde — match
   * `feedback_aspirational_mock_signals_unimplemented_contract` + paralelo
   * directo D-A3-1.
   *
   * Expected RED failure mode: tsc compile-time error TS2353 en
   * `service.list(ORG, { purchaseType: "FLETE" })` porque `PurchaseFilters`
   * no expone el campo. NO runtime assertion fail — el RED se manifiesta en
   * tsc baseline 14 → 15.
   */
  it("filters by purchaseType (paridad legacy regla #1 — discriminator schema 4 PurchaseTypes)", async () => {
    repo.preload(
      buildPurchase({ id: "p1", purchaseType: "FLETE" }),
      buildPurchase({ id: "p2", purchaseType: "FLETE" }),
      buildPurchase({ id: "p3", purchaseType: "COMPRA_GENERAL" }),
    );

    const purchases = await service.list(ORG, { purchaseType: "FLETE" });

    expect(purchases.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
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

  /**
   * Audit-4 D-A3-1 RED — paridad legacy regla #1 invariante D-A3-1.
   *
   * Schema `@@unique([organizationId, purchaseType, sequenceNumber])` + legacy
   * purchase.repository (`where: { organizationId, purchaseType }` filter antes
   * del `MAX(sequenceNumber)+1` — post-A3-C8 atomic delete commit 4aa8480) +
   * Convention §12 sub-prefix determinístico (FL-001 + CG-001 conviven en la
   * misma org sin colisión) imponen secuencias INDEPENDIENTES por purchaseType.
   *
   * El port `getNextSequenceNumberTx(orgId)` actual NO toma purchaseType — copy
   * paste shape sale-hex (sale schema es `@@unique([orgId, sequenceNumber])` puro,
   * 1 secuencia global). Fake stub honra el contrato del port (1 sequence map
   * por-org), por eso A2 pasó verde — match `feedback_aspirational_mock_signals_unimplemented_contract`.
   *
   * Expected RED failure mode: dos posts de purchaseTypes distintos asignan
   * `sequenceNumber=1` y `sequenceNumber=2` (port global) en vez de `1` y `1`
   * (paridad legacy + schema). Aserto final falla con `expected 2 to be 1`.
   */
  it("aloca sequenceNumber independiente por purchaseType (paridad legacy regla #1 — schema @@unique([organizationId, purchaseType, sequenceNumber]))", async () => {
    const flete = buildDraftPurchase({ purchaseType: "FLETE" });
    const compra = buildDraftPurchase({ purchaseType: "COMPRA_GENERAL" });
    purchaseRepo.preload(flete, compra);
    journalEntryFactory.enqueuePurchase(buildJournalStub(), buildJournalStub());

    const fleteResult = await service.post(ORG, flete.id, "user-1");
    expect(fleteResult.purchase.purchaseType).toBe("FLETE");
    expect(fleteResult.purchase.sequenceNumber).toBe(1);

    const compraResult = await service.post(ORG, compra.id, "user-1");
    expect(compraResult.purchase.purchaseType).toBe("COMPRA_GENERAL");
    // CRITICAL: must be 1, NOT 2 — secuencias separadas por type
    expect(compraResult.purchase.sequenceNumber).toBe(1);
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

  function buildLockedPurchase(
    overrides: { createdById?: string } = {},
  ): Purchase {
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
      createdById: overrides.createdById ?? "user-1",
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

  it("replaces details on LOCKED when input.details is present (paridad legacy `purchase.service.ts:710-749`)", async () => {
    purchaseRepo.preload(buildLockedPurchase());

    const result = await service.update(
      ORG,
      "locked-purchase",
      {
        description: "Editada con nuevos detalles",
        details: [
          {
            description: "Nueva línea LOCKED",
            lineAmount: MonetaryAmount.of(999),
            expenseAccountId: "acc-x",
          },
        ],
      },
      {
        userId: "user-1",
        role: "admin",
        justification: "Edición LOCKED con cambio de detalles",
      },
    );

    expect(purchaseRepo.updateTxCalls[0]!.options).toEqual({ replaceDetails: true });
    expect(result.purchase.totalAmount.value).toBe(999);
  });

  it("uses purchase.createdById for audit userId on LOCKED edit (paridad legacy `:741`)", async () => {
    purchaseRepo.preload(buildLockedPurchase({ createdById: "creator-original" }));

    await service.update(
      ORG,
      "locked-purchase",
      { description: "Editada por otro usuario" },
      {
        userId: "editor-current",
        role: "admin",
        justification: "Editor distinto al creador original",
      },
    );

    expect(uow.ranContexts).toEqual([
      {
        userId: "creator-original",
        organizationId: ORG,
        justification: "Editor distinto al creador original",
      },
    ]);
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

describe("PurchaseService.void", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let payableRepo: InMemoryPayableRepository;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let journalEntriesRead: InMemoryJournalEntriesRead;
  let journalEntries: InMemoryJournalEntries;
  let accountBalances: InMemoryAccountBalancesRepository;
  let ivaBookVoid: InMemoryIvaBookVoidCascade;
  let uow: InMemoryPurchaseUnitOfWork;
  let service: PurchaseService;

  function buildPostedPurchase(payableId: string | null = "payable-1"): Purchase {
    return Purchase.fromPersistence({
      id: "purchase-void",
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
      payableId,
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [],
      payable: null,
    });
  }

  function buildLockedPurchase(): Purchase {
    return Purchase.fromPersistence({
      id: "purchase-locked",
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      status: "LOCKED",
      sequenceNumber: 8,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Compra bloqueada",
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
      payableId: null,
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [],
      payable: null,
    });
  }

  function buildJournalStub(): Journal {
    return Journal.fromPersistence({
      id: "journal-1",
      organizationId: ORG,
      status: "POSTED",
      number: 7,
      referenceNumber: null,
      date: new Date("2025-01-15"),
      description: "CG-007",
      periodId: "period-1",
      voucherTypeId: "voucher-CE",
      contactId: "c-1",
      sourceType: "purchase",
      sourceId: "purchase-void",
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
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    journalEntriesRead = new InMemoryJournalEntriesRead();
    journalEntries = new InMemoryJournalEntries();
    accountBalances = new InMemoryAccountBalancesRepository();
    ivaBookVoid = new InMemoryIvaBookVoidCascade();

    fiscalPeriods.preload("period-1", "OPEN");
    journalEntriesRead.preload(buildJournalStub());

    uow = new InMemoryPurchaseUnitOfWork({
      purchases: purchaseRepo,
      journalEntries,
      accountBalances,
      payables: payableRepo,
      ivaBookVoidCascade: ivaBookVoid,
    });

    service = new PurchaseService({
      repo: purchaseRepo,
      payables: payableRepo,
      uow,
      fiscalPeriods,
      journalEntriesRead,
    });
  });

  it("voids a POSTED purchase with cascade journal+balances+IVA but no payable", async () => {
    purchaseRepo.preload(buildPostedPurchase(null));

    const result = await service.void(ORG, "purchase-void", { userId: "user-1" });

    expect(result.purchase.status).toBe("VOIDED");
    expect(purchaseRepo.updateTxCalls).toHaveLength(1);
    expect(ivaBookVoid.calls).toEqual([
      { organizationId: ORG, purchaseId: "purchase-void" },
    ]);
    expect(accountBalances.applyVoidCalls).toHaveLength(1);
  });

  it("reverts active allocations + voids payable + deletes allocations", async () => {
    purchaseRepo.preload(buildPostedPurchase("payable-1"));
    payableRepo.preloadPayable(
      Payable.fromPersistence({
        id: "payable-1",
        organizationId: ORG,
        contactId: "c-1",
        description: "CxP",
        amount: MonetaryAmount.of(1000),
        paid: MonetaryAmount.of(700),
        balance: MonetaryAmount.of(300),
        dueDate: new Date("2025-02-15"),
        status: "PARTIAL",
        sourceType: "purchase",
        sourceId: "purchase-void",
        journalEntryId: "journal-1",
        notes: null,
        createdAt: new Date("2025-01-15"),
        updatedAt: new Date("2025-01-15"),
      }),
    );
    payableRepo.preloadAllocations("payable-1", [
      { id: "a-1", amount: 400, payment: { date: new Date("2025-02-01") } },
      { id: "a-2", amount: 300, payment: { date: new Date("2025-01-25") } },
    ]);

    await service.void(ORG, "purchase-void", { userId: "user-1" });

    expect(payableRepo.applyTrimPlanCalls).toHaveLength(1);
    const trim = payableRepo.applyTrimPlanCalls[0]!;
    expect(trim.items.map((i) => i.newAmount)).toEqual([0, 0]);
    expect(payableRepo.updateCalls).toHaveLength(1);
    const finalPayable = payableRepo.updateCalls[0]!;
    expect(finalPayable.status).toBe("VOIDED");
  });

  it("voids LOCKED purchase when role admin + period OPEN + 10+ char justification", async () => {
    purchaseRepo.preload(buildLockedPurchase());

    const result = await service.void(ORG, "purchase-locked", {
      userId: "user-1",
      role: "admin",
      justification: "Anulación administrativa por error de captura",
    });

    expect(result.purchase.status).toBe("VOIDED");
    expect(uow.ranContexts[0]!.justification).toBe(
      "Anulación administrativa por error de captura",
    );
  });

  it("throws ForbiddenError voiding LOCKED with non-admin role", async () => {
    purchaseRepo.preload(buildLockedPurchase());

    await expect(
      service.void(ORG, "purchase-locked", {
        userId: "user-1",
        role: "OPERADOR",
        justification: "Suficiente largo",
      }),
    ).rejects.toThrow(ForbiddenError);
    expect(uow.ranContexts).toEqual([]);
  });

  it("throws PurchaseLockedEditMissingJustification with requiredMin=50 when LOCKED+CLOSED period", async () => {
    purchaseRepo.preload(buildLockedPurchase());
    fiscalPeriods.preload("period-1", "CLOSED");

    const error = await service
      .void(ORG, "purchase-locked", {
        userId: "user-1",
        role: "owner",
        justification: "Justificación corta de menos de cincuenta",
      })
      .catch((e) => e);

    expect(error).toBeInstanceOf(PurchaseLockedEditMissingJustification);
    expect(error.details).toEqual({ requiredMin: 50 });
  });

  it("throws PurchaseVoidedImmutable when purchase already VOIDED (delegated to domain)", async () => {
    const voided = Purchase.fromPersistence({
      id: "purchase-already-voided",
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      status: "VOIDED",
      sequenceNumber: 9,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Ya anulada",
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
      payableId: null,
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [],
      payable: null,
    });
    purchaseRepo.preload(voided);

    await expect(
      service.void(ORG, "purchase-already-voided", { userId: "user-1" }),
    ).rejects.toThrow(PurchaseVoidedImmutable);
  });
});

describe("PurchaseService.delete", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let service: PurchaseService;

  beforeEach(() => {
    purchaseRepo = new InMemoryPurchaseRepository();
    service = new PurchaseService({ repo: purchaseRepo });
  });

  it("hard-deletes a DRAFT purchase", async () => {
    const draft = Purchase.createDraft({
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      contactId: "c-1",
      periodId: "period-1",
      date: new Date("2025-01-15"),
      description: "DRAFT",
      createdById: "user-1",
      details: [
        {
          description: "Línea",
          lineAmount: MonetaryAmount.of(100),
          expenseAccountId: "acc-1",
        },
      ],
    });
    purchaseRepo.preload(draft);

    await service.delete(ORG, draft.id);

    expect(purchaseRepo.deleteTxCalls).toEqual([
      { organizationId: ORG, id: draft.id },
    ]);
  });

  it("throws PurchaseNotDraft when purchase is POSTED", async () => {
    const posted = Purchase.fromPersistence({
      id: "posted",
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      status: "POSTED",
      sequenceNumber: 1,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Posteada",
      referenceNumber: null,
      notes: null,
      totalAmount: MonetaryAmount.of(100),
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
      payableId: null,
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [],
      payable: null,
    });
    purchaseRepo.preload(posted);

    await expect(service.delete(ORG, "posted")).rejects.toThrow(
      PurchaseNotDraft,
    );
  });
});

describe("PurchaseService.regenerateJournalForIvaChange", () => {
  let purchaseRepo: InMemoryPurchaseRepository;
  let accountLookup: InMemoryAccountLookup;
  let orgSettings: InMemoryOrgSettingsReader;
  let ivaBookReader: InMemoryIvaBookReader;
  let journalEntryFactory: InMemoryJournalEntryFactory;
  let accountBalances: InMemoryAccountBalancesRepository;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let uow: InMemoryPurchaseUnitOfWork;
  let service: PurchaseService;

  function buildPostedPurchase(): Purchase {
    return Purchase.fromPersistence({
      id: "purchase-iva",
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      status: "POSTED",
      sequenceNumber: 5,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Purchase con IVA",
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
      journalEntryId: "journal-iva",
      payableId: "payable-1",
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [
        PurchaseDetail.fromPersistence({
          id: "det-1",
          purchaseId: "purchase-iva",
          description: "Item",
          lineAmount: MonetaryAmount.of(1000),
          order: 0,
          expenseAccountId: "acc-expense-1",
        }),
      ],
      payable: null,
    });
  }

  function buildJournalStub(id: string): Journal {
    return Journal.fromPersistence({
      id,
      organizationId: ORG,
      status: "POSTED",
      number: 5,
      referenceNumber: null,
      date: new Date("2025-01-15"),
      description: "CG-005",
      periodId: "period-1",
      voucherTypeId: "voucher-CE",
      contactId: "c-1",
      sourceType: "purchase",
      sourceId: "purchase-iva",
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
    accountLookup = new InMemoryAccountLookup();
    orgSettings = new InMemoryOrgSettingsReader();
    ivaBookReader = new InMemoryIvaBookReader();
    journalEntryFactory = new InMemoryJournalEntryFactory();
    accountBalances = new InMemoryAccountBalancesRepository();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    fiscalPeriods.preload("period-1", "OPEN");

    accountLookup.preload({
      id: "acc-expense-1",
      code: "5.1.5",
      isDetail: true,
      isActive: true,
    });
    orgSettings.preload(
      ORG,
      OrgSettings.createDefault({
        id: "settings-1",
        organizationId: ORG,
        createdAt: new Date("2025-01-01"),
        updatedAt: new Date("2025-01-01"),
      }),
    );

    uow = new InMemoryPurchaseUnitOfWork({
      purchases: purchaseRepo,
      accountBalances,
      journalEntryFactory,
    });

    service = new PurchaseService({
      repo: purchaseRepo,
      uow,
      accountLookup,
      orgSettings,
      ivaBookReader,
      fiscalPeriods,
    });
  });

  it("regenerates journal with IVA snapshot lines + applyVoid old + applyPost new", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    ivaBookReader.preload(purchase.id, {
      id: "iva-1",
      purchaseId: purchase.id,
      ivaRate: 0.13,
      ivaAmount: 130,
      netAmount: 1000,
      exentos: 0,
    });
    journalEntryFactory.enqueueRegenPurchase({
      old: buildJournalStub("journal-iva"),
      new: buildJournalStub("journal-iva"),
    });

    const result = await service.regenerateJournalForIvaChange(
      ORG,
      purchase.id,
      "user-1",
    );

    expect(result.purchase.id).toBe(purchase.id);
    expect(journalEntryFactory.regenPurchaseCalls).toHaveLength(1);
    const lines = journalEntryFactory.regenPurchaseCalls[0]!.template.lines;
    // IVA crédito fiscal account 1.1.8 (paridad legacy purchase)
    expect(lines.some((l) => l.accountCode === "1.1.8")).toBe(true);
    expect(accountBalances.applyVoidCalls).toHaveLength(1);
    expect(accountBalances.applyPostCalls).toHaveLength(1);
  });

  it("regenerates journal without IVA when no active IVA snapshot", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    journalEntryFactory.enqueueRegenPurchase({
      old: buildJournalStub("journal-iva"),
      new: buildJournalStub("journal-iva"),
    });

    await service.regenerateJournalForIvaChange(ORG, purchase.id, "user-1");

    const lines = journalEntryFactory.regenPurchaseCalls[0]!.template.lines;
    expect(lines.some((l) => l.accountCode === "1.1.8")).toBe(false);
  });

  it("throws NotFoundError when purchase has no journalEntryId", async () => {
    const purchase = Purchase.fromPersistence({
      id: "no-journal",
      organizationId: ORG,
      purchaseType: "COMPRA_GENERAL",
      status: "POSTED",
      sequenceNumber: 1,
      date: new Date("2025-01-15"),
      contactId: "c-1",
      periodId: "period-1",
      description: "Sin journal",
      referenceNumber: null,
      notes: null,
      totalAmount: MonetaryAmount.of(100),
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
      payableId: null,
      createdById: "user-1",
      createdAt: new Date("2025-01-15"),
      updatedAt: new Date("2025-01-15"),
      details: [],
      payable: null,
    });
    purchaseRepo.preload(purchase);

    await expect(
      service.regenerateJournalForIvaChange(ORG, "no-journal", "user-1"),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws PurchaseAccountNotFound when expense account not in lookup (CG)", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    accountLookup = new InMemoryAccountLookup();
    service = new PurchaseService({
      repo: purchaseRepo,
      uow,
      accountLookup,
      orgSettings,
      ivaBookReader,
      fiscalPeriods,
    });

    await expect(
      service.regenerateJournalForIvaChange(ORG, purchase.id, "user-1"),
    ).rejects.toThrow(PurchaseAccountNotFound);
  });

  it("throws PurchasePeriodClosed when period is CLOSED (paridad legacy `:1238-1240` race protection)", async () => {
    const purchase = buildPostedPurchase();
    purchaseRepo.preload(purchase);
    fiscalPeriods.preload("period-1", "CLOSED");

    await expect(
      service.regenerateJournalForIvaChange(ORG, purchase.id, "user-1"),
    ).rejects.toThrow(PurchasePeriodClosed);
  });
});
