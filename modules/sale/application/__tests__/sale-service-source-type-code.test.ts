/**
 * T-07 RED — glosa-enriquecida-ventas-cobros Phase 1.
 *
 * Asserts that `SaleService.post` passes `sourceTypeCode: "VG"` when calling
 * `receivables.createTx` (REQ-GE-5 Scenario 5.1; design D8).
 *
 * Expected FAIL (RED): sale.service.ts currently does NOT include
 * `sourceTypeCode` in the `createTx` payload — the assertion on the captured
 * args object will fail with `undefined`.
 *
 * Wiring fixtures copied from `sale.service.test.ts` (POST flow setup);
 * this is an isolated test file to keep the RED/GREEN cycle scoped.
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
    operationalDocTypeId: null,
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

describe("SaleService.post — passes sourceTypeCode 'VG' to receivables.createTx (T-07)", () => {
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
  let createTxCalls: Array<{ sourceTypeCode?: string | null }>;

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

    createTxCalls = [];
    // Stub createTx to capture all call args
    (receivableRepo as unknown as {
      createTx: (
        tx: unknown,
        data: { sourceId: string; sourceTypeCode?: string | null },
      ) => Promise<{ id: string }>;
    }).createTx = async (_tx, data) => {
      createTxCalls.push(data);
      return { id: `receivable-${data.sourceId}` };
    };

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

  it("createTx is called with sourceTypeCode: 'VG' on POST", async () => {
    const draft = buildDraftSale();
    saleRepo.preload(draft);
    journalEntryFactory.enqueue(buildJournalStub());

    await service.post(ORG, draft.id, "user-1");

    expect(createTxCalls).toHaveLength(1);
    expect(createTxCalls[0]!.sourceTypeCode).toBe("VG");
  });
});
