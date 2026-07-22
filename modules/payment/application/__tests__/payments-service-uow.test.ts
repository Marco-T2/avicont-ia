/**
 * PaymentUnitOfWork port cutover tests — closes the hex-ratchet violation
 * `payments.service.ts:R2` (application → shared/infrastructure/audit-tx).
 *
 * Target contract (shape (a), §18 human decision 2026-07-22 executed):
 *   1. STRUCTURAL — payments.service.ts no longer imports withAuditTx from
 *      `@/modules/shared/infrastructure/audit-tx`. The tx boundary is owned
 *      by the new domain port `domain/ports/payment-unit-of-work.ts`.
 *   2. INJECTION — PaymentsServiceDeps requires `uow: PaymentUnitOfWork`;
 *      the service constructs against a FakePaymentUnitOfWork.
 *   3. BEHAVIORAL — write use cases route through `uow.run(ctx, fn)` with the
 *      audit ctx, still return a UUID v4 correlationId, and the audit path is
 *      preserved (setAuditContext-equivalent SQL observable via
 *      repo.executeRawCalls — same channel payments.service.audit.test.ts
 *      asserts on).
 */
import { describe, it, expect, beforeEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { PaymentsService } from "../payments.service";
import { InMemoryPaymentRepository } from "./fakes/in-memory-payment.repository";
import { FakePaymentUnitOfWork } from "./fakes/fake-payment-unit-of-work";
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
import type { JournalEntrySnapshot } from "../../domain/ports/accounting.port";

const ORG = "org-uow";
const USER = "user-uow";
const CONTACT = "contact-uow";
const PERIOD_OPEN = "period-open-uow";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ── Regex patterns ───────────────────────────────────────────────────────────
// Line-bound (^...$ + m flag, [^\n]* — never [^)]*) per α-sentinel convention.

const AUDIT_TX_INFRA_IMPORT_RE =
  /^import[^\n]*from\s+["']@\/modules\/shared\/infrastructure\/audit-tx["'];?$/m;

const PAYMENTS_SERVICE_PATH = path.join(
  process.cwd(),
  "modules/payment/application/payments.service.ts",
);

// ── Test bench ───────────────────────────────────────────────────────────────

interface Bench {
  repo: InMemoryPaymentRepository;
  uow: FakePaymentUnitOfWork;
  receivables: FakeReceivablesPort;
  fiscalPeriods: FakeFiscalPeriodsReadPort;
  accounting: FakeAccountingPort;
  svc: PaymentsService;
}

function makeBench(): Bench {
  const repo = new InMemoryPaymentRepository();
  const uow = new FakePaymentUnitOfWork(repo);
  const receivables = new FakeReceivablesPort();
  const payables = new FakePayablesPort();
  const orgSettings = new FakeOrgSettingsReadPort();
  const fiscalPeriods = new FakeFiscalPeriodsReadPort();
  const accounting = new FakeAccountingPort();
  const accountBalances = new FakeAccountBalancesPort();
  const contacts = new FakeContactReadPort();
  const creditConsumption = new FakeCreditConsumptionPort();

  fiscalPeriods.periods.set(PERIOD_OPEN, { id: PERIOD_OPEN, status: "OPEN" });
  contacts.types.set(CONTACT, "CLIENTE");

  const svc = new PaymentsService({
    repo,
    uow,
    receivables,
    payables,
    orgSettings,
    fiscalPeriods,
    accounting,
    accountBalances,
    contacts,
    creditConsumption,
  });

  return { repo, uow, receivables, fiscalPeriods, accounting, svc };
}

function makeEntry(
  overrides: Partial<JournalEntrySnapshot> = {},
): JournalEntrySnapshot {
  return {
    id: overrides.id ?? "entry-uow-1",
    organizationId: ORG,
    periodId: PERIOD_OPEN,
    lines: overrides.lines ?? [
      {
        accountId: "acct-caja",
        debit: 100,
        credit: 0,
        contactId: null,
        accountNature: "DEBIT",
      },
      {
        accountId: "acct-cxc",
        debit: 0,
        credit: 100,
        contactId: CONTACT,
        accountNature: "DEBIT",
      },
    ],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. STRUCTURAL
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentUnitOfWork cutover — structural", () => {
  it("payments.service.ts does NOT import withAuditTx from shared/infrastructure/audit-tx", () => {
    const source = fs.readFileSync(PAYMENTS_SERVICE_PATH, "utf8");
    expect(source).not.toMatch(AUDIT_TX_INFRA_IMPORT_RE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. INJECTION
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentUnitOfWork cutover — injection", () => {
  it("PaymentsService constructs with a uow dep (FakePaymentUnitOfWork)", () => {
    const bench = makeBench();
    expect(bench.svc).toBeInstanceOf(PaymentsService);
    expect(bench.uow.runCalls).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. BEHAVIORAL — runtime path coverage through uow.run
// ─────────────────────────────────────────────────────────────────────────────

describe("PaymentUnitOfWork cutover — behavioral", () => {
  let bench: Bench;

  beforeEach(() => {
    bench = makeBench();
  });

  it("post() routes through uow.run with the audit ctx, returns correlationId, audit SQL preserved", async () => {
    const p = await bench.svc.create(ORG, USER, {
      method: "EFECTIVO",
      date: new Date("2026-04-15T00:00:00Z"),
      amount: 100,
      description: "Cobro uow post",
      periodId: PERIOD_OPEN,
      contactId: CONTACT,
      allocations: [],
    });
    bench.accounting.defaultEntry = makeEntry({ id: "entry-uow-post" });
    bench.repo.executeRawCalls.length = 0;

    const result = await bench.svc.post(ORG, USER, p.id);

    // Routed through the port with the audit ctx.
    expect(bench.uow.runCalls).toHaveLength(1);
    expect(bench.uow.runCalls[0]).toMatchObject({
      userId: USER,
      organizationId: ORG,
    });

    // correlationId still emitted from the run's return value.
    expect(result.correlationId).toMatch(UUID_V4_REGEX);

    // Audit path preserved: setAuditContext-equivalent SQL fired inside the tx.
    const userIdCall = bench.repo.executeRawCalls.find(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("app.current_user_id"),
    );
    expect(userIdCall).toBeDefined();
    const cidCall = bench.repo.executeRawCalls.find(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("app.correlation_id") &&
        (call[0] as string).includes(result.correlationId),
    );
    expect(cidCall).toBeDefined();
  });

  it("void() routes through uow.run with the audit ctx and returns correlationId", async () => {
    const p = await bench.svc.create(ORG, USER, {
      method: "EFECTIVO",
      date: new Date("2026-04-15T00:00:00Z"),
      amount: 100,
      description: "Cobro uow void",
      periodId: PERIOD_OPEN,
      contactId: CONTACT,
      allocations: [],
    });
    bench.accounting.defaultEntry = makeEntry({ id: "entry-uow-void" });
    await bench.svc.post(ORG, USER, p.id);
    bench.uow.runCalls.length = 0;
    bench.repo.executeRawCalls.length = 0;

    const result = await bench.svc.void(ORG, USER, p.id);

    expect(bench.uow.runCalls).toHaveLength(1);
    expect(bench.uow.runCalls[0]).toMatchObject({
      userId: USER,
      organizationId: ORG,
    });
    expect(result.correlationId).toMatch(UUID_V4_REGEX);
    const userIdCall = bench.repo.executeRawCalls.find(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).includes("app.current_user_id"),
    );
    expect(userIdCall).toBeDefined();
  });
});
