/**
 * sale.service.post + createAndPost wire buildSaleGlosa into
 * JournalEntry.description on every post (simplificación post-archive F4 —
 * descriptionOverride flag eliminado, builder canónico siempre).
 *
 * REQ-GE-1 acceptance scenarios 1.1/1.2/1.4 are exercised at the domain
 * builder layer (modules/sale/domain/__tests__/sale-glosa-builder.test.ts).
 * This file proves the application-layer wiring is correct: the right inputs
 * flow into buildSaleGlosa and the output reaches JE.description.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Contact } from "@/modules/contacts/domain/contact.entity";
import { PaymentTermsDays } from "@/modules/contacts/domain/value-objects/payment-terms-days";
import { Journal } from "@/modules/accounting/domain/journal.entity";
import { OrgSettings } from "@/modules/org-settings/domain/org-settings.entity";
import { Sale } from "../../domain/sale.entity";
import { SaleService } from "../sale.service";
import { InMemoryContactRepository } from "./fakes/in-memory-contact.repository";
import { InMemorySaleRepository } from "./fakes/in-memory-sale.repository";
import { InMemorySaleUnitOfWork } from "./fakes/in-memory-sale-unit-of-work";
import { InMemoryReceivableRepository } from "./fakes/in-memory-receivable.repository";
import { InMemoryAccountLookup } from "./fakes/in-memory-account-lookup";
import { InMemoryAccountBalancesRepository } from "./fakes/in-memory-account-balances.repo";
import { InMemoryFiscalPeriodsRead } from "./fakes/in-memory-fiscal-periods-read";
import { InMemoryJournalEntryFactory } from "./fakes/in-memory-journal-entry-factory";
import { InMemoryOrgSettingsReader } from "./fakes/in-memory-org-settings-reader";
import { InMemorySalePermissions } from "./fakes/in-memory-sale-permissions";

const ORG = "org-1";

describe("SaleService.post — glosa builder wiring (T-19/T-20)", () => {
  let saleRepo: InMemorySaleRepository;
  let receivableRepo: InMemoryReceivableRepository;
  let contactRepo: InMemoryContactRepository;
  let accountLookup: InMemoryAccountLookup;
  let orgSettings: InMemoryOrgSettingsReader;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let journalEntryFactory: InMemoryJournalEntryFactory;
  let accountBalances: InMemoryAccountBalancesRepository;
  let uow: InMemorySaleUnitOfWork;
  let service: SaleService;

  function buildPostContact(): Contact {
    return Contact.fromPersistence({
      id: "c-1",
      organizationId: ORG,
      type: "CLIENTE",
      name: "Pollería Don Pepe",
      nit: null,
      email: null,
      phone: null,
      address: null,
      paymentTermsDays: PaymentTermsDays.of(30),
      creditLimit: null,
      isActive: true,
      createdAt: new Date("2026-05-15"),
      updatedAt: new Date("2026-05-15"),
    });
  }

  function buildDefaultSettings(): OrgSettings {
    return OrgSettings.createDefault({
      id: "settings-1",
      organizationId: ORG,
      createdAt: new Date("2026-05-15"),
      updatedAt: new Date("2026-05-15"),
    });
  }

  function buildDraftSale(): Sale {
    return Sale.createDraft({
      organizationId: ORG,
      contactId: "c-1",
      periodId: "period-1",
      date: new Date("2026-05-17"),
      description: "raw user text to be ignored by builder path",
      createdById: "user-1",
      referenceNumber: 99,
      details: [
        {
          description: "Pollo faenado x 20kg",
          lineAmount: MonetaryAmount.of(200),
          incomeAccountId: "acc-income-1",
        },
        {
          description: "servicio Flete",
          lineAmount: MonetaryAmount.of(120),
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
      operationalDocTypeId: null,
      date: new Date("2026-05-17"),
      description: "",
      periodId: "period-1",
      voucherTypeId: "voucher-CI",
      contactId: "c-1",
      sourceType: "sale",
      sourceId: "sale-1",
      aiOriginalText: null,
      createdById: "user-1",
      updatedById: null,
      createdAt: new Date("2026-05-17"),
      updatedAt: new Date("2026-05-17"),
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

    (receivableRepo as unknown as {
      createTx: (tx: unknown, data: { sourceId: string }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => ({ id: `receivable-${data.sourceId}` });

    uow = new InMemorySaleUnitOfWork({
      sales: saleRepo,
      accountBalances,
      receivables: receivableRepo,
      journalEntryFactory,
    });

    service = new SaleService({
      repo: saleRepo,
      receivables: receivableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
    });
  });

  it("post: JE.description = buildSaleGlosa output (REQ-GE-1 1.2 + 1.4)", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    await service.post(ORG, draft.id, "user-1");

    expect(journalEntryFactory.calls).toHaveLength(1);
    expect(journalEntryFactory.calls[0]!.description).toBe(
      "VENTA: Pollería Don Pepe VG-99 por Bs. 320,00 (Pollo faenado x 20kg | servicio Flete)",
    );
  });

  it("post: AR.description matches JE.description (consistency)", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    let capturedArDescription: string | undefined;
    (receivableRepo as unknown as {
      createTx: (tx: unknown, data: { sourceId: string; description: string }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => {
      capturedArDescription = data.description;
      return { id: `receivable-${data.sourceId}` };
    };

    await service.post(ORG, draft.id, "user-1");

    expect(capturedArDescription).toBe(
      "VENTA: Pollería Don Pepe VG-99 por Bs. 320,00 (Pollo faenado x 20kg | servicio Flete)",
    );
  });

  it("post: builder canónico ignora la description user-typed del Sale", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    await service.post(ORG, draft.id, "user-1");

    // El sale.description en buildDraftSale es "raw user text..." pero el
    // builder produce la glosa canónica — no se respeta el passthrough viejo.
    expect(journalEntryFactory.calls[0]!.description).not.toBe(
      "raw user text to be ignored by builder path",
    );
  });
});

describe("SaleService.createAndPost — glosa builder wiring", () => {
  let saleRepo: InMemorySaleRepository;
  let receivableRepo: InMemoryReceivableRepository;
  let contactRepo: InMemoryContactRepository;
  let accountLookup: InMemoryAccountLookup;
  let orgSettings: InMemoryOrgSettingsReader;
  let fiscalPeriods: InMemoryFiscalPeriodsRead;
  let journalEntryFactory: InMemoryJournalEntryFactory;
  let accountBalances: InMemoryAccountBalancesRepository;
  let salePermissions: InMemorySalePermissions;
  let uow: InMemorySaleUnitOfWork;
  let service: SaleService;

  function buildPostContact(): Contact {
    return Contact.fromPersistence({
      id: "c-1",
      organizationId: ORG,
      type: "CLIENTE",
      name: "Pollería Don Pepe",
      nit: null,
      email: null,
      phone: null,
      address: null,
      paymentTermsDays: PaymentTermsDays.of(30),
      creditLimit: null,
      isActive: true,
      createdAt: new Date("2026-05-15"),
      updatedAt: new Date("2026-05-15"),
    });
  }

  function buildDefaultSettings(): OrgSettings {
    return OrgSettings.createDefault({
      id: "settings-1",
      organizationId: ORG,
      createdAt: new Date("2026-05-15"),
      updatedAt: new Date("2026-05-15"),
    });
  }

  function buildJournalStub(): Journal {
    return Journal.fromPersistence({
      id: "journal-1",
      organizationId: ORG,
      status: "POSTED",
      number: 1,
      referenceNumber: null,
      operationalDocTypeId: null,
      date: new Date("2026-05-17"),
      description: "",
      periodId: "period-1",
      voucherTypeId: "voucher-CI",
      contactId: "c-1",
      sourceType: "sale",
      sourceId: "sale-1",
      aiOriginalText: null,
      createdById: "user-1",
      updatedById: null,
      createdAt: new Date("2026-05-17"),
      updatedAt: new Date("2026-05-17"),
      lines: [],
    });
  }

  const baseInput = () => ({
    contactId: "c-1",
    periodId: "period-1",
    date: new Date("2026-05-17"),
    description: "raw user text to be ignored by builder path",
    referenceNumber: 99,
    details: [
      {
        description: "Pollo faenado x 20kg",
        lineAmount: MonetaryAmount.of(200),
        incomeAccountId: "acc-income-1",
      },
      {
        description: "servicio Flete",
        lineAmount: MonetaryAmount.of(120),
        incomeAccountId: "acc-income-1",
      },
    ],
  });

  beforeEach(() => {
    saleRepo = new InMemorySaleRepository();
    receivableRepo = new InMemoryReceivableRepository();
    contactRepo = new InMemoryContactRepository();
    accountLookup = new InMemoryAccountLookup();
    orgSettings = new InMemoryOrgSettingsReader();
    fiscalPeriods = new InMemoryFiscalPeriodsRead();
    journalEntryFactory = new InMemoryJournalEntryFactory();
    accountBalances = new InMemoryAccountBalancesRepository();
    salePermissions = new InMemorySalePermissions();

    contactRepo.preload(buildPostContact());
    orgSettings.preload(ORG, buildDefaultSettings());
    accountLookup.preload({
      id: "acc-income-1",
      code: "4.1.1",
      isDetail: true,
      isActive: true,
    });
    fiscalPeriods.preload("period-1", "OPEN");
    salePermissions.allow("ADMIN");

    (receivableRepo as unknown as {
      createTx: (tx: unknown, data: { sourceId: string }) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => ({ id: `receivable-${data.sourceId}` });

    uow = new InMemorySaleUnitOfWork({
      sales: saleRepo,
      accountBalances,
      receivables: receivableRepo,
      journalEntryFactory,
    });

    service = new SaleService({
      repo: saleRepo,
      receivables: receivableRepo,
      contacts: contactRepo,
      uow,
      accountLookup,
      orgSettings,
      fiscalPeriods,
      salePermissions,
    });
  });

  it("createAndPost: JE.description = buildSaleGlosa output (REQ-GE-1)", async () => {
    journalEntryFactory.enqueue(buildJournalStub());

    await service.createAndPost(
      ORG,
      baseInput(),
      { userId: "user-1", role: "ADMIN" },
    );

    expect(journalEntryFactory.calls).toHaveLength(1);
    expect(journalEntryFactory.calls[0]!.description).toBe(
      "VENTA: Pollería Don Pepe VG-99 por Bs. 320,00 (Pollo faenado x 20kg | servicio Flete)",
    );
  });

  it("createAndPost: builder canónico ignora user-typed description", async () => {
    journalEntryFactory.enqueue(buildJournalStub());

    await service.createAndPost(ORG, baseInput(), {
      userId: "user-1",
      role: "ADMIN",
    });

    expect(journalEntryFactory.calls[0]!.description).not.toBe(
      "raw user text to be ignored by builder path",
    );
  });
});
