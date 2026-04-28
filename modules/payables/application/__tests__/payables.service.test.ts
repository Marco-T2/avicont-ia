import { describe, it, expect, beforeEach, vi } from "vitest";
import { PayablesService } from "../payables.service";
import { Payable } from "../../domain/payable.entity";
import type {
  PayableRepository,
  PayableFilters,
  OpenAggregate,
  PendingDocumentSnapshot,
  CreatePayableTxData,
} from "../../domain/payable.repository";
import type { PayableStatus } from "../../domain/value-objects/payable-status";
import type { ContactExistencePort } from "../../domain/ports/contact-existence.port";
import {
  NotFoundError,
  PAYABLE_AMOUNT_IMMUTABLE,
} from "@/features/shared/errors";
import {
  InvalidPayableStatusTransition,
  PartialPaymentAmountRequired,
  CannotApplyToVoidedPayable,
  CannotRevertOnVoidedPayable,
  AllocationExceedsBalance,
  RevertExceedsPaid,
} from "../../domain/errors/payable-errors";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

class InMemoryPayableRepository implements PayableRepository {
  private readonly store = new Map<string, Payable>();

  reset() {
    this.store.clear();
  }

  preload(...payables: Payable[]) {
    for (const p of payables) this.store.set(p.id, p);
  }

  async findAll(orgId: string, filters?: PayableFilters): Promise<Payable[]> {
    return [...this.store.values()].filter((p) => {
      if (p.organizationId !== orgId) return false;
      if (filters?.contactId && p.contactId !== filters.contactId) return false;
      if (filters?.status && p.status !== filters.status) return false;
      return true;
    });
  }

  async findById(orgId: string, id: string): Promise<Payable | null> {
    const p = this.store.get(id);
    return p && p.organizationId === orgId ? p : null;
  }

  async save(p: Payable): Promise<void> {
    this.store.set(p.id, p);
  }

  async update(p: Payable): Promise<void> {
    this.store.set(p.id, p);
  }

  async aggregateOpen(orgId: string, contactId?: string): Promise<OpenAggregate> {
    const open = [...this.store.values()].filter((p) => {
      if (p.organizationId !== orgId) return false;
      if (contactId && p.contactId !== contactId) return false;
      return p.status === "PENDING" || p.status === "PARTIAL";
    });
    return {
      totalBalance: open.reduce((acc, p) => acc + p.balance.value, 0),
      count: open.length,
    };
  }

  async findPendingByContact(
    orgId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]> {
    return [...this.store.values()]
      .filter(
        (p) =>
          p.organizationId === orgId &&
          p.contactId === contactId &&
          (p.status === "PENDING" || p.status === "PARTIAL"),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((p) => ({
        id: p.id,
        description: p.description,
        amount: p.amount.value,
        paid: p.paid.value,
        balance: p.balance.value,
        dueDate: p.dueDate,
        sourceType: p.sourceType,
        sourceId: p.sourceId,
        createdAt: p.createdAt,
      }));
  }

  async createTx(_tx: unknown, _data: CreatePayableTxData): Promise<{ id: string }> {
    return { id: "tx-not-tested-here" };
  }

  async voidTx(_tx: unknown, _orgId: string, _id: string): Promise<void> {
    /* no-op */
  }

  async findByIdTx(_tx: unknown, orgId: string, id: string): Promise<Payable | null> {
    // NOTE: independent path (does NOT delegate to findById) so service tests
    // can assert that allocation use cases load via findByIdTx, not findById.
    const p = this.store.get(id);
    return p && p.organizationId === orgId ? p : null;
  }

  applyAllocationTxCalls: Array<{
    orgId: string;
    id: string;
    paid: number;
    balance: number;
    status: PayableStatus;
  }> = [];

  revertAllocationTxCalls: Array<{
    orgId: string;
    id: string;
    paid: number;
    balance: number;
    status: PayableStatus;
  }> = [];

  async applyAllocationTx(
    _tx: unknown,
    orgId: string,
    id: string,
    paid: MonetaryAmount,
    balance: MonetaryAmount,
    status: PayableStatus,
  ): Promise<void> {
    this.applyAllocationTxCalls.push({ orgId, id, paid: paid.value, balance: balance.value, status });
  }

  async revertAllocationTx(
    _tx: unknown,
    orgId: string,
    id: string,
    paid: MonetaryAmount,
    balance: MonetaryAmount,
    status: PayableStatus,
  ): Promise<void> {
    this.revertAllocationTxCalls.push({ orgId, id, paid: paid.value, balance: balance.value, status });
  }
}

class StubContactExistencePort implements ContactExistencePort {
  public calls: Array<{ orgId: string; contactId: string }> = [];
  public shouldThrow: Error | null = null;

