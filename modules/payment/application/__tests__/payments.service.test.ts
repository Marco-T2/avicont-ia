import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  PaymentsService,
  type CreatePaymentServiceInput,
  type AllocationInput,
} from "../payments.service";
import { Payment } from "../../domain/payment.entity";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  PAYMENT_ALLOCATION_TARGET_VOIDED,
  PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
  PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
  PAYMENT_DIRECTION_REQUIRED,
  PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
  PAYMENT_MIXED_ALLOCATION,
  FISCAL_PERIOD_CLOSED,
  PAYMENT_DATE_OUTSIDE_PERIOD,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
  LOCKED_EDIT_REQUIRES_JUSTIFICATION,
} from "@/features/shared/errors";
import { InMemoryPaymentRepository } from "./fakes/in-memory-payment.repository";
import {
  FakeReceivablesPort,
  FakePayablesPort,
  FakeOrgSettingsReadPort,
  FakeFiscalPeriodsReadPort,
  FakeAccountingPort,
  FakeAccountBalancesPort,
  FakeContactReadPort,
} from "./fakes/fake-ports";
import type { JournalEntrySnapshot } from "../../domain/ports/accounting.port";

const ORG = "org-1";
const USER = "user-1";
const CONTACT = "contact-1";
const PERIOD_OPEN = "period-open";
const PERIOD_CLOSED = "period-closed";

