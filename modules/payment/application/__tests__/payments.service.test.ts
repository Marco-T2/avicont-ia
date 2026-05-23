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
  FakeCreditConsumptionPort,
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
  creditConsumption: FakeCreditConsumptionPort;
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
    creditConsumption,
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

    // Failure mode declarado: rejects with PAYMENT_ALLOCATIONS_EXCEED_TOTAL at
    // the update() step (~payments.service.ts:532). Pre-fix the DRAFT path calls
    // update({amount: 500}) which checks OLD allocs (sum 1000) vs NEW amount 500
    // BEFORE replaceAllocations runs. After the fix update() applies the new
    // allocations atomically, so the final-state check (500 vs 500) passes.
    it("reduces amount with new lower allocations summing to the new amount (atomic)", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({
          amount: 1000,
          allocations: [{ receivableId: "rec-1", amount: 1000 }],
        }),
      );
      const result = await bench.svc.update(ORG, USER, p.id, {
        amount: 500,
        allocations: [{ receivableId: "rec-1", amount: 500 }],
      });
      expect(result.payment.amount.value).toBe(500);
      expect(result.payment.totalAllocated.value).toBe(500);
      expect(result.payment.allocations).toHaveLength(1);
    });
  });

  // ── update (POSTED) — atomic reverse-modify-reapply ─────────────────────

  describe("update POSTED", () => {
    // NOTE (Phase 4, REQ-PAY-2): this was an approval test for the legacy
    // behavior where ANY POSTED edit recomputed the journal. With the
    // didCashChange seam, a description-only edit no longer touches the journal
    // (now covered by the "didCashChange seam" Scenario E test). To keep the
    // journal-recompute path under test here, the edit now CHANGES cash (amount)
    // — which is the branch that legitimately reverses balances + updates entry.
    it("on a cash-changing edit, reverses old balances + allocations, then applies new ones", async () => {
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
        amount: 250,
        description: "edit",
        allocations: [{ receivableId: "rec-1", amount: 250 }],
      });

      expect(result.payment.status).toBe("POSTED");
      expect(result.payment.description).toBe("edit");
      expect(result.payment.amount.value).toBe(250);
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
        { id: "rec-1", amount: 250 },
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

    // Failure mode declarado: rejects with PAYMENT_ALLOCATIONS_EXCEED_TOTAL at
    // the update() step (~payments.service.ts:759). Pre-fix updatePostedPaymentTx
    // calls update({amount: 500}) which checks OLD allocs (sum 1000) vs NEW
    // amount 500 BEFORE replaceAllocations (:901). After the fix the new
    // allocations are passed into update() so the final-state check passes.
    it("reduces amount with new lower allocations summing to the new amount (atomic)", async () => {
      const posted = await seedPosted(bench, {
        amount: 1000,
        allocations: [{ receivableId: "rec-1", amount: 1000 }],
      });
      bench.receivables.status.set("rec-1", "PARTIAL");
      // Reducing the amount changes cash → journal recompute path. Configure the
      // account-by-code lookups the in-place line update needs.
      bench.accounting.accountsByCode.set("1.1.1.1", {
        id: "acct-caja",
        code: "1.1.1.1",
      });
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });

      const result = await bench.svc.update(ORG, USER, posted.id, {
        amount: 500,
        allocations: [{ receivableId: "rec-1", amount: 500 }],
      });

      expect(result.payment.status).toBe("POSTED");
      expect(result.payment.amount.value).toBe(500);
      expect(result.payment.totalAllocated.value).toBe(500);
      // Old allocation reverted, new one applied at the reduced amount.
      expect(bench.receivables.revertCalls).toEqual([
        { id: "rec-1", amount: 1000 },
      ]);
      expect(bench.receivables.applyCalls).toEqual([
        { id: "rec-1", amount: 500 },
      ]);
    });
  });

  // ── update POSTED — didCashChange seam (REQ-PAY-2, Phase 4) ──────────────
  //
  // The unified edit path MUST branch on payment.didCashChange:
  //   - cash UNCHANGED (only allocations / description) → journal entry left
  //     BYTE-IDENTICAL: NO findEntryByIdTx / applyVoidTx / updateEntryTx /
  //     applyPostTx calls. Only the allocations are reverted + reapplied
  //     (Scenario E). The allocation reassignment still runs.
  //   - cash CHANGED (amount/method/date/accountCode) → full recompute as
  //     today: void old balances + updateEntryTx + applyPostTx (Scenario F).
  describe("update POSTED — didCashChange seam (Scenario E / F)", () => {
    it("Scenario E: alloc-only edit leaves the journal untouched (no journal calls), same entry id", async () => {
      const posted = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-1", amount: 100 }],
      });
      bench.receivables.status.set("rec-1", "PARTIAL");
      bench.receivables.status.set("rec-2", "PENDING");
      // Snapshot the journal entry the seed produced (id + lines).
      const entryBefore = await bench.accounting.findEntryByIdTx(
        null,
        ORG,
        "entry-seeded",
      );
      // Reset counters dirtied by the snapshot read above.
      bench.accountBalances.applyVoidCalls = [];
      bench.accountBalances.applyPostCalls = [];
      bench.accounting.updateCalls = [];

      // Edit ONLY allocations — no cash field changes.
      const result = await bench.svc.update(ORG, USER, posted.id, {
        allocations: [{ receivableId: "rec-2", amount: 100 }],
      });

      // The journal entry is byte-identical: same id, same lines.
      expect(result.payment.journalEntryId).toBe("entry-seeded");
      const entryAfter = await bench.accounting.findEntryByIdTx(
        null,
        ORG,
        "entry-seeded",
      );
      expect(entryAfter).toEqual(entryBefore);

      // NO journal mutation at all — the centerpiece of Scenario E.
      expect(bench.accounting.updateCalls).toHaveLength(0);
      expect(bench.accountBalances.applyVoidCalls).toHaveLength(0);
      expect(bench.accountBalances.applyPostCalls).toHaveLength(0);
      expect(bench.accounting.voidCalls).toHaveLength(0);
      expect(bench.accounting.generateCalls).toHaveLength(0);

      // Allocations were still reassigned (revert old → apply new).
      expect(bench.receivables.revertCalls).toEqual([
        { id: "rec-1", amount: 100 },
      ]);
      expect(bench.receivables.applyCalls).toEqual([
        { id: "rec-2", amount: 100 },
      ]);
    });

    it("Scenario F: cash-change edit (amount) recomputes the journal (updateEntryTx + applyPost/applyVoid)", async () => {
      const posted = await seedPosted(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-1", amount: 100 }],
      });
      bench.receivables.status.set("rec-1", "PARTIAL");
      bench.accounting.accountsByCode.set("1.1.1.1", {
        id: "acct-caja",
        code: "1.1.1.1",
      });
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });
      bench.accountBalances.applyVoidCalls = [];
      bench.accountBalances.applyPostCalls = [];
      bench.accounting.updateCalls = [];

      // Edit the amount → cash changed → journal must recompute.
      const result = await bench.svc.update(ORG, USER, posted.id, {
        amount: 1000,
        allocations: [{ receivableId: "rec-1", amount: 1000 }],
      });

      expect(result.payment.amount.value).toBe(1000);
      // Journal recomputed in place: old balances voided + entry updated + reposted.
      expect(bench.accountBalances.applyVoidCalls).toEqual([
        { entryId: "entry-seeded" },
      ]);
      expect(bench.accounting.updateCalls).toHaveLength(1);
      expect(bench.accounting.updateCalls[0]?.lines).toEqual([
        { accountId: "acct-caja", debit: 1000, credit: 0, contactId: undefined, order: 0 },
        { accountId: "acct-cxc", debit: 0, credit: 1000, contactId: CONTACT, order: 1 },
      ]);
      expect(bench.accountBalances.applyPostCalls.at(-1)).toEqual({
        entryId: "entry-seeded",
      });
    });
  });

  // ── update POSTED honors credit — revert-before-reapply (Phase 4) ────────
  //
  // REQ-PAY-3a/3b + Scenario G-order/G-rollback/H. The unified edit path must
  // thread input.creditSources: REVERT all prior credit (link-driven,
  // authoritative) BEFORE re-applying the new creditSources. The order is
  // load-bearing — reapplying first throws PAYMENT_CREDIT_EXCEEDS_AVAILABLE
  // because the source is still depleted by the prior application.
  describe("update POSTED honors credit (Scenario G-order / G-rollback / H)", () => {
    // Build a CONSUMER POSTED payment that consumed 100 credit from a SOURCE,
    // returning both ids. After this, source.unappliedAmount === 0 and one
    // CreditConsumption link keyed by the consumer exists.
    async function seedConsumer(): Promise<{
      sourceId: string;
      consumerId: string;
    }> {
      const source = await seedPosted(bench, {
        amount: 200,
        allocations: [{ receivableId: "rec-original", amount: 100 }],
      });
      bench.receivables.status.set("rec-original", "PARTIAL");
      bench.receivables.status.set("rec-credit-target", "PENDING");
      bench.receivables.status.set("rec-consumer-alloc", "PENDING");
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });
      bench.accounting.accountsByCode.set("1.1.1.1", {
        id: "acct-caja",
        code: "1.1.1.1",
      });
      bench.accounting.defaultEntry = makeEntry({ id: "entry-consumer" });

      const consumer = await bench.svc.createAndPost(ORG, USER, baseCreate({
        amount: 50,
        allocations: [{ receivableId: "rec-consumer-alloc", amount: 50 }],
        creditSources: [
          {
            sourcePaymentId: source.id,
            receivableId: "rec-credit-target",
            amount: 100,
          },
        ],
      }));

      // Sanity: source fully consumed by the credit application.
      const sourceAfter = await bench.repo.findById(ORG, source.id);
      expect(sourceAfter?.unappliedAmount.value).toBe(0);

      // Keep the consumer's entry available for the (no-cash-change) edit path.
      bench.accounting.entries.set("entry-consumer", makeEntry({
        id: "entry-consumer",
        lines: [
          { accountId: "acct-caja", debit: 50, credit: 0, contactId: null, accountNature: "DEBIT" },
          { accountId: "acct-cxc", debit: 0, credit: 50, contactId: CONTACT, accountNature: "DEBIT" },
        ],
      }));

      // Reset counters so the edit assertions observe only the edit.
      bench.receivables.applyCalls = [];
      bench.receivables.revertCalls = [];

      return { sourceId: source.id, consumerId: consumer.payment.id };
    }

    it("Scenario G-order: alloc-only edit reverts prior credit THEN re-applies same creditSources; source unappliedAmount net-unchanged", async () => {
      const { sourceId, consumerId } = await seedConsumer();

      await bench.svc.update(ORG, USER, consumerId, {
        description: "edited",
        creditSources: [
          {
            sourcePaymentId: sourceId,
            receivableId: "rec-credit-target",
            amount: 100,
          },
        ],
      } as Parameters<typeof bench.svc.update>[3]);

      // Net effect: revert restored unapplied 0→100, re-apply reduced 100→0.
      const sourceAfterEdit = await bench.repo.findById(ORG, sourceId);
      expect(sourceAfterEdit?.unappliedAmount.value).toBe(0);

      // The credit-target receivable was reverted (revert step) AND re-applied.
      expect(
        bench.receivables.revertCalls.some(
          (c) => c.id === "rec-credit-target" && c.amount === 100,
        ),
      ).toBe(true);
      expect(
        bench.receivables.applyCalls.some(
          (c) => c.id === "rec-credit-target" && c.amount === 100,
        ),
      ).toBe(true);

      // Cash unchanged → journal NOT recomputed (seam holds with credit too).
      expect(bench.accounting.updateCalls).toHaveLength(0);
    });

    it("Scenario H: alloc-only edit with creditSources omitted reverts prior credit (no orphan link)", async () => {
      const { sourceId, consumerId } = await seedConsumer();

      await bench.svc.update(ORG, USER, consumerId, {
        description: "edited-no-credit",
      });

      // Prior credit reverted → source.unappliedAmount restored to 100.
      const sourceAfterEdit = await bench.repo.findById(ORG, sourceId);
      expect(sourceAfterEdit?.unappliedAmount.value).toBe(100);
      expect(
        bench.receivables.revertCalls.some(
          (c) => c.id === "rec-credit-target" && c.amount === 100,
        ),
      ).toBe(true);
      // No link left for the consumer.
      expect(
        await bench.creditConsumption.findByConsumerPaymentIdTx(
          null,
          ORG,
          consumerId,
        ),
      ).toHaveLength(0);
    });

    it("Scenario G-rollback: reapply with an invalid creditSource throws PAYMENT_CREDIT_EXCEEDS_AVAILABLE (propagates to roll the tx back)", async () => {
      // NOTE: true rollback (state restored on throw) is provided by the REAL
      // withAuditTx/Prisma tx and is asserted at the integration layer. The
      // in-memory repo's transaction() is NON-transactional (updateTx writes
      // directly to the store, no snapshot), so this unit test asserts the
      // load-bearing observable: the error PROPAGATES out of update() — that
      // propagation is what makes the real tx roll back. Asserting "source
      // restored" here would be a false GREEN against a fake that cannot revert.
      const { sourceId, consumerId } = await seedConsumer();

      // Re-apply 999 — exceeds the source's restored unapplied (100). Because
      // revert runs BEFORE reapply (G-order), the source was restored to 100;
      // 999 > 100 → PAYMENT_CREDIT_EXCEEDS_AVAILABLE. (If reapply ran first the
      // source would still be 0 and the SAME error would fire for a DIFFERENT
      // reason — the ordering is verified by G-order's net-unchanged assertion.)
      await expect(
        bench.svc.update(ORG, USER, consumerId, {
          description: "edited-bad-credit",
          creditSources: [
            {
              sourcePaymentId: sourceId,
              receivableId: "rec-credit-target",
              amount: 999,
            },
          ],
        } as Parameters<typeof bench.svc.update>[3]),
      ).rejects.toMatchObject({ code: PAYMENT_CREDIT_EXCEEDS_AVAILABLE });

      // The revert step DID run (and restored the source) before the failing
      // reapply — proving revert-before-reapply ordering on the failure path.
      expect(
        bench.receivables.revertCalls.some(
          (c) => c.id === "rec-credit-target" && c.amount === 100,
        ),
      ).toBe(true);
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

    // v2 INVERSION (tasks changelog): this test previously asserted the source
    // journal was voided+updated+reposted (old step 6). v2 removes that — credit
    // application is MATCHING only. Now it asserts the allocation appends + the
    // receivable apply fires, and that the journal is LEFT UNTOUCHED.
    it("appends an allocation, applies to receivable, and leaves the source journal untouched (v2)", async () => {
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
      bench.accounting.updateCalls = [];
      bench.accountBalances.applyVoidCalls = [];
      bench.accountBalances.applyPostCalls = [];

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
      // v2: the journal entry was NOT voided / updated / reposted.
      expect(bench.accountBalances.applyVoidCalls).toHaveLength(0);
      expect(bench.accounting.updateCalls).toHaveLength(0);
      expect(bench.accountBalances.applyPostCalls).toHaveLength(0);
      // v2: a CreditConsumption link row was written instead.
      expect(bench.creditConsumption.writeCalls).toHaveLength(1);
    });

    // ── v2: credit application is MATCHING, NOT journal mutation ──────────────
    // design v2 §CENTERPIECE D-H: applying credit posts NO new journal. Step 6
    // (source journal void+update+post) is REMOVED. Instead a CreditConsumption
    // link row is written. The receivable balance still moves; the source's
    // unappliedAmount still reduces.
    it("v2: applies credit WITHOUT mutating the source journal (updateEntryTx not called) and writes a CreditConsumption link", async () => {
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
      // Reset journal counters dirtied by seeding.
      bench.accounting.updateCalls = [];
      bench.accountBalances.applyVoidCalls = [];
      bench.accountBalances.applyPostCalls = [];

      await bench.svc.applyCreditOnly(ORG, USER, CONTACT, [
        {
          sourcePaymentId: source.id,
          receivableId: "rec-target",
          amount: 50,
        },
      ]);

      // (a) NO journal mutation on the source — the centerpiece of v2.
      expect(bench.accounting.updateCalls).toHaveLength(0);
      expect(bench.accountBalances.applyVoidCalls).toHaveLength(0);
      expect(bench.accountBalances.applyPostCalls).toHaveLength(0);

      // (b) a CreditConsumption link row was written for the credit.
      expect(bench.creditConsumption.writeCalls).toHaveLength(1);
      const link = bench.creditConsumption.writeCalls[0];
      expect(link.sourcePaymentId).toBe(source.id);
      expect(link.receivableId).toBe("rec-target");
      expect(link.amount.value).toBe(50);
      // applyCreditOnly has no consumer payment → consumerPaymentId is null.
      expect(link.consumerPaymentId).toBeNull();

      // (c) receivable balance still moved (apply was called for the target).
      expect(
        bench.receivables.applyCalls.some(
          (c) => c.id === "rec-target" && c.amount === 50,
        ),
      ).toBe(true);

      // (d) source unappliedAmount reduced: 200 - 50(original) - 50(credit) = 100.
      const refreshedSource = await bench.repo.findById(ORG, source.id);
      expect(refreshedSource?.unappliedAmount.value).toBe(100);
      expect(refreshedSource?.allocations).toHaveLength(2);
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

  // ── LOCKED allocation-only edit via unified path (W-1, Scenario F2/F3) ────
  //
  // The unified edit path (updatePostedPaymentTx) MUST preserve the LOCKED gate
  // (role + justification + validateLockedEdit) that lived in the now-dead
  // updateAllocations. A LOCKED allocation-only edit goes through update() →
  // updatePostedPaymentTx, and the gate must still enforce role + justification.
  describe("update LOCKED allocation-only — unified path gate (Scenario F2/F3)", () => {
    it("Scenario F2: LOCKED allocation-only edit WITHOUT role/justification is rejected", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        allocations: [{ receivableId: "rec-old", amount: 100 }],
      });
      bench.receivables.status.set("rec-old", "PARTIAL");
      bench.receivables.status.set("rec-new", "PENDING");

      // No lockedCtx → role missing → rejected (same as legacy updateAllocations).
      await expect(
        bench.svc.update(ORG, USER, locked.id, {
          allocations: [{ receivableId: "rec-new", amount: 100 }],
        }),
      ).rejects.toThrow(ValidationError);
    });

    it("Scenario F2b: LOCKED + period CLOSED + justification < 50 chars rejected (requiredMin: 50)", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "CLOSED",
        allocations: [{ receivableId: "rec-old", amount: 100 }],
      });
      bench.receivables.status.set("rec-old", "PARTIAL");
      bench.receivables.status.set("rec-new", "PENDING");

      await expect(
        bench.svc.update(
          ORG,
          USER,
          locked.id,
          { allocations: [{ receivableId: "rec-new", amount: 100 }] },
          { role: "admin", justification: "corta" },
        ),
      ).rejects.toMatchObject({
        code: LOCKED_EDIT_REQUIRES_JUSTIFICATION,
        details: { requiredMin: 50 },
      });
    });

    it("Scenario F3: LOCKED allocation-only edit WITH valid role + justification proceeds; allocations reassigned; journal untouched; justification forwarded", async () => {
      const locked = await seedLocked(bench, {
        amount: 100,
        periodStatus: "OPEN",
        allocations: [{ receivableId: "rec-old", amount: 100 }],
      });
      bench.receivables.status.set("rec-old", "PARTIAL");
      bench.receivables.status.set("rec-new", "PENDING");
      const justification = "Reasignación post-bloqueo autorizada por dirección";

      await bench.svc.update(
        ORG,
        USER,
        locked.id,
        { allocations: [{ receivableId: "rec-new", amount: 100 }] },
        { role: "admin", justification },
      );

      // Allocations were reassigned (revert old → apply new).
      expect(bench.receivables.revertCalls).toEqual([
        { id: "rec-old", amount: 100 },
      ]);
      expect(bench.receivables.applyCalls).toEqual([
        { id: "rec-new", amount: 100 },
      ]);
      // Cash unchanged → journal NOT recomputed (Scenario E holds for LOCKED too).
      expect(bench.accounting.updateCalls).toHaveLength(0);
      expect(bench.accountBalances.applyVoidCalls).toHaveLength(0);
      // Justification forwarded to the audit context.
      const justSet = bench.repo.executeRawCalls.find(
        (call) =>
          typeof call[0] === "string" &&
          (call[0] as string).includes("app.audit_justification"),
      );
      expect(justSet).toBeDefined();
      expect((justSet?.[0] as string).includes(justification)).toBe(true);
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

  // journal-physical-document Phase 6 — Payment forwards its own
  // operationalDocTypeId (no findByCode lookup, sister of Sale/Purchase/
  // Dispatch which DO lookup via composition root).
  describe("operationalDocTypeId propagation (Phase 6)", () => {
    it("post forwards Payment.operationalDocTypeId to accounting.generateEntryTx params", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({
          amount: 100,
          operationalDocTypeId: "odt-rc-1",
          allocations: [{ receivableId: "rec-1", amount: 100 }],
        }),
      );
      bench.receivables.status.set("rec-1", "PENDING");
      bench.accounting.defaultEntry = makeEntry({ id: "entry-with-odt" });
      const generateSpy = vi.spyOn(bench.accounting, "generateEntryTx");

      await bench.svc.post(ORG, USER, p.id);

      const params = generateSpy.mock.calls[0]?.[1];
      expect(params).toBeDefined();
      expect(params!.operationalDocTypeId).toBe("odt-rc-1");
    });

    it("post forwards null operationalDocTypeId when Payment.operationalDocTypeId is null", async () => {
      const p = await bench.svc.create(
        ORG,
        USER,
        baseCreate({
          amount: 100,
          operationalDocTypeId: null,
          allocations: [{ receivableId: "rec-2", amount: 100 }],
        }),
      );
      bench.receivables.status.set("rec-2", "PENDING");
      bench.accounting.defaultEntry = makeEntry({ id: "entry-no-odt" });
      const generateSpy = vi.spyOn(bench.accounting, "generateEntryTx");

      await bench.svc.post(ORG, USER, p.id);

      const params = generateSpy.mock.calls[0]?.[1];
      expect(params!.operationalDocTypeId).toBeNull();
    });
  });

  // ── edit POSTED with prior credit — bug repro R-4 (FIXED in Phase 4) ─────
  //
  // Scenario G-order: a contact has two POSTED COBRO payments, one of which
  // was used as a credit source via createAndPost (creditSources field).
  // Editing the CONSUMER payment POSTED now (Phase 4 GREEN):
  //   reverts prior credit (restore source.unappliedAmount), then re-applies
  //   the same credit (reduce source.unappliedAmount again) — net unchanged.
  //
  // BUG that was here (R-4): UpdatePaymentServiceInput had no creditSources
  // field and updatePostedPaymentTx never called revertCreditTx /
  // applyCreditToInvoiceTx, so credit was SILENTLY DROPPED on edit (source's
  // unappliedAmount left wrong). Phase 4 wired creditSources through the
  // service input + the unified edit path (revert-before-reapply). This test
  // was Phase 0's it.skip RED repro; un-skipped here, it is the bug fix landing.

  describe("edit POSTED with prior credit — bug repro R-4 (FIXED)", () => {
    it("edit POSTED consumer payment re-applies same creditSources without dropping them", async () => {
      // ── Arrange ────────────────────────────────────────────────────────────
      // SOURCE: amount=200, allocated=100 to rec-original → unappliedAmount=100
      const source = await seedPosted(bench, {
        amount: 200,
        allocations: [{ receivableId: "rec-original", amount: 100 }],
      });
      bench.receivables.status.set("rec-original", "PARTIAL");
      bench.receivables.status.set("rec-credit-target", "PENDING");
      bench.receivables.status.set("rec-consumer-alloc", "PENDING");

      // Step 6 of applyCreditToInvoiceTx needs a CxC account code lookup.
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });
      bench.accounting.defaultEntry = makeEntry({ id: "entry-consumer" });

      // CONSUMER: cash amount=50, also consumes 100 credit from SOURCE.
      // After createAndPost: source.unappliedAmount should be 0 (100 credit applied).
      const consumer = await bench.svc.createAndPost(ORG, USER, baseCreate({
        amount: 50,
        allocations: [{ receivableId: "rec-consumer-alloc", amount: 50 }],
        creditSources: [
          {
            sourcePaymentId: source.id,
            receivableId: "rec-credit-target",
            amount: 100,
          },
        ],
      }));

      // Sanity: source unapplied is now 0 after credit was applied.
      const sourceAfterApply = await bench.repo.findById(ORG, source.id);
      expect(sourceAfterApply?.unappliedAmount.value).toBe(0);

      // Reset call counters after setup.
      bench.receivables.applyCalls = [];
      bench.receivables.revertCalls = [];

      // Keep consumer's entry available for the edit's void+update path.
      bench.accounting.entries.set("entry-consumer", makeEntry({
        id: "entry-consumer",
        lines: [
          { accountId: "acct-caja", debit: 50, credit: 0, contactId: null, accountNature: "DEBIT" },
          { accountId: "acct-cxc", debit: 0, credit: 50, contactId: CONTACT, accountNature: "DEBIT" },
        ],
      }));
      bench.accounting.accountsByCode.set("1.1.1.1", { id: "acct-caja", code: "1.1.1.1" });

      // ── Act ────────────────────────────────────────────────────────────────
      // Edit the CONSUMER POSTED payment with the same creditSources. Phase 4
      // wired creditSources through UpdatePaymentServiceInput and
      // updatePostedPaymentTx: revert prior links → re-apply same creditSources.
      await bench.svc.update(ORG, USER, consumer.payment.id, {
        description: "edited",
        creditSources: [
          {
            sourcePaymentId: source.id,
            receivableId: "rec-credit-target",
            amount: 100,
          },
        ],
      });

      // ── Assert (GREEN — credit reverted then re-applied, no silent drop) ──
      // After edit, source.unappliedAmount must still be 0 (credit reverted then
      // re-applied in same tx → net effect = unchanged).
      const sourceAfterEdit = await bench.repo.findById(ORG, source.id);
      // GREEN: credit revert restores unapplied to 100, re-apply reduces back to 0.
      expect(sourceAfterEdit?.unappliedAmount.value).toBe(0);

      // GREEN: the receivable that received credit must still be "applied to".
      expect(
        bench.receivables.applyCalls.some((c) => c.id === "rec-credit-target" && c.amount === 100),
      ).toBe(true);

      // GREEN: the credit revert must have restored the receivable first.
      expect(
        bench.receivables.revertCalls.some((c) => c.id === "rec-credit-target" && c.amount === 100),
      ).toBe(true);
    });
  });

  // ── revertCreditTx v2 (Phase 3 — standalone revert capability) ─────────────
  // design v2 §CENTERPIECE / D-C: trivial revert = read links by consumer →
  // restore each source's removeCreditAllocation + receivables.revertAllocation
  // → delete the links. NO journal touch (updateEntryTx never called). The edit
  // path wiring (revert-before-reapply ordering) is Phase 4 — here we exercise
  // the standalone capability via the private method seam.
  describe("revertCreditTx (standalone — Scenario G-revert)", () => {
    // Build a consumer scenario: a SOURCE payment supplies 100 credit to
    // rec-credit-target, consumed by CONSUMER. After createAndPost, the source
    // has a credit allocation (unappliedAmount 0) and a CreditConsumption link
    // keyed by consumer.id.
    async function seedConsumerScenario(): Promise<{
      source: Payment;
      consumerId: string;
    }> {
      const source = await seedPosted(bench, {
        amount: 200,
        allocations: [{ receivableId: "rec-original", amount: 100 }],
      });
      bench.receivables.status.set("rec-original", "PARTIAL");
      bench.receivables.status.set("rec-credit-target", "PENDING");
      bench.receivables.status.set("rec-consumer-alloc", "PENDING");
      bench.accounting.accountsByCode.set("1.1.4.1", {
        id: "acct-cxc",
        code: "1.1.4.1",
      });
      bench.accounting.defaultEntry = makeEntry({ id: "entry-consumer" });

      const consumer = await bench.svc.createAndPost(ORG, USER, baseCreate({
        amount: 50,
        allocations: [{ receivableId: "rec-consumer-alloc", amount: 50 }],
        creditSources: [
          {
            sourcePaymentId: source.id,
            receivableId: "rec-credit-target",
            amount: 100,
          },
        ],
      }));

      // Sanity: source fully consumed; one link recorded for the consumer.
      const sourceAfter = await bench.repo.findById(ORG, source.id);
      expect(sourceAfter?.unappliedAmount.value).toBe(0);
      expect(
        await bench.creditConsumption.findByConsumerPaymentIdTx(
          null,
          ORG,
          consumer.payment.id,
        ),
      ).toHaveLength(1);

      // Reset counters so the revert assertions observe only the revert.
      bench.receivables.revertCalls = [];
      bench.accounting.updateCalls = [];
      bench.accountBalances.applyVoidCalls = [];
      bench.accountBalances.applyPostCalls = [];

      return { source: sourceAfter as Payment, consumerId: consumer.payment.id };
    }

    // Private-method seam: revertCreditTx is private, public wiring is Phase 4.
    function callRevertCreditTx(
      consumerPaymentId: string,
    ): Promise<void> {
      const svc = bench.svc as unknown as {
        revertCreditTx: (
          tx: unknown,
          organizationId: string,
          consumerPaymentId: string,
        ) => Promise<void>;
      };
      return bench.repo.transaction((tx) =>
        svc.revertCreditTx(tx, ORG, consumerPaymentId),
      );
    }

    it("restores the source unappliedAmount, reverts the receivable, deletes the link, NO journal touch", async () => {
      const { source, consumerId } = await seedConsumerScenario();

      await callRevertCreditTx(consumerId);

      // Source credit allocation removed → unappliedAmount restored 0 → 100.
      const sourceAfterRevert = await bench.repo.findById(ORG, source.id);
      expect(sourceAfterRevert?.unappliedAmount.value).toBe(100);

      // Receivable balance restored via revertAllocation.
      expect(
        bench.receivables.revertCalls.some(
          (c) => c.id === "rec-credit-target" && c.amount === 100,
        ),
      ).toBe(true);

      // Link deleted by consumer.
      expect(
        await bench.creditConsumption.findByConsumerPaymentIdTx(
          null,
          ORG,
          consumerId,
        ),
      ).toHaveLength(0);
      expect(bench.creditConsumption.deleteCalls).toContainEqual({
        organizationId: ORG,
        consumerPaymentId: consumerId,
      });

      // NO journal mutation — the centerpiece of v2 revert.
      expect(bench.accounting.updateCalls).toHaveLength(0);
      expect(bench.accountBalances.applyVoidCalls).toHaveLength(0);
      expect(bench.accountBalances.applyPostCalls).toHaveLength(0);
    });

    it("is a no-op when the consumer has no credit links", async () => {
      // No setup — no links for this consumer id.
      await callRevertCreditTx("consumer-with-no-links");
      expect(bench.receivables.revertCalls).toHaveLength(0);
      expect(bench.accounting.updateCalls).toHaveLength(0);
    });

    it("skips a VOIDED source payment (symmetric to revertAllocationTx) but still deletes the link", async () => {
      const { source, consumerId } = await seedConsumerScenario();

      // VOID the source after the credit was applied.
      bench.receivables.status.set("rec-original", "VOIDED");
      bench.receivables.status.set("rec-credit-target", "VOIDED");
      const voided = source.void();
      await bench.repo.update(voided);
      bench.receivables.revertCalls = [];

      await callRevertCreditTx(consumerId);

      // Source is VOIDED → its aggregate is not mutated (skip), but the link
      // for the consumer is still cleared so no orphan persists.
      expect(
        await bench.creditConsumption.findByConsumerPaymentIdTx(
          null,
          ORG,
          consumerId,
        ),
      ).toHaveLength(0);
      expect(bench.accounting.updateCalls).toHaveLength(0);
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
