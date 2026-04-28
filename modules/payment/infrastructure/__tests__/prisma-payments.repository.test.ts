import { describe, it, expect, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PrismaPaymentsRepository } from "../prisma-payments.repository";
import { Payment } from "../../domain/payment.entity";
import { PaymentAllocation } from "../../domain/payment-allocation.entity";
import { AllocationTarget } from "../../domain/value-objects/allocation-target";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

// ── Mock DB helpers ──────────────────────────────────────────────────────────

const dbWith = (
  paymentOverrides: Record<string, unknown> = {},
  allocationOverrides: Record<string, unknown> = {},
  receivableOverrides: Record<string, unknown> = {},
): PrismaClient =>
  ({
    payment: paymentOverrides,
    paymentAllocation: allocationOverrides,
    accountsReceivable: receivableOverrides,
    $transaction: vi.fn(),
  }) as unknown as PrismaClient;

// ── Fixture builders ─────────────────────────────────────────────────────────

const NOW = new Date("2026-04-27T10:00:00Z");

/** Build a minimal Payment row as Prisma would return it (no allocations). */
const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "pay-1",
  organizationId: "org-1",
  status: "DRAFT",
  method: "EFECTIVO",
  date: NOW,
  amount: new Prisma.Decimal("1000"),
  description: "Test payment",
  periodId: "period-1",
  contactId: "contact-1",
  referenceNumber: null,
  journalEntryId: null,
  notes: null,
  accountCode: null,
  operationalDocTypeId: null,
  createdById: "user-1",
  createdAt: NOW,
  updatedAt: NOW,
  allocations: [],
  ...override,
});

/** Build a minimal PaymentAllocation row as Prisma would return it. */
const buildAllocRow = (override: Record<string, unknown> = {}) => ({
  id: "alloc-1",
  paymentId: "pay-1",
  receivableId: "rec-1",
  payableId: null,
  amount: new Prisma.Decimal("500"),
  ...override,
});

/** Build a Payment domain entity for write tests. */
const buildEntity = (override: Partial<Parameters<typeof Payment.fromPersistence>[0]> = {}) =>
  Payment.fromPersistence({
    id: "pay-1",
    organizationId: "org-1",
    status: "DRAFT",
    method: "EFECTIVO",
    date: NOW,
    amount: MonetaryAmount.of(1000),
    description: "Test payment",
    periodId: "period-1",
    contactId: "contact-1",
    referenceNumber: null,
    journalEntryId: null,
    notes: null,
    accountCode: null,
    operationalDocTypeId: null,
    createdById: "user-1",
    createdAt: NOW,
    updatedAt: NOW,
    allocations: [],
    ...override,
  });

/** Build a PaymentAllocation domain entity. */
const buildAllocation = (receivableId = "rec-1", amount = 500) =>
  PaymentAllocation.fromPersistence({
    id: "alloc-1",
    paymentId: "pay-1",
    target: AllocationTarget.forReceivable(receivableId),
    amount: MonetaryAmount.of(amount),
  });

// ── Tests ────────────────────────────────────────────────────────────────────