function makeEntry(overrides: Partial<JournalEntrySnapshot> = {}): JournalEntrySnapshot {
  return {
    id: overrides.id ?? "entry-1",
    organizationId: overrides.organizationId ?? ORG,
    periodId: overrides.periodId ?? PERIOD_OPEN,
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
  fiscalPeriods.periods.set(PERIOD_CLOSED, {
    id: PERIOD_CLOSED,
    status: "CLOSED",
  });
  contacts.types.set(CONTACT, "CLIENTE");
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

function baseCreate(
  override: Partial<CreatePaymentServiceInput> = {},
): CreatePaymentServiceInput {
  return {
    method: override.method ?? "EFECTIVO",
    date: override.date ?? new Date("2026-04-15T00:00:00Z"),
    amount: override.amount ?? 1000,
    description: override.description ?? "Cobro factura 0001",
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

describe("PaymentsService", () => {
  let bench: Bench;

  beforeEach(() => {
    bench = makeBench();
  });

  // ── Reads ────────────────────────────────────────────────────────────────

  describe("getById", () => {
    it("returns the payment when found", async () => {
      const created = await bench.svc.create(ORG, USER, baseCreate());
      const fetched = await bench.svc.getById(ORG, created.id);
      expect(fetched.id).toBe(created.id);
    });

    it("throws NotFoundError when missing", async () => {
      await expect(bench.svc.getById(ORG, "missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("does not return payments from other orgs", async () => {
      const created = await bench.svc.create(ORG, USER, baseCreate());
      await expect(
        bench.svc.getById("other-org", created.id),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("list", () => {
    it("returns payments scoped to org", async () => {
      const c1 = await bench.svc.create(ORG, USER, baseCreate());
      const items = await bench.svc.list(ORG);
      expect(items.map((p) => p.id)).toEqual([c1.id]);
    });

    it("filters by contactId", async () => {
      await bench.svc.create(ORG, USER, baseCreate());
      await bench.svc.create(ORG, USER, baseCreate({ contactId: "other" }));
      const items = await bench.svc.list(ORG, { contactId: CONTACT });
      expect(items).toHaveLength(1);
      expect(items[0]?.contactId).toBe(CONTACT);
    });

    it("filters by status", async () => {
      const c = await bench.svc.create(ORG, USER, baseCreate());
      const items = await bench.svc.list(ORG, { status: "DRAFT" });
      expect(items.map((p) => p.id)).toEqual([c.id]);
      const empty = await bench.svc.list(ORG, { status: "POSTED" });
      expect(empty).toEqual([]);
    });
  });

  describe("getCustomerBalance", () => {
    it("delegates to repo.getCustomerBalance", async () => {
      bench.repo.customerBalanceFixtures.set(CONTACT, {
        totalInvoiced: 500,
        totalPaid: 200,
        netBalance: 300,
        unappliedCredit: 50,
      });
      const bal = await bench.svc.getCustomerBalance(ORG, CONTACT);
      expect(bal).toEqual({
        totalInvoiced: 500,
        totalPaid: 200,
        netBalance: 300,
        unappliedCredit: 50,
      });
    });
  });

  // ── create (DRAFT) ───────────────────────────────────────────────────────

  describe("create", () => {
    it("returns a DRAFT payment with the correct fields", async () => {
      const p = await bench.svc.create(ORG, USER, baseCreate({ amount: 250 }));
      expect(p.status).toBe("DRAFT");
      expect(p.amount.value).toBe(250);
      expect(p.organizationId).toBe(ORG);
      expect(p.contactId).toBe(CONTACT);
      expect(p.createdById).toBe(USER);
    });

    it("persists via repo.save (non-tx)", async () => {
      await bench.svc.create(ORG, USER, baseCreate());
      expect(bench.repo.saveCalls).toHaveLength(1);
      expect(bench.repo.saveTxCalls).toHaveLength(0);
    });

    it("propagates aggregate invariant: PAYMENT_ALLOCATIONS_EXCEED_TOTAL", async () => {
      await expect(
        bench.svc.create(
          ORG,
          USER,
          baseCreate({
            amount: 100,
            allocations: [{ receivableId: "rec-1", amount: 200 }],
          }),
        ),
      ).rejects.toMatchObject({ code: PAYMENT_ALLOCATIONS_EXCEED_TOTAL });
    });

    it("propagates aggregate invariant: PAYMENT_MIXED_ALLOCATION", async () => {
      await expect(
        bench.svc.create(
          ORG,
          USER,
          baseCreate({
            amount: 200,
            allocations: [
              { receivableId: "rec-1", amount: 100 },
              { payableId: "pay-1", amount: 100 },
            ],
          }),
        ),
      ).rejects.toMatchObject({ code: PAYMENT_MIXED_ALLOCATION });
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("deletes a DRAFT payment", async () => {
      const p = await bench.svc.create(ORG, USER, baseCreate());
      await bench.svc.delete(ORG, p.id);
      expect(bench.repo.deleteCalls).toEqual([{ id: p.id, orgId: ORG }]);
      await expect(bench.svc.getById(ORG, p.id)).rejects.toThrow(NotFoundError);
    });

    it("throws NotFoundError when missing", async () => {
      await expect(bench.svc.delete(ORG, "missing")).rejects.toThrow(
        NotFoundError,
      );
    });

    it("rejects deleting a POSTED payment", async () => {
      const p = await seedPosted(bench, { amount: 100 });
      await expect(bench.svc.delete(ORG, p.id)).rejects.toThrow(ValidationError);
    });
  });

  // ── post ─────────────────────────────────────────────────────────────────

  describe("post", () => {
    it("transitions DRAFT → POSTED, generates entry, applies balances + allocations", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({
          amount: 500,
          allocations: [{ receivableId: "rec-1", amount: 500 }],
        }),
      );
      bench.receivables.status.set("rec-1", "PENDING");
      bench.accounting.defaultEntry = makeEntry({ id: "entry-x" });

      const result = await bench.svc.post(ORG, USER, p.id);

      expect(result.payment.status).toBe("POSTED");
      expect(result.payment.journalEntryId).toBe("entry-x");
      expect(result.correlationId).toMatch(/^[0-9a-f-]{36}$/);
      expect(bench.accounting.generateCalls).toHaveLength(1);
      expect(bench.accounting.generateCalls[0]?.voucherTypeCode).toBe("CI");
      expect(bench.accountBalances.applyPostCalls).toEqual([{ entryId: "entry-x" }]);
      expect(bench.receivables.applyCalls).toEqual([
        { id: "rec-1", amount: 500 },
      ]);
    });

    it("uses voucher CE for PAGO direction (allocations on payables)", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({
          amount: 200,
          contactId: "supplier-1",
          allocations: [{ payableId: "pay-1", amount: 200 }],
        }),
      );
      bench.contacts.types.set("supplier-1", "PROVEEDOR");
      bench.payables.status.set("pay-1", "PENDING");
      bench.accounting.defaultEntry = makeEntry({ id: "entry-pago" });

      await bench.svc.post(ORG, USER, p.id);

      expect(bench.accounting.generateCalls[0]?.voucherTypeCode).toBe("CE");
      expect(bench.payables.applyCalls).toEqual([{ id: "pay-1", amount: 200 }]);
    });

    it("rejects post when fiscal period is CLOSED", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({ periodId: PERIOD_CLOSED }),
      );
      await expect(bench.svc.post(ORG, USER, p.id)).rejects.toMatchObject({
        code: FISCAL_PERIOD_CLOSED,
      });
    });

    // I12 — fecha del pago/cobro DEBE caer en [period.startDate, period.endDate].
    it("rejects post when payment.date falls outside the period range (I12)", async () => {
      // Primamos un período OPEN específico Mayo 2025 — la fecha por default
      // del baseCreate (2026-04-15) NO cae adentro, gatillando I12 sin tropezar I6.
      bench.fiscalPeriods.periods.set("period-mayo-2025", {
        id: "period-mayo-2025",
        status: "OPEN",
        name: "Mayo 2025",
        startDate: new Date("2025-05-01T00:00:00.000Z"),
        endDate: new Date("2025-05-31T00:00:00.000Z"),
      });
      // Nota: create() también valida I12; usamos createAndPost path para validar el post.
      await expect(
        bench.svc.createAndPost(
          ORG,
          USER,
          baseCreate({ periodId: "period-mayo-2025" }),
        ),
      ).rejects.toMatchObject({ code: PAYMENT_DATE_OUTSIDE_PERIOD });
    });

    it("rejects post when allocation target is VOIDED", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({
          amount: 100,
          allocations: [{ receivableId: "rec-voided", amount: 100 }],
        }),
      );
      bench.receivables.status.set("rec-voided", "VOIDED");
      bench.accounting.defaultEntry = makeEntry();
      await expect(bench.svc.post(ORG, USER, p.id)).rejects.toMatchObject({
        code: PAYMENT_ALLOCATION_TARGET_VOIDED,
      });
    });

    it("skips journal-entry creation when amount is 0 (credit-only payment)", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({ amount: 0 }),
      );
      const result = await bench.svc.post(ORG, USER, p.id);
      expect(result.payment.status).toBe("POSTED");
      expect(result.payment.journalEntryId).toBeNull();
      expect(bench.accounting.generateCalls).toHaveLength(0);
      expect(bench.accountBalances.applyPostCalls).toHaveLength(0);
    });

    it("propagates direction-required when contact type is OTHER (SOCIO/TRANSPORTISTA/OTRO)", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({ contactId: "socio-contact", amount: 0 }),
      );
      bench.contacts.types.set("socio-contact", "OTHER");
      await expect(bench.svc.post(ORG, USER, p.id)).rejects.toMatchObject({
        code: PAYMENT_DIRECTION_REQUIRED,
      });
    });
  });

  // ── createAndPost ────────────────────────────────────────────────────────

  describe("createAndPost", () => {
    it("creates the payment in POSTED state in one tx", async () => {
      bench.receivables.status.set("rec-1", "PENDING");
      bench.accounting.defaultEntry = makeEntry({ id: "entry-cap" });

      const result = await bench.svc.createAndPost(
        ORG,
        USER,
        baseCreate({
          amount: 1000,
          allocations: [{ receivableId: "rec-1", amount: 1000 }],
        }),
      );
      expect(result.payment.status).toBe("POSTED");
      expect(result.payment.journalEntryId).toBe("entry-cap");
      expect(bench.repo.saveTxCalls).toHaveLength(1);
      expect(bench.receivables.applyCalls).toEqual([
        { id: "rec-1", amount: 1000 },
      ]);
    });

    it("rejects when period is CLOSED before opening tx", async () => {
      await expect(
        bench.svc.createAndPost(
          ORG,
          USER,
          baseCreate({ periodId: PERIOD_CLOSED, amount: 10 }),
        ),
      ).rejects.toMatchObject({ code: FISCAL_PERIOD_CLOSED });
      expect(bench.repo.saveTxCalls).toHaveLength(0);
    });

    it("applies creditSources after main allocations", async () => {
      // Seed a source posted payment with unappliedAmount=100
      const source = await seedPosted(bench, {
        amount: 200,
        allocations: [{ receivableId: "rec-original", amount: 100 }],
      });
      bench.receivables.status.set("rec-original", "PARTIAL");
      bench.receivables.status.set("rec-credit-target", "PENDING");
      bench.receivables.status.set("rec-fresh", "PENDING");
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });
      bench.accounting.defaultEntry = makeEntry({ id: "entry-fresh" });

      await bench.svc.createAndPost(
        ORG,
        USER,
        baseCreate({
          amount: 50,
          allocations: [{ receivableId: "rec-fresh", amount: 50 }],
          creditSources: [
            {
              sourcePaymentId: source.id,
              receivableId: "rec-credit-target",
              amount: 50,
            },
          ],
        }),
      );
      // The applyCalls now include the main allocation AND the credit application
      expect(
        bench.receivables.applyCalls.some((c) => c.id === "rec-credit-target"),
      ).toBe(true);
    });
  });

  // ── void ─────────────────────────────────────────────────────────────────

  describe("void", () => {
    it("transitions POSTED → VOIDED, voids journal entry, reverses balances + allocations", async () => {
      const posted = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-1", amount: 100 }],
      });
      bench.receivables.status.set("rec-1", "PARTIAL");

      const result = await bench.svc.void(ORG, USER, posted.id);

      expect(result.payment.status).toBe("VOIDED");
      expect(bench.accounting.voidCalls).toEqual([
        { id: "entry-seeded", userId: USER },
      ]);
      expect(bench.accountBalances.applyVoidCalls).toEqual([
        { entryId: "entry-seeded" },
      ]);
      expect(bench.receivables.revertCalls).toEqual([
        { id: "rec-1", amount: 100 },
      ]);
    });

    it("skips revert on VOIDED targets (legacy parity)", async () => {
      const posted = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-voided", amount: 100 }],
      });
      bench.receivables.status.set("rec-voided", "VOIDED");

      await bench.svc.void(ORG, USER, posted.id);
      expect(bench.receivables.revertCalls).toEqual([]);
    });

    it("does not call accounting.voidEntryTx when payment has no journal entry", async () => {
      const p = await bench.svc.create(ORG, USER, baseCreate({ amount: 0 }));
      await bench.svc.post(ORG, USER, p.id); // amount=0 → no entry

      // Direct void on POSTED-without-entry
      await bench.svc.void(ORG, USER, p.id);
      expect(bench.accounting.voidCalls).toEqual([]);
      expect(bench.accountBalances.applyVoidCalls).toEqual([]);
    });
  });

  // ── update (DRAFT) ───────────────────────────────────────────────────────

  describe("update DRAFT", () => {
    it("updates description on a DRAFT and persists tx-aware", async () => {
      const p = await bench.svc.create(ORG, USER, baseCreate({ amount: 100 }));
      const result = await bench.svc.update(ORG, USER, p.id, {
        description: "edit",
      });
      expect(result.payment.description).toBe("edit");
      expect(bench.repo.updateTxCalls).toEqual([{ id: p.id }]);
    });

    it("rejects when payment is VOIDED with ENTRY_VOIDED_IMMUTABLE (legacy parity)", async () => {
      // Legacy: features/payment/payment.service.ts `update` falls through to
      // validateDraftOnly which throws ENTRY_VOIDED_IMMUTABLE on VOIDED.
      // Module must match the SHARED code, not its own INVALID_STATUS_TRANSITION.
      const posted = await seedPosted(bench, { amount: 100 });
      const v = await bench.svc.void(ORG, USER, posted.id);
      await expect(
        bench.svc.update(ORG, USER, v.payment.id, { description: "x" }),
      ).rejects.toMatchObject({
        code: ENTRY_VOIDED_IMMUTABLE,
        message: expect.stringContaining("anulado"),
      });
    });
  });

  // ── update (POSTED) — atomic reverse-modify-reapply ─────────────────────

  describe("update POSTED", () => {
    it("reverses old balances + allocations, then applies new ones", async () => {
      const posted = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-1", amount: 100 }],
      });
      bench.receivables.status.set("rec-1", "PARTIAL");
      // The seedPosted flow already registered entry-seeded in fake.entries.
      // Configure account-by-code lookups for the in-place line update.
      bench.accounting.accountsByCode.set("1.1.1.1", {
        id: "acct-caja",
        code: "1.1.1.1",
      });
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });

      const result = await bench.svc.update(ORG, USER, posted.id, {
        description: "edit",
      });

      expect(result.payment.status).toBe("POSTED");
      expect(result.payment.description).toBe("edit");
      expect(bench.receivables.revertCalls).toEqual([
        { id: "rec-1", amount: 100 },
      ]);
      expect(bench.accountBalances.applyVoidCalls).toEqual([
        { entryId: "entry-seeded" },
      ]);
      expect(bench.accounting.updateCalls).toHaveLength(1);
      expect(bench.accountBalances.applyPostCalls.at(-1)).toEqual({
        entryId: "entry-seeded",
      });
      expect(bench.receivables.applyCalls).toEqual([
        { id: "rec-1", amount: 100 },
      ]);
    });

    it("rejects when target period CLOSED", async () => {
      const posted = await seedPosted(bench, { amount: 100 });
      // Move the seeded payment's period reference to CLOSED
      bench.fiscalPeriods.periods.set(posted.periodId, {
        id: posted.periodId,
        status: "CLOSED",
      });
      await expect(
        bench.svc.update(ORG, USER, posted.id, { description: "x" }),
      ).rejects.toMatchObject({ code: FISCAL_PERIOD_CLOSED });
    });
  });

  // ── updateAllocations ────────────────────────────────────────────────────

  describe("updateAllocations", () => {
    it("rejects on DRAFT (use update instead)", async () => {
      const p = await bench.svc.create(ORG, USER, baseCreate({ amount: 100 }));
      await expect(
        bench.svc.updateAllocations(ORG, USER, p.id, [
          { receivableId: "rec-1", amount: 50 },
        ]),
      ).rejects.toMatchObject({ code: INVALID_STATUS_TRANSITION });
    });

    it("reverts old + applies new on POSTED", async () => {
      const posted = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-old", amount: 100 }],
      });
      bench.receivables.status.set("rec-old", "PARTIAL");
      bench.receivables.status.set("rec-new", "PENDING");

      await bench.svc.updateAllocations(ORG, USER, posted.id, [
        { receivableId: "rec-new", amount: 100 },
      ]);
      expect(bench.receivables.revertCalls).toEqual([
        { id: "rec-old", amount: 100 },
      ]);
      expect(bench.receivables.applyCalls).toEqual([
        { id: "rec-new", amount: 100 },
      ]);
    });

    it("propagates PAYMENT_ALLOCATIONS_EXCEED_TOTAL from aggregate", async () => {
      const posted = await seedPosted(bench, { amount: 100 });
      bench.receivables.status.set("rec-1", "PENDING");
      await expect(
        bench.svc.updateAllocations(ORG, USER, posted.id, [
          { receivableId: "rec-1", amount: 200 },
        ]),
      ).rejects.toMatchObject({ code: PAYMENT_ALLOCATIONS_EXCEED_TOTAL });
    });
  });

  // ── applyCreditOnly ──────────────────────────────────────────────────────

  describe("applyCreditOnly", () => {
    it("validates that all sources belong to the same contact", async () => {
      const otherSource = await seedPosted(bench, {
        contactId: "other",
        amount: 100,
      });
      await expect(
        bench.svc.applyCreditOnly(ORG, USER, CONTACT, [
          {
            sourcePaymentId: otherSource.id,
            receivableId: "rec-1",
            amount: 50,
          },
        ]),
      ).rejects.toMatchObject({ code: PAYMENT_CREDIT_EXCEEDS_AVAILABLE });
    });

    it("throws NotFoundError when source payment is missing", async () => {
      await expect(
        bench.svc.applyCreditOnly(ORG, USER, CONTACT, [
          {
            sourcePaymentId: "missing",
            receivableId: "rec-1",
            amount: 50,
          },
        ]),
      ).rejects.toThrow(NotFoundError);
    });

    it("appends an allocation, applies to receivable, and rewrites journal entry", async () => {
      const source = await seedPosted(bench, {
        amount: 200,
        allocations: [{ receivableId: "rec-original", amount: 50 }],
      });
      bench.receivables.status.set("rec-original", "PARTIAL");
      bench.receivables.status.set("rec-target", "PENDING");
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });

      await bench.svc.applyCreditOnly(ORG, USER, CONTACT, [
        {
          sourcePaymentId: source.id,
          receivableId: "rec-target",
          amount: 50,
        },
      ]);

      // The receivables port apply was called for the credit-target.
      expect(
        bench.receivables.applyCalls.some(
          (c) => c.id === "rec-target" && c.amount === 50,
        ),
      ).toBe(true);
      // The source payment now has a second allocation.
      const refreshedSource = await bench.repo.findById(ORG, source.id);
      expect(refreshedSource?.allocations).toHaveLength(2);
      // The journal entry was voided + updated + balances re-applied.
      expect(bench.accountBalances.applyVoidCalls.at(-1)?.entryId).toBe(
        "entry-seeded",
      );
      expect(bench.accounting.updateCalls).toHaveLength(1);
      expect(bench.accountBalances.applyPostCalls.at(-1)?.entryId).toBe(
        "entry-seeded",
      );
    });

    it("rejects credit when target receivable is VOIDED", async () => {
      const source = await seedPosted(bench, {
        amount: 200,
        allocations: [{ receivableId: "rec-original", amount: 50 }],
      });
      bench.receivables.status.set("rec-original", "PARTIAL");
      bench.receivables.status.set("rec-voided", "VOIDED");

      await expect(
        bench.svc.applyCreditOnly(ORG, USER, CONTACT, [
          {
            sourcePaymentId: source.id,
            receivableId: "rec-voided",
            amount: 50,
          },
        ]),
      ).rejects.toMatchObject({ code: PAYMENT_ALLOCATION_TARGET_VOIDED });
    });

    it("rejects credit when source unappliedAmount < requested", async () => {
      const source = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-fully-applied", amount: 100 }],
      });
      bench.receivables.status.set("rec-fully-applied", "PAID");
      bench.receivables.status.set("rec-target", "PENDING");

      await expect(
        bench.svc.applyCreditOnly(ORG, USER, CONTACT, [
          {
            sourcePaymentId: source.id,
            receivableId: "rec-target",
            amount: 50,
          },
        ]),
      ).rejects.toMatchObject({ code: PAYMENT_CREDIT_EXCEEDS_AVAILABLE });
    });

    it("rejects credit when source payment is VOIDED", async () => {
      const source = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-x", amount: 100 }],
      });
      bench.receivables.status.set("rec-x", "VOIDED");
      const voided = await bench.svc.void(ORG, USER, source.id);
      bench.receivables.status.set("rec-target", "PENDING");

      await expect(
        bench.svc.applyCreditOnly(ORG, USER, CONTACT, [
          {
            sourcePaymentId: voided.payment.id,
            receivableId: "rec-target",
            amount: 50,
          },
        ]),
      ).rejects.toMatchObject({ code: PAYMENT_CREDIT_EXCEEDS_AVAILABLE });
    });
  });

  // ── direction resolution ─────────────────────────────────────────────────

  describe("direction resolution (via post)", () => {
    it("uses contact.type when no allocations and no explicit direction (CLIENTE → COBRO)", async () => {
      const p = await bench.svc.create(ORG, USER, baseCreate({ amount: 0 }));
      await bench.svc.post(ORG, USER, p.id);
      // amount=0 → no entry generated, but no error means direction resolved
      expect(bench.contacts.calls).toContain(CONTACT);
    });

    it("throws NotFoundError when contactId not found", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({ amount: 0, contactId: "ghost" }),
      );
      await expect(bench.svc.post(ORG, USER, p.id)).rejects.toThrow(
        NotFoundError,
      );
    });
  });

  // ── LOCKED edits — REQ-A6 parity (update/void/updateAllocations) ────────
  //
  // Legacy behavior in features/payment/payment.service.ts:
  //   - LOCKED + role + justification (>= periodMin) → proceeds, justification
  //     forwarded to withAuditTx → setAuditContext writes SET LOCAL
  //     app.audit_justification = '...'.
  //   - LOCKED without role → ValidationError (Spanish message).
  //   - LOCKED + non-admin role → ForbiddenError.
  //   - LOCKED + period CLOSED + justification < 50 chars →
  //     LOCKED_EDIT_REQUIRES_JUSTIFICATION { requiredMin: 50 }.
  //   - LOCKED + period OPEN + justification < 10 chars →
  //     LOCKED_EDIT_REQUIRES_JUSTIFICATION { requiredMin: 10 }.
  //
  // The shared helper validateLockedEdit (features/accounting) is reused.

  describe("update LOCKED — REQ-A6 parity", () => {
    it("rejects when role is missing (ValidationError)", async () => {
      const locked = await seedLocked(bench, { amount: 100 });
      await expect(
        bench.svc.update(ORG, USER, locked.id, { description: "x" }),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects with ForbiddenError when role is non-admin/non-owner", async () => {
      const locked = await seedLocked(bench, { amount: 100 });
      await expect(
        bench.svc.update(ORG, USER, locked.id, { description: "x" }, {
          role: "user",
          justification: "x".repeat(60),
        }),
      ).rejects.toThrow(ForbiddenError);
    });

    it("rejects when period CLOSED and justification < 50 chars (requiredMin: 50)", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "CLOSED",
      });
      await expect(
        bench.svc.update(ORG, USER, locked.id, { description: "x" }, {
          role: "admin",
          justification: "demasiado corta",
        }),
      ).rejects.toMatchObject({
        code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
        details: { requiredMin: 50 },
      });
    });

    it("proceeds when period CLOSED and justification >= 50 chars; forwards justification to audit ctx", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "CLOSED",
      });
      const justification =
        "Corrección regulatoria solicitada por contabilidad — necesaria para el período cerrado de marzo";
      const result = await bench.svc.update(
        ORG,
        USER,
        locked.id,
        { description: "edit-ok" },
        { role: "admin", justification },
      );
      expect(result.payment.description).toBe("edit-ok");
      expect(result.payment.status).toBe("LOCKED");
      // setAuditContext writes SET LOCAL app.audit_justification when present
      const justSet = bench.repo.executeRawCalls.find(
        (call) =>
          typeof call[0] === "string" &&
          (call[0] as string).includes("app.audit_justification"),
      );
      expect(justSet).toBeDefined();
      expect((justSet?.[0] as string).includes(justification)).toBe(true);
    });

    it("rejects when period OPEN and justification < 10 chars (requiredMin: 10)", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "OPEN",
      });
      await expect(
        bench.svc.update(ORG, USER, locked.id, { description: "x" }, {
          role: "admin",
          justification: "corta",
        }),
      ).rejects.toMatchObject({
        code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
        details: { requiredMin: 10 },
      });
    });

    it("proceeds when period OPEN and justification >= 10 chars", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "OPEN",
      });
      const justification = "Ajuste menor solicitado";
      const result = await bench.svc.update(
        ORG,
        USER,
        locked.id,
        { description: "edit-ok-open" },
        { role: "admin", justification },
      );
      expect(result.payment.description).toBe("edit-ok-open");
      expect(result.payment.status).toBe("LOCKED");
    });
  });

  describe("void LOCKED — REQ-A6 parity", () => {
    it("rejects when role is missing on LOCKED", async () => {
      const locked = await seedLocked(bench, { amount: 100 });
      await expect(bench.svc.void(ORG, USER, locked.id)).rejects.toThrow(
        ValidationError,
      );
    });

    it("rejects when period CLOSED and justification < 50 chars", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "CLOSED",
      });
      await expect(
        bench.svc.void(ORG, USER, locked.id, {
          role: "admin",
          justification: "no",
        }),
      ).rejects.toMatchObject({
        code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
        details: { requiredMin: 50 },
      });
    });

    it("proceeds LOCKED → VOIDED when role + justification valid; forwards justification", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "OPEN",
        allocations: [{ receivableId: "rec-locked", amount: 100 }],
      });
      bench.receivables.status.set("rec-locked", "PARTIAL");
      const justification = "Anulación autorizada por dirección";
      const result = await bench.svc.void(ORG, USER, locked.id, {
        role: "admin",
        justification,
      });
      expect(result.payment.status).toBe("VOIDED");
      const justSet = bench.repo.executeRawCalls.find(
        (call) =>
          typeof call[0] === "string" &&
          (call[0] as string).includes("app.audit_justification"),
      );
      expect(justSet).toBeDefined();
      expect((justSet?.[0] as string).includes(justification)).toBe(true);
    });

    it("VOIDED is terminal: void on a VOIDED payment still throws", async () => {
      const posted = await seedPosted(bench, { amount: 100 });
      const v = await bench.svc.void(ORG, USER, posted.id);
      await expect(bench.svc.void(ORG, USER, v.payment.id)).rejects.toThrow();
    });
  });

  describe("updateAllocations LOCKED — REQ-A6 parity", () => {
    it("rejects when role is missing on LOCKED", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-old", amount: 100 }],
      });
      bench.receivables.status.set("rec-old", "PARTIAL");
      bench.receivables.status.set("rec-new", "PENDING");
      await expect(
        bench.svc.updateAllocations(ORG, USER, locked.id, [
          { receivableId: "rec-new", amount: 100 },
        ]),
      ).rejects.toThrow(ValidationError);
    });

    it("rejects when period CLOSED and justification < 50 chars", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "CLOSED",
        allocations: [{ receivableId: "rec-old", amount: 100 }],
      });
      bench.receivables.status.set("rec-old", "PARTIAL");
      bench.receivables.status.set("rec-new", "PENDING");
      await expect(
        bench.svc.updateAllocations(
          ORG,
          USER,
          locked.id,
          [{ receivableId: "rec-new", amount: 100 }],
          { role: "admin", justification: "corto" },
        ),
      ).rejects.toMatchObject({
        code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
        details: { requiredMin: 50 },
      });
    });

    it("proceeds when role + justification valid; forwards justification", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "OPEN",
        allocations: [{ receivableId: "rec-old", amount: 100 }],
      });
      bench.receivables.status.set("rec-old", "PARTIAL");
      bench.receivables.status.set("rec-new", "PENDING");
      const justification = "Reasignación post-bloqueo autorizada";

      await bench.svc.updateAllocations(
        ORG,
        USER,
        locked.id,
        [{ receivableId: "rec-new", amount: 100 }],
        { role: "admin", justification },
      );
      expect(bench.receivables.revertCalls).toEqual([
        { id: "rec-old", amount: 100 },
      ]);
      expect(bench.receivables.applyCalls).toEqual([
        { id: "rec-new", amount: 100 },
      ]);
      const justSet = bench.repo.executeRawCalls.find(
        (call) =>
          typeof call[0] === "string" &&
          (call[0] as string).includes("app.audit_justification"),
      );
      expect(justSet).toBeDefined();
      expect((justSet?.[0] as string).includes(justification)).toBe(true);
    });
  });

  // ── Legacy parity: error-code drifts (C2-FIX-2) ─────────────────────────
  //
  // These cover the gaps surfaced in the C2 audit:
  //   * status transitions on VOIDED must emit ENTRY_VOIDED_IMMUTABLE
  //     (not the module's domain-class INVALID_STATUS_TRANSITION).
  //   * balance-exceeded on apply must emit PAYMENT_ALLOCATION_EXCEEDS_BALANCE
  //     (not the receivables/payables module's ALLOCATION_EXCEEDS_BALANCE).
  // Source of truth: features/payment/payment.service.ts +
  // features/accounting/document-lifecycle.service.ts.

  describe("legacy parity: error codes on VOIDED transitions", () => {
    it("post on VOIDED emits ENTRY_VOIDED_IMMUTABLE (legacy validateTransition first branch)", async () => {
      const posted = await seedPosted(bench, { amount: 100 });
      const voided = await bench.svc.void(ORG, USER, posted.id);
      await expect(
        bench.svc.post(ORG, USER, voided.payment.id),
      ).rejects.toMatchObject({
        code: ENTRY_VOIDED_IMMUTABLE,
        message: expect.stringContaining("anulado"),
      });
    });

    it("void on VOIDED emits ENTRY_VOIDED_IMMUTABLE (legacy validateTransition first branch)", async () => {
      const posted = await seedPosted(bench, { amount: 100 });
      const voided = await bench.svc.void(ORG, USER, posted.id);
      await expect(
        bench.svc.void(ORG, USER, voided.payment.id),
      ).rejects.toMatchObject({
        code: ENTRY_VOIDED_IMMUTABLE,
        message: expect.stringContaining("anulado"),
      });
    });
  });

  describe("legacy parity: balance pre-check on apply", () => {
    it("post emits PAYMENT_ALLOCATION_EXCEEDS_BALANCE when receivable balance < alloc.amount", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({
          amount: 100,
          allocations: [{ receivableId: "rec-low", amount: 100 }],
        }),
      );
      bench.receivables.status.set("rec-low", "PENDING");
      bench.receivables.balance.set("rec-low", 50); // less than alloc.amount
      bench.accounting.defaultEntry = makeEntry({ id: "entry-noop" });

      await expect(bench.svc.post(ORG, USER, p.id)).rejects.toMatchObject({
        code: PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
        message: expect.stringContaining("excede el saldo disponible"),
      });
    });

    it("post emits PAYMENT_ALLOCATION_EXCEEDS_BALANCE when payable balance < alloc.amount", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({
          amount: 100,
          contactId: "supplier-low",
          allocations: [{ payableId: "pay-low", amount: 100 }],
        }),
      );
      bench.contacts.types.set("supplier-low", "PROVEEDOR");
      bench.payables.status.set("pay-low", "PENDING");
      bench.payables.balance.set("pay-low", 25);
      bench.accounting.defaultEntry = makeEntry({ id: "entry-noop-cxp" });

      await expect(bench.svc.post(ORG, USER, p.id)).rejects.toMatchObject({
        code: PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
        message: expect.stringContaining("excede el saldo disponible"),
      });
    });

    it("createAndPost emits PAYMENT_ALLOCATION_EXCEEDS_BALANCE when receivable balance insufficient", async () => {
      bench.receivables.status.set("rec-cap-low", "PENDING");
      bench.receivables.balance.set("rec-cap-low", 10);
      bench.accounting.defaultEntry = makeEntry({ id: "entry-cap-noop" });

      await expect(
        bench.svc.createAndPost(
          ORG,
          USER,
          baseCreate({
            amount: 100,
            allocations: [{ receivableId: "rec-cap-low", amount: 100 }],
          }),
        ),
      ).rejects.toMatchObject({
        code: PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
        message: expect.stringContaining("excede el saldo disponible"),
      });
    });

    it("updateAllocations emits PAYMENT_ALLOCATION_EXCEEDS_BALANCE when new alloc balance insufficient", async () => {
      const posted = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-old", amount: 100 }],
      });
      bench.receivables.status.set("rec-old", "PARTIAL");
      bench.receivables.status.set("rec-new-low", "PENDING");
      bench.receivables.balance.set("rec-new-low", 30);

      await expect(
        bench.svc.updateAllocations(ORG, USER, posted.id, [
          { receivableId: "rec-new-low", amount: 100 },
        ]),
      ).rejects.toMatchObject({
        code: PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
        message: expect.stringContaining("excede el saldo disponible"),
      });
    });

    it("update POSTED emits PAYMENT_ALLOCATION_EXCEEDS_BALANCE when new alloc balance insufficient", async () => {
      const posted = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-1", amount: 100 }],
      });
      bench.receivables.status.set("rec-1", "PARTIAL");
      bench.receivables.status.set("rec-new-low", "PENDING");
      bench.receivables.balance.set("rec-new-low", 20);
      // Configure account-by-code lookups for the in-place line update.
      bench.accounting.accountsByCode.set("1.1.1.1", {
        id: "acct-caja",
        code: "1.1.1.1",
      });
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });

      await expect(
        bench.svc.update(ORG, USER, posted.id, {
          allocations: [{ receivableId: "rec-new-low", amount: 100 }],
        }),
      ).rejects.toMatchObject({
        code: PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
        message: expect.stringContaining("excede el saldo disponible"),
      });
    });

    it("applyCreditOnly emits PAYMENT_ALLOCATION_EXCEEDS_BALANCE when target receivable balance insufficient", async () => {
      const source = await seedPosted(bench, {
        amount: 200,
        allocations: [{ receivableId: "rec-original", amount: 50 }],
      });
      bench.receivables.status.set("rec-original", "PARTIAL");
      bench.receivables.status.set("rec-target-low", "PENDING");
      bench.receivables.balance.set("rec-target-low", 5);
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });

      await expect(
        bench.svc.applyCreditOnly(ORG, USER, CONTACT, [
          {
            sourcePaymentId: source.id,
            receivableId: "rec-target-low",
            amount: 50,
          },
        ]),
      ).rejects.toMatchObject({
        code: PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
        message: expect.stringContaining("excede el saldo disponible"),
      });
    });
  });

  // ── tx propagation ───────────────────────────────────────────────────────

  describe("tx propagation", () => {
    it("post uses findByIdTx via accounting/balances/receivables (tx threaded)", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({
          amount: 100,
          allocations: [{ receivableId: "rec-1", amount: 100 }],
        }),
      );
      bench.receivables.status.set("rec-1", "PENDING");
      bench.accounting.defaultEntry = makeEntry({ id: "entry-tx" });
      const generateSpy = vi.spyOn(bench.accounting, "generateEntryTx");

      await bench.svc.post(ORG, USER, p.id);

      // First arg of generateEntryTx is the tx token from withAuditTx
      expect(generateSpy.mock.calls[0]?.[0]).toBe(bench.repo.txToken);
    });
  });
});

