/**
 * payments.service.createAndPost wires buildPaymentGlosa into
 * JournalEntry.description for every COBRO post (simplificación post-archive
 * F4 — descriptionOverride flag eliminado, builder canónico siempre).
 *
 * REQ-GE-2 scenarios 2.1-2.7 are exercised at the domain builder layer
 * (modules/payment/domain/__tests__/payment-glosa-builder.test.ts). This file
 * proves the application-layer wiring: the right contact + per-allocation
 * metadata flow into buildPaymentGlosa and the output reaches JE.description.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { PaymentsService, type CreatePaymentServiceInput } from "../payments.service";
import {
  FakeReceivablesPort,
  FakePayablesPort,
  FakeOrgSettingsReadPort,
  FakeFiscalPeriodsReadPort,
  FakeAccountingPort,
  FakeAccountBalancesPort,
  FakeContactReadPort,
} from "./fakes/fake-ports";
import { InMemoryPaymentRepository } from "./fakes/in-memory-payment.repository";
import type { JournalEntrySnapshot } from "../../domain/ports/accounting.port";

const ORG = "org-1";
const USER = "user-1";
const CONTACT = "contact-marco";
const PERIOD_OPEN = "period-open";

function makeEntry(overrides: Partial<JournalEntrySnapshot> = {}): JournalEntrySnapshot {
  return {
    id: overrides.id ?? "entry-1",
    organizationId: overrides.organizationId ?? ORG,
    periodId: overrides.periodId ?? PERIOD_OPEN,
    lines: overrides.lines ?? [
      {
        accountId: "acct-caja",
        debit: 200,
        credit: 0,
        contactId: null,
        accountNature: "DEBIT",
      },
      {
        accountId: "acct-cxc",
        debit: 0,
        credit: 200,
        contactId: CONTACT,
        accountNature: "DEBIT",
      },
    ],
  };
}

interface Bench {
  repo: InMemoryPaymentRepository;
  receivables: FakeReceivablesPort;
  payables: FakePayablesPort;
  orgSettings: FakeOrgSettingsReadPort;
  fiscalPeriods: FakeFiscalPeriodsReadPort;
  accounting: FakeAccountingPort;
  accountBalances: FakeAccountBalancesPort;
  contacts: FakeContactReadPort;
  svc: PaymentsService;
}

function makeBench(): Bench {
  const repo = new InMemoryPaymentRepository();
  const receivables = new FakeReceivablesPort();
  const payables = new FakePayablesPort();
  const orgSettings = new FakeOrgSettingsReadPort();
  const fiscalPeriods = new FakeFiscalPeriodsReadPort();
  const accounting = new FakeAccountingPort();
  const accountBalances = new FakeAccountBalancesPort();
  const contacts = new FakeContactReadPort();
  fiscalPeriods.periods.set(PERIOD_OPEN, {
    id: PERIOD_OPEN,
    status: "OPEN",
  });
  contacts.types.set(CONTACT, "CLIENTE");
  contacts.names.set(CONTACT, "Marco");
  const svc = new PaymentsService({
    repo,
    receivables,
    payables,
    orgSettings,
    fiscalPeriods,
    accounting,
    accountBalances,
    contacts,
  });
  return {
    repo,
    receivables,
    payables,
    orgSettings,
    fiscalPeriods,
    accounting,
    accountBalances,
    contacts,
    svc,
  };
}

function baseCobro(
  override: Partial<CreatePaymentServiceInput> = {},
): CreatePaymentServiceInput {
  return {
    method: override.method ?? "EFECTIVO",
    date: override.date ?? new Date("2026-05-19T00:00:00Z"),
    amount: override.amount ?? 200,
    description: override.description ?? "user-typed cobro text",
    periodId: override.periodId ?? PERIOD_OPEN,
    contactId: override.contactId ?? CONTACT,
    direction: override.direction,
    referenceNumber: override.referenceNumber,
    accountCode: override.accountCode,
    operationalDocTypeId: override.operationalDocTypeId,
    notes: override.notes,
    allocations: override.allocations ?? [],
    creditSources: override.creditSources,
  };
}

describe("PaymentsService.createAndPost — glosa builder wiring", () => {
  let bench: Bench;

  beforeEach(() => {
    bench = makeBench();
  });

  it("COBRO single allocation: JE.description = buildPaymentGlosa output (REQ-GE-2 Scenario 2.1)", async () => {
    bench.receivables.status.set("rec-1", "PENDING");
    bench.receivables.glosaMeta.set("rec-1", {
      sourceTypeCode: "VG",
      referenceNumber: "45",
      sourceDate: new Date(2026, 4, 17),
    });
    bench.accounting.defaultEntry = makeEntry({ id: "entry-1" });

    await bench.svc.createAndPost(
      ORG,
      USER,
      baseCobro({
        amount: 200,
        allocations: [{ receivableId: "rec-1", amount: 200 }],
      }),
    );

    expect(bench.accounting.generateCalls).toHaveLength(1);
    expect(bench.accounting.generateCalls[0]!.description).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00: VG-45 del 17/05",
    );
  });

  it("COBRO multi allocation (REQ-GE-2 Scenario 2.2)", async () => {
    bench.receivables.status.set("rec-1", "PENDING");
    bench.receivables.status.set("rec-2", "PENDING");
    bench.receivables.glosaMeta.set("rec-1", {
      sourceTypeCode: "VG",
      referenceNumber: "45",
      sourceDate: new Date(2026, 4, 17),
    });
    bench.receivables.glosaMeta.set("rec-2", {
      sourceTypeCode: "ND",
      referenceNumber: "63",
      sourceDate: new Date(2026, 4, 18),
    });
    bench.accounting.defaultEntry = makeEntry({ id: "entry-2" });

    await bench.svc.createAndPost(
      ORG,
      USER,
      baseCobro({
        amount: 200,
        date: new Date(2026, 4, 19),
        allocations: [
          { receivableId: "rec-1", amount: 100 },
          { receivableId: "rec-2", amount: 100 },
        ],
      }),
    );

    expect(bench.accounting.generateCalls[0]!.description).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00: VG-45 del 17/05 | ND-63 del 18/05",
    );
  });

  it("COBRO NULL sourceTypeCode → DOC fallback (REQ-GE-2 Scenario 2.5)", async () => {
    bench.receivables.status.set("rec-orphan", "PENDING");
    bench.receivables.glosaMeta.set("rec-orphan", {
      sourceTypeCode: null,
      referenceNumber: "77",
      sourceDate: new Date(2026, 4, 17),
    });
    bench.accounting.defaultEntry = makeEntry({ id: "entry-3" });

    await bench.svc.createAndPost(
      ORG,
      USER,
      baseCobro({
        amount: 200,
        allocations: [{ receivableId: "rec-orphan", amount: 200 }],
      }),
    );

    expect(bench.accounting.generateCalls[0]!.description).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00: DOC-77 del 17/05",
    );
  });

  it("COBRO empty allocations: no doc-list suffix (REQ-GE-2 Scenario 2.4)", async () => {
    bench.accounting.defaultEntry = makeEntry({ id: "entry-4" });

    await bench.svc.createAndPost(
      ORG,
      USER,
      baseCobro({
        amount: 200,
        allocations: [],
      }),
    );

    expect(bench.accounting.generateCalls[0]!.description).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00",
    );
  });

  it("COBRO builder canónico — ignora user-typed description, builder gana siempre", async () => {
    bench.accounting.defaultEntry = makeEntry({ id: "entry-5" });

    await bench.svc.createAndPost(
      ORG,
      USER,
      baseCobro({
        amount: 200,
        description: "user override exact text",
        allocations: [],
      }),
    );

    expect(bench.accounting.generateCalls[0]!.description).toBe(
      "COBRO EFECTIVO: Marco Bs. 200,00",
    );
  });
});