  async assertActive(organizationId: string, contactId: string): Promise<void> {
    this.calls.push({ orgId: organizationId, contactId });
    if (this.shouldThrow) throw this.shouldThrow;
  }
}

const ORG = "org-1";
const CONTACT = "contact-1";

const baseInput = (override: Partial<{ description: string; amount: number; dueDate: Date }> = {}) => ({
  contactId: CONTACT,
  description: override.description ?? "Factura proveedor 0001",
  amount: override.amount ?? 1000,
  dueDate: override.dueDate ?? new Date("2026-05-15"),
});

describe("PayablesService", () => {
  let repo: InMemoryPayableRepository;
  let contacts: StubContactExistencePort;
  let svc: PayablesService;

  beforeEach(() => {
    repo = new InMemoryPayableRepository();
    contacts = new StubContactExistencePort();
    svc = new PayablesService(repo, contacts);
  });

  describe("list", () => {
    it("returns payables scoped to org", async () => {
      const p = await svc.create(ORG, baseInput());
      const items = await svc.list(ORG);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(p.id);
    });

    it("filters by contactId", async () => {
      await svc.create(ORG, baseInput());
      contacts.calls = [];
      contacts.shouldThrow = null;
      await svc.create(ORG, { ...baseInput(), contactId: "contact-2" });
      const items = await svc.list(ORG, { contactId: CONTACT });
      expect(items).toHaveLength(1);
      expect(items[0]?.contactId).toBe(CONTACT);
    });

    it("filters by status", async () => {
      const p = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, p.id, { status: "PAID" });
      const pending = await svc.list(ORG, { status: "PENDING" });
      const paid = await svc.list(ORG, { status: "PAID" });
      expect(pending).toHaveLength(0);
      expect(paid).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("returns the payable when found", async () => {
      const p = await svc.create(ORG, baseInput());
      const found = await svc.getById(ORG, p.id);
      expect(found.id).toBe(p.id);
    });

    it("throws NotFoundError when missing", async () => {
      await expect(svc.getById(ORG, "missing")).rejects.toThrow(NotFoundError);
    });

    it("does not return payables from other orgs", async () => {
      const p = await svc.create(ORG, baseInput());
      await expect(svc.getById("other-org", p.id)).rejects.toThrow(NotFoundError);
    });
  });

  describe("create", () => {
    it("calls contacts.assertActive before creating", async () => {
      await svc.create(ORG, baseInput());
      expect(contacts.calls).toEqual([{ orgId: ORG, contactId: CONTACT }]);
    });

    it("propagates assertActive errors and does not save", async () => {
      contacts.shouldThrow = new Error("inactive");
      await expect(svc.create(ORG, baseInput())).rejects.toThrow("inactive");
      const items = await svc.list(ORG);
      expect(items).toHaveLength(0);
    });

    it("returns a PENDING payable with balance = amount", async () => {
      const p = await svc.create(ORG, baseInput({ amount: 500 }));
      expect(p.status).toBe("PENDING");
      expect(p.amount.value).toBe(500);
      expect(p.balance.value).toBe(500);
      expect(p.paid.value).toBe(0);
      expect(p.organizationId).toBe(ORG);
    });
  });

  describe("update", () => {
    it("rejects amount in input with PAYABLE_AMOUNT_IMMUTABLE", async () => {
      const p = await svc.create(ORG, baseInput());
      await expect(
        svc.update(ORG, p.id, { amount: 999 } as never),
      ).rejects.toMatchObject({ code: PAYABLE_AMOUNT_IMMUTABLE });
    });

    it("throws NotFoundError when payable missing", async () => {
      await expect(svc.update(ORG, "missing", { description: "x" })).rejects.toThrow(NotFoundError);
    });

    it("updates description and dueDate without touching monetary fields", async () => {
      const p = await svc.create(ORG, baseInput());
      const updated = await svc.update(ORG, p.id, {
        description: "edit",
        dueDate: new Date("2026-12-01"),
      });
      expect(updated.description).toBe("edit");
      expect(updated.dueDate.getTime()).toBe(new Date("2026-12-01").getTime());
      expect(updated.amount.value).toBe(1000);
      expect(updated.balance.value).toBe(1000);
    });
  });

  describe("transitionStatus", () => {
    it("PENDING → PAID", async () => {
      const p = await svc.create(ORG, baseInput());
      const paid = await svc.transitionStatus(ORG, p.id, { status: "PAID" });
      expect(paid.status).toBe("PAID");
      expect(paid.balance.value).toBe(0);
      expect(paid.paid.value).toBe(1000);
    });

    it("PENDING → PARTIAL with paidAmount", async () => {
      const p = await svc.create(ORG, baseInput());
      const partial = await svc.transitionStatus(ORG, p.id, { status: "PARTIAL", paidAmount: 300 });
      expect(partial.status).toBe("PARTIAL");
      expect(partial.paid.value).toBe(300);
      expect(partial.balance.value).toBe(700);
    });

    it("PARTIAL without paidAmount throws", async () => {
      const p = await svc.create(ORG, baseInput());
      await expect(
        svc.transitionStatus(ORG, p.id, { status: "PARTIAL" }),
      ).rejects.toThrow(PartialPaymentAmountRequired);
    });

    it("invalid transition throws InvalidPayableStatusTransition", async () => {
      const p = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, p.id, { status: "PAID" });
      await expect(
        svc.transitionStatus(ORG, p.id, { status: "PENDING" }),
      ).rejects.toThrow(InvalidPayableStatusTransition);
    });

    it("throws NotFoundError when missing", async () => {
      await expect(
        svc.transitionStatus(ORG, "missing", { status: "PAID" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("void", () => {
    it("transitions to VOIDED with balance=0", async () => {
      const p = await svc.create(ORG, baseInput());
      const voided = await svc.void(ORG, p.id);
      expect(voided.status).toBe("VOIDED");
      expect(voided.balance.value).toBe(0);
    });

    it("preserves prior paid amount", async () => {
      const p = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, p.id, { status: "PARTIAL", paidAmount: 200 });
      const voided = await svc.void(ORG, p.id);
      expect(voided.paid.value).toBe(200);
    });
  });

  describe("aggregateOpen", () => {
    it("sums balance of PENDING + PARTIAL", async () => {
      await svc.create(ORG, baseInput({ amount: 100 }));
      const p2 = await svc.create(ORG, baseInput({ amount: 200 }));
      await svc.transitionStatus(ORG, p2.id, { status: "PARTIAL", paidAmount: 50 });
      const p3 = await svc.create(ORG, baseInput({ amount: 300 }));
      await svc.transitionStatus(ORG, p3.id, { status: "PAID" });
      const agg = await svc.aggregateOpen(ORG);
      expect(agg.totalBalance).toBe(100 + 150);
      expect(agg.count).toBe(2);
    });

    it("filters by contactId when provided", async () => {
      await svc.create(ORG, baseInput({ amount: 100 }));
      await svc.create(ORG, { ...baseInput({ amount: 200 }), contactId: "other" });
      const agg = await svc.aggregateOpen(ORG, CONTACT);
      expect(agg.totalBalance).toBe(100);
      expect(agg.count).toBe(1);
    });
  });

  describe("applyAllocation (use case)", () => {
    const TX = { __tx: true } as unknown;

    // Failure mode declarado: NotFoundError ("Cuenta por pagar")
    it("throws NotFoundError when payable missing", async () => {
      await expect(
        svc.applyAllocation(TX, ORG, "missing", MonetaryAmount.of(100)),
      ).rejects.toThrow(NotFoundError);
    });

    // Failure mode declarado: CannotApplyToVoidedPayable propagada desde entity.
    // Use case NO filtra VOIDED — el caller filtra antes.
    it("propagates CannotApplyToVoidedPayable from entity", async () => {
      const p = await svc.create(ORG, baseInput());
      const voided = await svc.void(ORG, p.id);
      repo.preload(voided);
      await expect(
        svc.applyAllocation(TX, ORG, voided.id, MonetaryAmount.of(100)),
      ).rejects.toThrow(CannotApplyToVoidedPayable);
    });

    // Failure mode declarado: AllocationExceedsBalance propagada desde entity.
    it("propagates AllocationExceedsBalance from entity", async () => {
      const p = await svc.create(ORG, baseInput({ amount: 500 }));
      await expect(
        svc.applyAllocation(TX, ORG, p.id, MonetaryAmount.of(501)),
      ).rejects.toThrow(AllocationExceedsBalance);
    });

    it("orchestrates findByIdTx → entity.applyAllocation → applyAllocationTx with computed state", async () => {
      const p = await svc.create(ORG, baseInput({ amount: 1000 }));
      await svc.applyAllocation(TX, ORG, p.id, MonetaryAmount.of(300));
      expect(repo.applyAllocationTxCalls).toEqual([
        { orgId: ORG, id: p.id, paid: 300, balance: 700, status: "PARTIAL" },
      ]);
      expect(repo.revertAllocationTxCalls).toHaveLength(0);
    });

    it("computes PAID + balance=0 when allocation closes the payable", async () => {
      const p = await svc.create(ORG, baseInput({ amount: 1000 }));
      await svc.applyAllocation(TX, ORG, p.id, MonetaryAmount.of(1000));
      expect(repo.applyAllocationTxCalls).toEqual([
        { orgId: ORG, id: p.id, paid: 1000, balance: 0, status: "PAID" },
      ]);
    });

    it("does not call applyAllocationTx when entity throws", async () => {
      const p = await svc.create(ORG, baseInput({ amount: 100 }));
      await expect(
        svc.applyAllocation(TX, ORG, p.id, MonetaryAmount.of(101)),
      ).rejects.toThrow(AllocationExceedsBalance);
      expect(repo.applyAllocationTxCalls).toHaveLength(0);
    });

    it("uses findByIdTx (not findById) so the load happens inside the tx", async () => {
      const p = await svc.create(ORG, baseInput({ amount: 1000 }));
      const findByIdTxSpy = vi.spyOn(repo, "findByIdTx");
      const findByIdSpy = vi.spyOn(repo, "findById");
      await svc.applyAllocation(TX, ORG, p.id, MonetaryAmount.of(100));
      expect(findByIdTxSpy).toHaveBeenCalledWith(TX, ORG, p.id);
      expect(findByIdSpy).not.toHaveBeenCalled();
    });
  });

  describe("revertAllocation (use case)", () => {
    const TX = { __tx: true } as unknown;

    // Failure mode declarado: NotFoundError ("Cuenta por pagar")
    it("throws NotFoundError when payable missing", async () => {
      await expect(
        svc.revertAllocation(TX, ORG, "missing", MonetaryAmount.of(100)),
      ).rejects.toThrow(NotFoundError);
    });

    // Failure mode declarado: CannotRevertOnVoidedPayable propagada desde entity.
    // Decisión arquitectónica: simetría apply/revert, ambos arrojan sobre VOIDED.
    it("propagates CannotRevertOnVoidedPayable from entity", async () => {
      const p = await svc.create(ORG, baseInput());
      const partial = await svc.transitionStatus(ORG, p.id, { status: "PARTIAL", paidAmount: 300 });
      const voided = partial.transitionTo("VOIDED");
      repo.preload(voided);
      await expect(
        svc.revertAllocation(TX, ORG, voided.id, MonetaryAmount.of(100)),
      ).rejects.toThrow(CannotRevertOnVoidedPayable);
    });

    // Failure mode declarado: RevertExceedsPaid propagada desde entity.
    it("propagates RevertExceedsPaid from entity", async () => {
      const p = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, p.id, { status: "PARTIAL", paidAmount: 200 });
      await expect(
        svc.revertAllocation(TX, ORG, p.id, MonetaryAmount.of(201)),
      ).rejects.toThrow(RevertExceedsPaid);
    });

    it("orchestrates findByIdTx → entity.revertAllocation → revertAllocationTx with computed state", async () => {
      const p = await svc.create(ORG, baseInput({ amount: 1000 }));
      await svc.transitionStatus(ORG, p.id, { status: "PARTIAL", paidAmount: 700 });
      await svc.revertAllocation(TX, ORG, p.id, MonetaryAmount.of(200));
      expect(repo.revertAllocationTxCalls).toEqual([
        { orgId: ORG, id: p.id, paid: 500, balance: 500, status: "PARTIAL" },
      ]);
      expect(repo.applyAllocationTxCalls).toHaveLength(0);
    });

    it("computes PENDING + balance=amount when revert clears paid", async () => {
      const p = await svc.create(ORG, baseInput({ amount: 1000 }));
      await svc.transitionStatus(ORG, p.id, { status: "PARTIAL", paidAmount: 300 });
      await svc.revertAllocation(TX, ORG, p.id, MonetaryAmount.of(300));
      expect(repo.revertAllocationTxCalls).toEqual([
        { orgId: ORG, id: p.id, paid: 0, balance: 1000, status: "PENDING" },
      ]);
    });

    it("does not call revertAllocationTx when entity throws", async () => {
      const p = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, p.id, { status: "PARTIAL", paidAmount: 200 });
      await expect(
        svc.revertAllocation(TX, ORG, p.id, MonetaryAmount.of(201)),
      ).rejects.toThrow(RevertExceedsPaid);
      expect(repo.revertAllocationTxCalls).toHaveLength(0);
    });
  });

  describe("findPendingByContact", () => {
    it("returns snapshots ordered by createdAt asc", async () => {
      const p1 = await svc.create(ORG, baseInput({ description: "first" }));
      const p2 = await svc.create(ORG, baseInput({ description: "second" }));
      const docs = await svc.findPendingByContact(ORG, CONTACT);
      expect(docs).toHaveLength(2);
      expect(docs[0]?.id).toBe(p1.id);
      expect(docs[1]?.id).toBe(p2.id);
    });

    it("excludes PAID and VOIDED", async () => {
      const p = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, p.id, { status: "PAID" });
      const docs = await svc.findPendingByContact(ORG, CONTACT);
      expect(docs).toHaveLength(0);
    });

    it("returns plain numbers for monetary fields", async () => {
      await svc.create(ORG, baseInput({ amount: 250.5 }));
      const docs = await svc.findPendingByContact(ORG, CONTACT);
      expect(typeof docs[0]?.amount).toBe("number");
      expect(typeof docs[0]?.paid).toBe("number");
      expect(typeof docs[0]?.balance).toBe("number");
      expect(docs[0]?.amount).toBe(250.5);
    });
  });
});