// ─────────────────────────── Helpers ────────────────────────────────────────

async function seedPosted(
  bench: Bench,
  override: { amount?: number; allocations?: AllocationInput[]; contactId?: string } = {},
): Promise<Payment> {
  const amount = override.amount ?? 100;
  const allocations = override.allocations ?? [];
  const contactId = override.contactId ?? CONTACT;

  // Pre-populate receivables/payables status fixtures so post does not fail.
  for (const a of allocations) {
    if (a.receivableId) bench.receivables.status.set(a.receivableId, "PENDING");
    if (a.payableId) bench.payables.status.set(a.payableId, "PENDING");
  }
  bench.contacts.types.set(contactId, "CLIENTE");
  bench.accounting.defaultEntry = makeEntry({
    id: "entry-seeded",
    lines: [
      {
        accountId: "acct-caja",
        debit: amount,
        credit: 0,
        contactId: null,
        accountNature: "DEBIT",
      },
      {
        accountId: "acct-cxc",
        debit: 0,
        credit: amount,
        contactId,
        accountNature: "DEBIT",
      },
    ],
  });
  const p = await bench.svc.create(
    ORG,
    USER,
    baseCreate({ amount, contactId, allocations }),
  );
  await bench.svc.post(ORG, USER, p.id);
  // Keep the configured entry sticky for follow-up calls (void, update, etc.)
  bench.accounting.entries.set("entry-seeded", makeEntry({
    id: "entry-seeded",
    lines: [
      {
        accountId: "acct-caja",
        debit: amount,
        credit: 0,
        contactId: null,
        accountNature: "DEBIT",
      },
      {
        accountId: "acct-cxc",
        debit: 0,
        credit: amount,
        contactId,
        accountNature: "DEBIT",
      },
    ],
  }));
  // Reset call counters that were dirtied by the seeding post.
  bench.receivables.applyCalls = [];
  bench.payables.applyCalls = [];
  bench.accountBalances.applyPostCalls = [];
  bench.accounting.generateCalls = [];
  bench.repo.saveTxCalls = [];
  bench.repo.updateTxCalls = [];
  const refreshed = await bench.repo.findById(ORG, p.id);
  if (!refreshed) throw new Error("seed fail");
  return refreshed;
}

