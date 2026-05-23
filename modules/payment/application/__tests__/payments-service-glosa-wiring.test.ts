/**
 * REQ-PAY-5 (W-2) — glosa is CLIENT-AUTHORITATIVE on both create and edit.
 *
 * BEHAVIOR CHANGE (W-2 accepted): the server previously rebuilt COBRO glosa
 * server-side via findGlosaMetaTx + buildPaymentGlosa (real receivable metadata).
 * That server-side rebuild is REMOVED per design §7 + spec REQ-PAY-5. The client
 * computes buildPaymentGlosa and sends the result as payment.description; the
 * server persists it as-is.
 *
 * APPROVAL-TESTING CONVERSION (Phase 8, Tanda 5):
 * All 5 tests in this file previously asserted the SERVER-REBUILT glosa string
 * (builder output from real metadata). They are converted to assert that the
 * SERVICE PASSES THROUGH the client-provided description unchanged. The domain
 * builder (payment-glosa-builder.ts) is still tested at
 * modules/payment/domain/__tests__/payment-glosa-builder.test.ts; this file no
 * longer duplicates that coverage.
 *
 * SURFACED: 5 tests converted (approval-testing):
 *   1. COBRO single allocation — was: "COBRO EFECTIVO: Marco Bs. 200,00: VG-45 del 17/05"
 *      now: client-provided "user-typed cobro text"
 *   2. COBRO multi allocation — was: builder multi-alloc string; now: client passthrough
 *   3. COBRO NULL sourceTypeCode — was: "COBRO EFECTIVO: Marco Bs. 200,00: DOC-77 del 17/05"
 *      now: client passthrough
 *   4. COBRO empty allocations — was: "COBRO EFECTIVO: Marco Bs. 200,00"; now: client passthrough
 *   5. "builder gana siempre" — INVERTED: client now wins, not the builder; "user override exact text"
 *      is the persisted description.
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
  FakeCreditConsumptionPort,
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
  const creditConsumption = new FakeCreditConsumptionPort();
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
    creditConsumption,
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

describe("PaymentsService.createAndPost — glosa client-authoritative (REQ-PAY-5, W-2)", () => {
  let bench: Bench;

  beforeEach(() => {
    bench = makeBench();
  });

  // CONVERTED (approval-testing): was asserting server-rebuilt builder output.
  // After W-2: the service passes through payment.description unchanged.
  it("COBRO single allocation: JE.description = client-provided description (REQ-PAY-5 client-authoritative)", async () => {
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
    // W-2: server uses payment.description (client-provided), not server-rebuilt builder output.
    expect(bench.accounting.generateCalls[0]!.description).toBe("user-typed cobro text");
  });

  // CONVERTED (approval-testing): multi-allocation — client passthrough.
  it("COBRO multi allocation: JE.description = client-provided description (REQ-PAY-5 client-authoritative)", async () => {
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

    // W-2: server uses payment.description (client-provided), not server-rebuilt output.
    expect(bench.accounting.generateCalls[0]!.description).toBe("user-typed cobro text");
  });

  // CONVERTED (approval-testing): NULL sourceTypeCode path — client passthrough.
  it("COBRO NULL sourceTypeCode: JE.description = client-provided description (REQ-PAY-5 client-authoritative)", async () => {
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

    // W-2: server uses payment.description (client-provided).
    expect(bench.accounting.generateCalls[0]!.description).toBe("user-typed cobro text");
  });

  // CONVERTED (approval-testing): empty allocations — client passthrough.
  it("COBRO empty allocations: JE.description = client-provided description (REQ-PAY-5 client-authoritative)", async () => {
    bench.accounting.defaultEntry = makeEntry({ id: "entry-4" });

    await bench.svc.createAndPost(
      ORG,
      USER,
      baseCobro({
        amount: 200,
        allocations: [],
      }),
    );

    // W-2: server uses payment.description (client-provided).
    expect(bench.accounting.generateCalls[0]!.description).toBe("user-typed cobro text");
  });

  // CONVERTED (approval-testing): INVERTED — client wins, NOT the builder.
  // Old behavior: builder overrode user-typed text → "COBRO EFECTIVO: Marco Bs. 200,00".
  // New behavior (W-2): user-typed text ("user override exact text") is persisted as-is.
  it("COBRO client-authoritative — user-typed description persists, builder does NOT override (REQ-PAY-5 W-2 inversion)", async () => {
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

    // W-2 inversion: client value wins. The server no longer calls buildPaymentGlosa.
    expect(bench.accounting.generateCalls[0]!.description).toBe("user override exact text");
  });
});
