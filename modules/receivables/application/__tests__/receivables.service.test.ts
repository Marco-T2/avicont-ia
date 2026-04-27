import { describe, it, expect, beforeEach } from "vitest";
import { ReceivablesService } from "../receivables.service";
import { Receivable } from "../../domain/receivable.entity";
import type {
  ReceivableRepository,
  ReceivableFilters,
  OpenAggregate,
  PendingDocumentSnapshot,
  CreateReceivableTxData,
} from "../../domain/receivable.repository";
import type { ContactExistencePort } from "../../domain/ports/contact-existence.port";
import {
  NotFoundError,
  RECEIVABLE_AMOUNT_IMMUTABLE,
} from "@/features/shared/errors";
import {
  InvalidReceivableStatusTransition,
  PartialPaymentAmountRequired,
} from "../../domain/errors/receivable-errors";

class InMemoryReceivableRepository implements ReceivableRepository {
  private readonly store = new Map<string, Receivable>();

  reset() {
    this.store.clear();
  }

  preload(...receivables: Receivable[]) {
    for (const r of receivables) this.store.set(r.id, r);
  }

  async findAll(orgId: string, filters?: ReceivableFilters): Promise<Receivable[]> {
    return [...this.store.values()].filter((r) => {
      if (r.organizationId !== orgId) return false;
      if (filters?.contactId && r.contactId !== filters.contactId) return false;
      if (filters?.status && r.status !== filters.status) return false;
      return true;
    });
  }

  async findById(orgId: string, id: string): Promise<Receivable | null> {
    const r = this.store.get(id);
    return r && r.organizationId === orgId ? r : null;
  }

  async save(r: Receivable): Promise<void> {
    this.store.set(r.id, r);
  }

  async update(r: Receivable): Promise<void> {
    this.store.set(r.id, r);
  }

  async aggregateOpen(orgId: string, contactId?: string): Promise<OpenAggregate> {
    const open = [...this.store.values()].filter((r) => {
      if (r.organizationId !== orgId) return false;
      if (contactId && r.contactId !== contactId) return false;
      return r.status === "PENDING" || r.status === "PARTIAL";
    });
    return {
      totalBalance: open.reduce((acc, r) => acc + r.balance.value, 0),
      count: open.length,
    };
  }

