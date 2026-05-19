/**
 * T-19/T-20: sale.service.post wires buildSaleGlosa into JournalEntry.description
 * when `descriptionOverride === false` (explicit opt-in).
 *
 * Default behavior (descriptionOverride undefined or true) preserves the legacy
 * passthrough described by REQ-DISPLAY-3 — see
 *   modules/sale/application/__tests__/sale.service.test.ts:632
 * which asserts JE.description === sale.description verbatim. That contract is
 * NOT broken here.
 *
 * REQ-GE-1 acceptance scenarios 1.1/1.2/1.4 are exercised at the domain
 * builder layer (modules/sale/domain/__tests__/sale-glosa-builder.test.ts).
 * This file proves the application-layer wiring is correct: the right inputs
 * flow into buildSaleGlosa and the output reaches JE.description.
 *
 * Declared RED failure mode (pre-T-20 GREEN): JE.description equals
 * "Venta builder test" (sale entity's raw description) — service does not yet
 * call buildSaleGlosa under any flag. Assertions on the builder-shaped string
 * fail with strings differing.
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

  it("descriptionOverride=false: JE.description = buildSaleGlosa output (REQ-GE-1 1.2 + 1.4)", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    await service.post(ORG, draft.id, "user-1", {
      descriptionOverride: false,
    });

    expect(journalEntryFactory.calls).toHaveLength(1);
    expect(journalEntryFactory.calls[0]!.description).toBe(
      "VENTA: Pollería Don Pepe VG-99 por Bs. 320,00 (Pollo faenado x 20kg | servicio Flete)",
    );
  });

  it("descriptionOverride=false: AR.description matches JE.description (consistency)", async () => {
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

    await service.post(ORG, draft.id, "user-1", {
      descriptionOverride: false,
    });

    expect(capturedArDescription).toBe(
      "VENTA: Pollería Don Pepe VG-99 por Bs. 320,00 (Pollo faenado x 20kg | servicio Flete)",
    );
  });

  it("descriptionOverride=true: JE.description = sale.description (legacy passthrough preserved — Scenario 1.3)", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    await service.post(ORG, draft.id, "user-1", {
      descriptionOverride: true,
    });

    expect(journalEntryFactory.calls[0]!.description).toBe(
      "raw user text to be ignored by builder path",
    );
  });

  it("options omitted: legacy passthrough preserved (back-compat default)", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    await service.post(ORG, draft.id, "user-1");

    // Existing sale.service.test.ts line 639 sister contract.
    expect(journalEntryFactory.calls[0]!.description).toBe(
      "raw user text to be ignored by builder path",
    );
  });
});