/**
 * Seed a LOCKED payment by going DRAFT → POSTED → LOCKED via the aggregate
 * mutators (the service does not expose a "lock" use case — it is normally a
 * period-close side effect — so we transition the entity directly and persist
 * via repo.update). The fiscal period of the seeded payment is overridden to
 * `periodStatus` (default OPEN).
 */
async function seedLocked(
  bench: Bench,
  override: {
    amount?: number;
    allocations?: AllocationInput[];
    contactId?: string;
    periodStatus?: "OPEN" | "CLOSED";
  } = {},
): Promise<Payment> {
  const posted = await seedPosted(bench, {
    amount: override.amount,
    allocations: override.allocations,
    contactId: override.contactId,
  });
  // Transition POSTED → LOCKED through the aggregate.
  const locked = posted.lock();
  await bench.repo.update(locked);
  // Override the period status if requested (default: keep OPEN).
  bench.fiscalPeriods.periods.set(locked.periodId, {
    id: locked.periodId,
    status: override.periodStatus ?? "OPEN",
  });
  // Reset audit-context capture so each test starts with a clean slate.
  bench.repo.executeRawCalls.length = 0;
  // Re-clear counters dirtied by the lock persist.
  bench.repo.updateCalls = [];
  bench.repo.updateTxCalls = [];
  const refreshed = await bench.repo.findById(ORG, locked.id);
  if (!refreshed) throw new Error("seedLocked fail");
  return refreshed;
}