describe("PrismaPaymentsRepository", () => {
  // ── findById ──────────────────────────────────────────────────────────────

  describe("findById", () => {
    it("returns null when no row found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaPaymentsRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "pay-missing");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "pay-missing", organizationId: "org-1" },
        include: { allocations: true },
      });
      expect(result).toBeNull();
    });

    it("returns a Payment entity when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaPaymentsRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "pay-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("pay-1");
      expect(result?.organizationId).toBe("org-1");
      expect(result?.amount).toBeInstanceOf(MonetaryAmount);
      expect(result?.amount.value).toBe(1000);
    });

    it("maps allocations to PaymentAllocation entities", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(
        buildRow({ allocations: [buildAllocRow()] }),
      );
      const repo = new PrismaPaymentsRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "pay-1");

      expect(result?.allocations).toHaveLength(1);
      const alloc = result!.allocations[0]!;
      expect(alloc).toBeInstanceOf(PaymentAllocation);
      expect(alloc.receivableId).toBe("rec-1");
      expect(alloc.amount.value).toBe(500);
    });
  });

  // ── findByIdTx ────────────────────────────────────────────────────────────

  describe("findByIdTx", () => {
    it("returns null when no row found via tx", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const tx = { payment: { findFirst }, paymentAllocation: {} };
      const repo = new PrismaPaymentsRepository(dbWith());

      const result = await repo.findByIdTx(tx, "org-1", "pay-missing");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "pay-missing", organizationId: "org-1" },
        include: { allocations: true },
      });
      expect(result).toBeNull();
    });

    it("returns a Payment entity when found via tx", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const tx = { payment: { findFirst }, paymentAllocation: {} };
      const repo = new PrismaPaymentsRepository(dbWith());

      const result = await repo.findByIdTx(tx, "org-1", "pay-1");

      expect(result?.id).toBe("pay-1");
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe("findAll", () => {
    it("scopes by organizationId and orders by createdAt desc", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaPaymentsRepository(dbWith({ findMany }));

      const result = await repo.findAll("org-1");

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        include: { allocations: true },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toHaveLength(1);
    });

    it("applies status filter", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([]);
      const repo = new PrismaPaymentsRepository(dbWith({ findMany }));

      await repo.findAll("org-1", { status: "POSTED" });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org-1", status: "POSTED" },
        }),
      );
    });

    it("applies method filter", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([]);
      const repo = new PrismaPaymentsRepository(dbWith({ findMany }));

      await repo.findAll("org-1", { method: "EFECTIVO" });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organizationId: "org-1", method: "EFECTIVO" },
        }),
      );
    });

    it("applies contactId + periodId + date range filters", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([]);
      const repo = new PrismaPaymentsRepository(dbWith({ findMany }));
      const from = new Date("2026-01-01");
      const to = new Date("2026-12-31");

      await repo.findAll("org-1", {
        contactId: "c-1",
        periodId: "p-1",
        dateFrom: from,
        dateTo: to,
      });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            organizationId: "org-1",
            contactId: "c-1",
            periodId: "p-1",
            date: { gte: from, lte: to },
          },
        }),
      );
    });
  });

  // ── save ──────────────────────────────────────────────────────────────────

  describe("save", () => {
    it("creates payment row with Decimal amount and empty allocations", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaPaymentsRepository(dbWith({ create }));

      await repo.save(buildEntity());

      expect(create).toHaveBeenCalledTimes(1);
      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.id).toBe("pay-1");
      expect(callArg.data.organizationId).toBe("org-1");
      expect(callArg.data.amount).toBeInstanceOf(Prisma.Decimal);
      expect(callArg.data.amount.toString()).toBe("1000");
      expect(callArg.data.status).toBe("DRAFT");
    });

    it("creates payment with nested allocations", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaPaymentsRepository(dbWith({ create }));
      const entity = buildEntity({ allocations: [buildAllocation()] });

      await repo.save(entity);

      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.allocations.create).toHaveLength(1);
      const alloc = callArg.data.allocations.create[0];
      expect(alloc.id).toBe("alloc-1");
      expect(alloc.receivableId).toBe("rec-1");
      expect(alloc.payableId).toBeNull();
      expect(alloc.amount).toBeInstanceOf(Prisma.Decimal);
      expect(alloc.amount.toString()).toBe("500");
    });
  });

  // ── saveTx ────────────────────────────────────────────────────────────────

  describe("saveTx", () => {
    it("creates inside supplied tx", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const tx = { payment: { create }, paymentAllocation: {} };
      const repo = new PrismaPaymentsRepository(dbWith());

      await repo.saveTx(tx, buildEntity());

      expect(create).toHaveBeenCalledTimes(1);
      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.id).toBe("pay-1");
      expect(callArg.data.amount).toBeInstanceOf(Prisma.Decimal);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe("update", () => {
    it("updates payment scalars scoped by id+organizationId", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const deleteMany = vi.fn().mockResolvedValueOnce(undefined);
      const createMany = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaPaymentsRepository(
        dbWith({ update }, { deleteMany, createMany }),
      );

      const entity = buildEntity({ description: "Updated" });
      await repo.update(entity);

      expect(update).toHaveBeenCalledTimes(1);
      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: "pay-1", organizationId: "org-1" });
      expect(callArg.data.description).toBe("Updated");
      expect(callArg.data.amount).toBeInstanceOf(Prisma.Decimal);
    });

    it("deletes then recreates allocations atomically", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const deleteMany = vi.fn().mockResolvedValueOnce(undefined);
      const createMany = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaPaymentsRepository(
        dbWith({ update }, { deleteMany, createMany }),
      );
      const entity = buildEntity({ allocations: [buildAllocation()] });

      await repo.update(entity);

      expect(deleteMany).toHaveBeenCalledWith({ where: { paymentId: "pay-1" } });
      expect(createMany).toHaveBeenCalledTimes(1);
      const cmArg = createMany.mock.calls[0]?.[0];
      expect(cmArg.data).toHaveLength(1);
      expect(cmArg.data[0].receivableId).toBe("rec-1");
      expect(cmArg.data[0].amount).toBeInstanceOf(Prisma.Decimal);
    });
  });

  // ── updateTx ──────────────────────────────────────────────────────────────

  describe("updateTx", () => {
    it("updates + delete/recreate allocations inside supplied tx", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const deleteMany = vi.fn().mockResolvedValueOnce(undefined);
      const createMany = vi.fn().mockResolvedValueOnce(undefined);
      const tx = {
        payment: { update },
        paymentAllocation: { deleteMany, createMany },
      };
      const repo = new PrismaPaymentsRepository(dbWith());
      const entity = buildEntity({ allocations: [buildAllocation()] });

      await repo.updateTx(tx, entity);

      expect(deleteMany).toHaveBeenCalledWith({ where: { paymentId: "pay-1" } });
      expect(update).toHaveBeenCalledTimes(1);
      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: "pay-1", organizationId: "org-1" });
      expect(callArg.data.amount).toBeInstanceOf(Prisma.Decimal);
    });
  });

  // ── delete ────────────────────────────────────────────────────────────────

  describe("delete", () => {
    it("deletes payment scoped by id+organizationId", async () => {
      const deleteOp = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaPaymentsRepository(dbWith({ delete: deleteOp }));

      await repo.delete("org-1", "pay-1");

      expect(deleteOp).toHaveBeenCalledWith({
        where: { id: "pay-1", organizationId: "org-1" },
      });
    });
  });

  // ── deleteTx ──────────────────────────────────────────────────────────────

  describe("deleteTx", () => {
    it("deletes payment inside supplied tx", async () => {
      const deleteOp = vi.fn().mockResolvedValueOnce(undefined);
      const tx = { payment: { delete: deleteOp }, paymentAllocation: {} };
      const repo = new PrismaPaymentsRepository(dbWith());

      await repo.deleteTx(tx, "org-1", "pay-1");

      expect(deleteOp).toHaveBeenCalledWith({
        where: { id: "pay-1", organizationId: "org-1" },
      });
    });
  });

  // ── findUnappliedByContact ────────────────────────────────────────────────

  describe("findUnappliedByContact", () => {
    it("queries non-voided payments for contact, ordered by date asc", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([]);
      const repo = new PrismaPaymentsRepository(dbWith({ findMany }));

      await repo.findUnappliedByContact("org-1", "c-1");

      expect(findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          contactId: "c-1",
          status: { not: "VOIDED" },
        },
        include: { allocations: { select: { amount: true } } },
        orderBy: { date: "asc" },
      });
    });

    it("excludes a specific payment when excludePaymentId provided", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([]);
      const repo = new PrismaPaymentsRepository(dbWith({ findMany }));

      await repo.findUnappliedByContact("org-1", "c-1", "pay-excluded");

      const callArg = findMany.mock.calls[0]?.[0];
      expect(callArg.where.id).toEqual({ not: "pay-excluded" });
    });

    it("filters out payments with no unapplied funds, returns plain snapshots", async () => {
      const rows = [
        // 1000 payment, 1000 allocated → available = 0, should be filtered out
        {
          id: "p1",
          date: NOW,
          amount: new Prisma.Decimal("1000"),
          description: "Fully applied",
          allocations: [{ amount: new Prisma.Decimal("1000") }],
        },
        // 500 payment, 200 allocated → available = 300, included
        {
          id: "p2",
          date: NOW,
          amount: new Prisma.Decimal("500"),
          description: "Partial",
          allocations: [{ amount: new Prisma.Decimal("200") }],
        },
      ];
      const findMany = vi.fn().mockResolvedValueOnce(rows);
      const repo = new PrismaPaymentsRepository(dbWith({ findMany }));

      const result = await repo.findUnappliedByContact("org-1", "c-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("p2");
      expect(result[0]!.available).toBe(300);
      expect(result[0]!.totalAllocated).toBe(200);
      expect(result[0]!.amount).toBe(500);
    });
  });

  // ── getCustomerBalance ────────────────────────────────────────────────────

  describe("getCustomerBalance", () => {
    it("returns zero-balance when no data exists", async () => {
      const aggMock = vi.fn()
        .mockResolvedValueOnce({ _sum: { amount: null } }) // totalInvoiced
        .mockResolvedValueOnce({ _sum: { amount: null } }) // totalCashPaid
        .mockResolvedValueOnce({ _sum: { amount: null } }); // totalAllocated
      const db2 = {
        payment: { aggregate: aggMock },
        paymentAllocation: { aggregate: aggMock },
        accountsReceivable: { aggregate: aggMock },
        $transaction: vi.fn(),
      } as unknown as PrismaClient;
      const repo2 = new PrismaPaymentsRepository(db2);

      const result = await repo2.getCustomerBalance("org-1", "c-1");

      expect(result).toEqual({
        totalInvoiced: 0,
        totalPaid: 0,
        netBalance: 0,
        unappliedCredit: 0,
      });
    });

    it("computes balance from 3 aggregate queries", async () => {
      // totalInvoiced = 2000, totalPaid = 1500, totalAllocated = 1200
      // netBalance = 2000 - 1500 = 500
      // unappliedCredit = max(0, 1500 - 1200) = 300
      const aggCxc = vi.fn().mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("2000") },
      });
      const aggPayments = vi.fn().mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("1500") },
      });
      const aggAllocations = vi.fn().mockResolvedValueOnce({
        _sum: { amount: new Prisma.Decimal("1200") },
      });
      const db = {
        accountsReceivable: { aggregate: aggCxc },
        payment: { aggregate: aggPayments },
        paymentAllocation: { aggregate: aggAllocations },
        $transaction: vi.fn(),
      } as unknown as PrismaClient;
      const repo = new PrismaPaymentsRepository(db);

      const result = await repo.getCustomerBalance("org-1", "c-1");

      expect(result.totalInvoiced).toBe(2000);
      expect(result.totalPaid).toBe(1500);
      expect(result.netBalance).toBe(500);
      expect(result.unappliedCredit).toBe(300);
    });

    it("clamps unappliedCredit to 0 when allocations exceed payments", async () => {
      const aggCxc = vi.fn().mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("0") } });
      const aggPayments = vi.fn().mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("100") } });
      // allocations > payments (shouldn't happen in production, but guard against it)
      const aggAllocations = vi.fn().mockResolvedValueOnce({ _sum: { amount: new Prisma.Decimal("200") } });
      const db = {
        accountsReceivable: { aggregate: aggCxc },
        payment: { aggregate: aggPayments },
        paymentAllocation: { aggregate: aggAllocations },
        $transaction: vi.fn(),
      } as unknown as PrismaClient;
      const repo = new PrismaPaymentsRepository(db);

      const result = await repo.getCustomerBalance("org-1", "c-1");

      expect(result.unappliedCredit).toBe(0);
    });
  });

  // ── transaction ───────────────────────────────────────────────────────────

  describe("transaction", () => {
    it("delegates to db.$transaction with the callback", async () => {
      const txResult = { id: "tx-result" };
      const $transaction = vi.fn().mockResolvedValueOnce(txResult);
      const db = {
        payment: {},
        paymentAllocation: {},
        accountsReceivable: {},
        $transaction,
      } as unknown as PrismaClient;
      const repo = new PrismaPaymentsRepository(db);
      const fn = vi.fn().mockResolvedValueOnce(txResult);

      const result = await repo.transaction(fn);

      expect($transaction).toHaveBeenCalledWith(fn, undefined);
      expect(result).toBe(txResult);
    });

    it("passes options to db.$transaction", async () => {
      const $transaction = vi.fn().mockResolvedValueOnce(undefined);
      const db = {
        payment: {},
        paymentAllocation: {},
        accountsReceivable: {},
        $transaction,
      } as unknown as PrismaClient;
      const repo = new PrismaPaymentsRepository(db);
      const fn = vi.fn();

      await repo.transaction(fn, { timeout: 5000, maxWait: 2000 });

      expect($transaction).toHaveBeenCalledWith(fn, { timeout: 5000, maxWait: 2000 });
    });
  });
});
