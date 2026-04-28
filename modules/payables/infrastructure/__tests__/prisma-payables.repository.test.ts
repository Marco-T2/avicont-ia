import { describe, it, expect, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PrismaPayablesRepository } from "../prisma-payables.repository";
import { Payable } from "../../domain/payable.entity";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

const dbWith = (overrides: Record<string, unknown>): PrismaClient =>
  ({ accountsPayable: overrides }) as unknown as PrismaClient;

const buildEntity = () =>
  Payable.create({
    organizationId: "org-1",
    contactId: "contact-1",
    description: "Factura proveedor",
    amount: 1000,
    dueDate: new Date("2026-05-15"),
  });

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "pay-1",
  organizationId: "org-1",
  contactId: "contact-1",
  description: "Factura proveedor",
  amount: new Prisma.Decimal(1000),
  paid: new Prisma.Decimal(0),
  balance: new Prisma.Decimal(1000),
  dueDate: new Date("2026-05-15"),
  status: "PENDING",
  sourceType: null,
  sourceId: null,
  journalEntryId: null,
  notes: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...override,
});

describe("PrismaPayablesRepository", () => {
  describe("findAll", () => {
    it("scopes by organizationId and orders by dueDate asc", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaPayablesRepository(dbWith({ findMany }));

      const result = await repo.findAll("org-1");

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1" },
        orderBy: { dueDate: "asc" },
      });
      expect(result).toHaveLength(1);
      expect(result[0]?.organizationId).toBe("org-1");
    });

    it("applies optional contactId/status/dueDate filters", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([]);
      const repo = new PrismaPayablesRepository(dbWith({ findMany }));

      const from = new Date("2026-01-01");
      const to = new Date("2026-12-31");
      await repo.findAll("org-1", {
        contactId: "c-1",
        status: "PARTIAL",
        dueDateFrom: from,
        dueDateTo: to,
      });

      expect(findMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          contactId: "c-1",
          status: "PARTIAL",
          dueDate: { gte: from, lte: to },
        },
        orderBy: { dueDate: "asc" },
      });
    });
  });

  describe("findById", () => {
    it("returns null when no row found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const repo = new PrismaPayablesRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "pay-1");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "pay-1", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    it("returns a Payable when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaPayablesRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "pay-1");

      expect(result?.id).toBe("pay-1");
    });
  });

  describe("save", () => {
    it("creates with the persistence payload of the entity", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaPayablesRepository(dbWith({ create }));

      const entity = buildEntity();
      await repo.save(entity);

      expect(create).toHaveBeenCalledTimes(1);
      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.id).toBe(entity.id);
      expect(callArg.data.amount).toBeInstanceOf(Prisma.Decimal);
      expect(callArg.data.balance.toString()).toBe("1000");
      expect(callArg.data.paid.toString()).toBe("0");
      expect(callArg.data.status).toBe("PENDING");
    });
  });

  describe("update", () => {
    it("scopes update by id+organizationId", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaPayablesRepository(dbWith({ update }));
      const entity = buildEntity().update({ description: "edit" });

      await repo.update(entity);

      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: entity.id, organizationId: "org-1" });
      expect(callArg.data.description).toBe("edit");
      expect(callArg.data.amount).toBeInstanceOf(Prisma.Decimal);
    });
  });

  describe("aggregateOpen", () => {
    it("filters by PENDING+PARTIAL and returns numeric balance", async () => {
      const aggregate = vi.fn().mockResolvedValueOnce({
        _sum: { balance: new Prisma.Decimal("1500.50") },
        _count: { id: 3 },
      });
      const repo = new PrismaPayablesRepository(dbWith({ aggregate }));

      const result = await repo.aggregateOpen("org-1");

      expect(aggregate).toHaveBeenCalledWith({
        where: { organizationId: "org-1", status: { in: ["PENDING", "PARTIAL"] } },
        _sum: { balance: true },
        _count: { id: true },
      });
      expect(result).toEqual({ totalBalance: 1500.5, count: 3 });
    });

    it("scopes by contactId when provided", async () => {
      const aggregate = vi.fn().mockResolvedValueOnce({
        _sum: { balance: null },
        _count: { id: 0 },
      });
      const repo = new PrismaPayablesRepository(dbWith({ aggregate }));

      const result = await repo.aggregateOpen("org-1", "c-1");

      expect(aggregate).toHaveBeenCalledWith({
        where: { organizationId: "org-1", contactId: "c-1", status: { in: ["PENDING", "PARTIAL"] } },
        _sum: { balance: true },
        _count: { id: true },
      });
      expect(result).toEqual({ totalBalance: 0, count: 0 });
    });
  });

  describe("findPendingByContact", () => {
    it("returns plain-number snapshots ordered by createdAt asc", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([
        {
          id: "p1",
          description: "x",
          amount: new Prisma.Decimal(100),
          paid: new Prisma.Decimal(20),
          balance: new Prisma.Decimal(80),
          dueDate: new Date("2026-05-15"),
          sourceType: "purchase",
          sourceId: "p-1",
          createdAt: new Date("2026-04-01"),
        },
      ]);
      const repo = new PrismaPayablesRepository(dbWith({ findMany }));

      const result = await repo.findPendingByContact("org-1", "c-1");

      expect(findMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", contactId: "c-1", status: { in: ["PENDING", "PARTIAL"] } },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          description: true,
          amount: true,
          paid: true,
          balance: true,
          dueDate: true,
          sourceType: true,
          sourceId: true,
          createdAt: true,
        },
      });
      expect(result).toEqual([
        {
          id: "p1",
          description: "x",
          amount: 100,
          paid: 20,
          balance: 80,
          dueDate: new Date("2026-05-15"),
          sourceType: "purchase",
          sourceId: "p-1",
          createdAt: new Date("2026-04-01"),
        },
      ]);
    });
  });

  describe("createTx", () => {
    it("creates inside the supplied tx with PENDING + paid=0 + balance=amount", async () => {
      const create = vi.fn().mockResolvedValueOnce({ id: "new-pay" });
      const tx = { accountsPayable: { create } };
      const repo = new PrismaPayablesRepository(dbWith({}));

      const result = await repo.createTx(tx, {
        organizationId: "org-1",
        contactId: "c-1",
        description: "Purchase",
        amount: 500,
        dueDate: new Date("2026-05-15"),
        sourceType: "purchase",
        sourceId: "p-1",
        journalEntryId: "je-1",
      });

      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.amount.toString()).toBe("500");
      expect(callArg.data.paid.toString()).toBe("0");
      expect(callArg.data.balance.toString()).toBe("500");
      expect(callArg.data.status).toBe("PENDING");
      expect(callArg.data.sourceType).toBe("purchase");
      expect(callArg.data.journalEntryId).toBe("je-1");
      expect(callArg.select).toEqual({ id: true });
      expect(result).toEqual({ id: "new-pay" });
    });

    it("omits optional fields when undefined", async () => {
      const create = vi.fn().mockResolvedValueOnce({ id: "new-pay" });
      const tx = { accountsPayable: { create } };
      const repo = new PrismaPayablesRepository(dbWith({}));

      await repo.createTx(tx, {
        organizationId: "org-1",
        contactId: "c-1",
        description: "x",
        amount: 100,
        dueDate: new Date("2026-05-15"),
      });

      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.sourceType).toBeUndefined();
      expect(callArg.data.sourceId).toBeUndefined();
      expect(callArg.data.journalEntryId).toBeUndefined();
    });
  });

  describe("voidTx", () => {
    it("updates inside tx with status=VOIDED and balance=0", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = { accountsPayable: { update } };
      const repo = new PrismaPayablesRepository(dbWith({}));

      await repo.voidTx(tx, "org-1", "pay-1");

      expect(update).toHaveBeenCalledWith({
        where: { id: "pay-1", organizationId: "org-1" },
        data: { status: "VOIDED", balance: expect.any(Prisma.Decimal) },
      });
      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.data.balance.toString()).toBe("0");
    });
  });

  describe("findByIdTx", () => {
    it("scopes by id+organizationId via the supplied tx and returns null when missing", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const tx = { accountsPayable: { findFirst } };
      const repo = new PrismaPayablesRepository(dbWith({}));

      const result = await repo.findByIdTx(tx, "org-1", "pay-missing");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "pay-missing", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    it("returns a Payable when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const tx = { accountsPayable: { findFirst } };
      const repo = new PrismaPayablesRepository(dbWith({}));

      const result = await repo.findByIdTx(tx, "org-1", "pay-1");

      expect(result?.id).toBe("pay-1");
    });
  });

  describe("applyAllocationTx", () => {
    it("updates inside tx with computed paid+balance+status (no business logic in adapter)", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = { accountsPayable: { update } };
      const repo = new PrismaPayablesRepository(dbWith({}));

      await repo.applyAllocationTx(
        tx,
        "org-1",
        "pay-1",
        MonetaryAmount.of(700),
        MonetaryAmount.of(300),
        "PARTIAL",
      );

      expect(update).toHaveBeenCalledTimes(1);
      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: "pay-1", organizationId: "org-1" });
      expect(callArg.data.status).toBe("PARTIAL");
      expect(callArg.data.paid).toBeInstanceOf(Prisma.Decimal);
      expect(callArg.data.balance).toBeInstanceOf(Prisma.Decimal);
      expect(callArg.data.paid.toString()).toBe("700");
      expect(callArg.data.balance.toString()).toBe("300");
    });
  });

  describe("revertAllocationTx", () => {
    it("updates inside tx with computed paid+balance+status (no business logic in adapter)", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = { accountsPayable: { update } };
      const repo = new PrismaPayablesRepository(dbWith({}));

      await repo.revertAllocationTx(
        tx,
        "org-1",
        "pay-1",
        MonetaryAmount.zero(),
        MonetaryAmount.of(1000),
        "PENDING",
      );

      expect(update).toHaveBeenCalledTimes(1);
      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: "pay-1", organizationId: "org-1" });
      expect(callArg.data.status).toBe("PENDING");
      expect(callArg.data.paid.toString()).toBe("0");
      expect(callArg.data.balance.toString()).toBe("1000");
    });
  });

  describe("withTransaction", () => {
    it("returns a new repo bound to the tx client", async () => {
      const txCreate = vi.fn().mockResolvedValueOnce(undefined);
      const tx = { accountsPayable: { create: txCreate } } as unknown as Prisma.TransactionClient;
      const baseDb = dbWith({ create: vi.fn() });
      const repo = new PrismaPayablesRepository(baseDb);

      await repo.withTransaction(tx).save(buildEntity());

      expect(txCreate).toHaveBeenCalled();
    });
  });
});