  async findPendingByContact(
    orgId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]> {
    return [...this.store.values()]
      .filter(
        (r) =>
          r.organizationId === orgId &&
          r.contactId === contactId &&
          (r.status === "PENDING" || r.status === "PARTIAL"),
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((r) => ({
        id: r.id,
        description: r.description,
        amount: r.amount.value,
        paid: r.paid.value,
        balance: r.balance.value,
        dueDate: r.dueDate,
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        createdAt: r.createdAt,
      }));
  }

  async createTx(_tx: unknown, _data: CreateReceivableTxData): Promise<{ id: string }> {
    return { id: "tx-not-tested-here" };
  }

  async voidTx(_tx: unknown, _orgId: string, _id: string): Promise<void> {
    /* no-op */
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
  description: override.description ?? "Factura 0001",
  amount: override.amount ?? 1000,
  dueDate: override.dueDate ?? new Date("2026-05-15"),
});

describe("ReceivablesService", () => {
  let repo: InMemoryReceivableRepository;
  let contacts: StubContactExistencePort;
  let svc: ReceivablesService;

  beforeEach(() => {
    repo = new InMemoryReceivableRepository();
    contacts = new StubContactExistencePort();
    svc = new ReceivablesService(repo, contacts);
  });

  describe("list", () => {
    it("returns receivables scoped to org", async () => {
      const r = await svc.create(ORG, baseInput());
      const items = await svc.list(ORG);
      expect(items).toHaveLength(1);
      expect(items[0]?.id).toBe(r.id);
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
      const r = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, r.id, { status: "PAID" });
      const pending = await svc.list(ORG, { status: "PENDING" });
      const paid = await svc.list(ORG, { status: "PAID" });
      expect(pending).toHaveLength(0);
      expect(paid).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("returns the receivable when found", async () => {
      const r = await svc.create(ORG, baseInput());
      const found = await svc.getById(ORG, r.id);
      expect(found.id).toBe(r.id);
    });

    it("throws NotFoundError when missing", async () => {
      await expect(svc.getById(ORG, "missing")).rejects.toThrow(NotFoundError);
    });

    it("does not return receivables from other orgs", async () => {
      const r = await svc.create(ORG, baseInput());
      await expect(svc.getById("other-org", r.id)).rejects.toThrow(NotFoundError);
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

    it("returns a PENDING receivable with balance = amount", async () => {
      const r = await svc.create(ORG, baseInput({ amount: 500 }));
      expect(r.status).toBe("PENDING");
      expect(r.amount.value).toBe(500);
      expect(r.balance.value).toBe(500);
      expect(r.paid.value).toBe(0);
      expect(r.organizationId).toBe(ORG);
    });
  });

  describe("update", () => {
    it("rejects amount in input with RECEIVABLE_AMOUNT_IMMUTABLE", async () => {
      const r = await svc.create(ORG, baseInput());
      await expect(
        svc.update(ORG, r.id, { amount: 999 } as never),
      ).rejects.toMatchObject({ code: RECEIVABLE_AMOUNT_IMMUTABLE });
    });

    it("throws NotFoundError when receivable missing", async () => {
      await expect(svc.update(ORG, "missing", { description: "x" })).rejects.toThrow(NotFoundError);
    });

    it("updates description and dueDate without touching monetary fields", async () => {
      const r = await svc.create(ORG, baseInput());
      const updated = await svc.update(ORG, r.id, {
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
      const r = await svc.create(ORG, baseInput());
      const paid = await svc.transitionStatus(ORG, r.id, { status: "PAID" });
      expect(paid.status).toBe("PAID");
      expect(paid.balance.value).toBe(0);
      expect(paid.paid.value).toBe(1000);
    });

    it("PENDING → PARTIAL with paidAmount", async () => {
      const r = await svc.create(ORG, baseInput());
      const partial = await svc.transitionStatus(ORG, r.id, { status: "PARTIAL", paidAmount: 300 });
      expect(partial.status).toBe("PARTIAL");
      expect(partial.paid.value).toBe(300);
      expect(partial.balance.value).toBe(700);
    });

    it("PARTIAL without paidAmount throws", async () => {
      const r = await svc.create(ORG, baseInput());
      await expect(
        svc.transitionStatus(ORG, r.id, { status: "PARTIAL" }),
      ).rejects.toThrow(PartialPaymentAmountRequired);
    });

    it("invalid transition throws InvalidReceivableStatusTransition", async () => {
      const r = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, r.id, { status: "PAID" });
      await expect(
        svc.transitionStatus(ORG, r.id, { status: "PENDING" }),
      ).rejects.toThrow(InvalidReceivableStatusTransition);
    });

    it("throws NotFoundError when missing", async () => {
      await expect(
        svc.transitionStatus(ORG, "missing", { status: "PAID" }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("void", () => {
    it("transitions to VOIDED with balance=0", async () => {
      const r = await svc.create(ORG, baseInput());
      const voided = await svc.void(ORG, r.id);
      expect(voided.status).toBe("VOIDED");
      expect(voided.balance.value).toBe(0);
    });

    it("preserves prior paid amount", async () => {
      const r = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, r.id, { status: "PARTIAL", paidAmount: 200 });
      const voided = await svc.void(ORG, r.id);
      expect(voided.paid.value).toBe(200);
    });
  });

  describe("aggregateOpen", () => {
    it("sums balance of PENDING + PARTIAL", async () => {
      await svc.create(ORG, baseInput({ amount: 100 }));
      const r2 = await svc.create(ORG, baseInput({ amount: 200 }));
      await svc.transitionStatus(ORG, r2.id, { status: "PARTIAL", paidAmount: 50 });
      const r3 = await svc.create(ORG, baseInput({ amount: 300 }));
      await svc.transitionStatus(ORG, r3.id, { status: "PAID" });
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

  describe("findPendingByContact", () => {
    it("returns snapshots ordered by createdAt asc", async () => {
      const r1 = await svc.create(ORG, baseInput({ description: "first" }));
      const r2 = await svc.create(ORG, baseInput({ description: "second" }));
      const docs = await svc.findPendingByContact(ORG, CONTACT);
      expect(docs).toHaveLength(2);
      expect(docs[0]?.id).toBe(r1.id);
      expect(docs[1]?.id).toBe(r2.id);
    });

    it("excludes PAID and VOIDED", async () => {
      const r = await svc.create(ORG, baseInput());
      await svc.transitionStatus(ORG, r.id, { status: "PAID" });
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
