import { describe, it, expect, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PrismaReceivablesRepository } from "../prisma-receivables.repository";
import { Receivable } from "../../domain/receivable.entity";
import type { ReceivableStatus } from "../../domain/value-objects/receivable-status";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

const dbWith = (overrides: Record<string, unknown>): PrismaClient =>
  ({
    accountsReceivable: overrides,
    journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }) as unknown as PrismaClient;

/** Tx mock with the journalEntry delegate the settlement sync (D1) targets. */
const txWith = (overrides: Record<string, unknown>) => ({
  accountsReceivable: overrides,
  journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
});

/** Rehydrated entity in an arbitrary status for settlement-sync cases. */
const rehydrate = (
  status: ReceivableStatus,
  journalEntryId: string | null = "je-1",
) =>
  Receivable.fromPersistence({
    id: "rec-1",
    organizationId: "org-1",
    contactId: "contact-1",
    description: "Factura",
    amount: MonetaryAmount.of(1000),
    paid: MonetaryAmount.zero(),
    balance: MonetaryAmount.of(1000),
    dueDate: new Date("2026-05-15"),
    status,
    sourceType: null,
    sourceId: null,
    journalEntryId,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

const buildEntity = () =>
  Receivable.create({
    organizationId: "org-1",
    contactId: "contact-1",
    description: "Factura",
    amount: 1000,
    dueDate: new Date("2026-05-15"),
  });

const buildRow = (override: Record<string, unknown> = {}) => ({
  id: "rec-1",
  organizationId: "org-1",
  contactId: "contact-1",
  description: "Factura",
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

describe("PrismaReceivablesRepository", () => {
  describe("findAll", () => {
    it("scopes by organizationId and orders by dueDate asc", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([buildRow()]);
      const repo = new PrismaReceivablesRepository(dbWith({ findMany }));

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
      const repo = new PrismaReceivablesRepository(dbWith({ findMany }));

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
      const repo = new PrismaReceivablesRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "rec-1");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "rec-1", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    it("returns a Receivable when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const repo = new PrismaReceivablesRepository(dbWith({ findFirst }));

      const result = await repo.findById("org-1", "rec-1");

      expect(result?.id).toBe("rec-1");
    });
  });

  describe("save", () => {
    it("creates with the persistence payload of the entity", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const repo = new PrismaReceivablesRepository(dbWith({ create }));

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
      const repo = new PrismaReceivablesRepository(dbWith({ update }));
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
      const repo = new PrismaReceivablesRepository(dbWith({ aggregate }));

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
      const repo = new PrismaReceivablesRepository(dbWith({ aggregate }));

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
    it("returns plain-number snapshots ordered by createdAt asc, includes sourceTypeCode + sale meta (referenceNumber, sourceDate)", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([
        {
          id: "r1",
          description: "x",
          amount: new Prisma.Decimal(100),
          paid: new Prisma.Decimal(20),
          balance: new Prisma.Decimal(80),
          dueDate: new Date("2026-05-15"),
          sourceType: "sale",
          sourceId: "s-1",
          sourceTypeCode: "VG",
          createdAt: new Date("2026-04-01"),
          sale: { referenceNumber: 99, date: new Date("2026-03-20") },
          dispatch: null,
        },
      ]);
      const repo = new PrismaReceivablesRepository(dbWith({ findMany }));

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
          sourceTypeCode: true,
          createdAt: true,
          sale: { select: { referenceNumber: true, date: true } },
          dispatch: { select: { referenceNumber: true, date: true } },
        },
      });
      expect(result).toEqual([
        {
          id: "r1",
          description: "x",
          amount: 100,
          paid: 20,
          balance: 80,
          dueDate: new Date("2026-05-15"),
          sourceType: "sale",
          sourceId: "s-1",
          sourceTypeCode: "VG",
          createdAt: new Date("2026-04-01"),
          referenceNumber: 99,
          sourceDate: new Date("2026-03-20"),
        },
      ]);
    });

    it("maps dispatch-sourced AR to dispatch meta (referenceNumber, sourceDate)", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([
        {
          id: "r2",
          description: "ND123",
          amount: new Prisma.Decimal(500),
          paid: new Prisma.Decimal(0),
          balance: new Prisma.Decimal(500),
          dueDate: new Date("2026-06-01"),
          sourceType: "dispatch",
          sourceId: "d-1",
          sourceTypeCode: "ND",
          createdAt: new Date("2026-05-01"),
          sale: null,
          dispatch: { referenceNumber: 123, date: new Date("2026-04-15") },
        },
      ]);
      const repo = new PrismaReceivablesRepository(dbWith({ findMany }));

      const result = await repo.findPendingByContact("org-1", "c-1");

      expect(result[0]).toMatchObject({
        sourceType: "dispatch",
        sourceTypeCode: "ND",
        referenceNumber: 123,
        sourceDate: new Date("2026-04-15"),
      });
    });

    it("orphan AR (no sale/dispatch loaded) falls back to null referenceNumber + createdAt as sourceDate", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([
        {
          id: "r3",
          description: "orphan",
          amount: new Prisma.Decimal(50),
          paid: new Prisma.Decimal(0),
          balance: new Prisma.Decimal(50),
          dueDate: new Date("2026-06-01"),
          sourceType: "sale",
          sourceId: "s-deleted",
          sourceTypeCode: null,
          createdAt: new Date("2026-05-10"),
          sale: null,
          dispatch: null,
        },
      ]);
      const repo = new PrismaReceivablesRepository(dbWith({ findMany }));

      const result = await repo.findPendingByContact("org-1", "c-1");

      expect(result[0]).toMatchObject({
        sourceTypeCode: null,
        referenceNumber: null,
        sourceDate: new Date("2026-05-10"),
      });
    });
  });

  describe("createTx", () => {
    it("creates inside the supplied tx with PENDING + paid=0 + balance=amount", async () => {
      const create = vi.fn().mockResolvedValueOnce({ id: "new-rec" });
      const tx = txWith({ create });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      const result = await repo.createTx(tx, {
        organizationId: "org-1",
        contactId: "c-1",
        description: "Sale",
        amount: 500,
        dueDate: new Date("2026-05-15"),
        sourceType: "sale",
        sourceId: "s-1",
        journalEntryId: "je-1",
      });

      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.amount.toString()).toBe("500");
      expect(callArg.data.paid.toString()).toBe("0");
      expect(callArg.data.balance.toString()).toBe("500");
      expect(callArg.data.status).toBe("PENDING");
      expect(callArg.data.sourceType).toBe("sale");
      expect(callArg.data.journalEntryId).toBe("je-1");
      expect(callArg.select).toEqual({ id: true });
      expect(result).toEqual({ id: "new-rec" });
    });

    it("omits optional fields when undefined", async () => {
      const create = vi.fn().mockResolvedValueOnce({ id: "new-rec" });
      const tx = txWith({ create });
      const repo = new PrismaReceivablesRepository(dbWith({}));

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
      const tx = txWith({ update });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await repo.voidTx(tx, "org-1", "rec-1");

      expect(update).toHaveBeenCalledWith({
        where: { id: "rec-1", organizationId: "org-1" },
        data: { status: "VOIDED", balance: expect.any(Prisma.Decimal) },
      });
      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.data.balance.toString()).toBe("0");
    });
  });

  describe("findByIdTx", () => {
    it("scopes by id+organizationId via the supplied tx and returns null when missing", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(null);
      const tx = txWith({ findFirst });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      const result = await repo.findByIdTx(tx, "org-1", "rec-missing");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "rec-missing", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    it("returns a Receivable when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const tx = txWith({ findFirst });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      const result = await repo.findByIdTx(tx, "org-1", "rec-1");

      expect(result?.id).toBe("rec-1");
    });
  });

  describe("applyAllocationTx", () => {
    it("updates inside tx with computed paid+balance+status (no business logic in adapter)", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await repo.applyAllocationTx(
        tx,
        "org-1",
        "rec-1",
        MonetaryAmount.of(700),
        MonetaryAmount.of(300),
        "PARTIAL",
      );

      expect(update).toHaveBeenCalledTimes(1);
      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: "rec-1", organizationId: "org-1" });
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
      const tx = txWith({ update });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await repo.revertAllocationTx(
        tx,
        "org-1",
        "rec-1",
        MonetaryAmount.zero(),
        MonetaryAmount.of(1000),
        "PENDING",
      );

      expect(update).toHaveBeenCalledTimes(1);
      const callArg = update.mock.calls[0]?.[0];
      expect(callArg.where).toEqual({ id: "rec-1", organizationId: "org-1" });
      expect(callArg.data.status).toBe("PENDING");
      expect(callArg.data.paid.toString()).toBe("0");
      expect(callArg.data.balance.toString()).toBe("1000");
    });
  });

  describe("withTransaction", () => {
    it("returns a new repo bound to the tx client", async () => {
      const txCreate = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ create: txCreate }) as unknown as Prisma.TransactionClient;
      const baseDb = dbWith({ create: vi.fn() });
      const repo = new PrismaReceivablesRepository(baseDb);

      await repo.withTransaction(tx).save(buildEntity());

      expect(txCreate).toHaveBeenCalled();
    });
  });

  // ── findAllocationsForReceivable ────────────────────────────────────────────

  describe("findAllocationsForReceivable", () => {
    it("includes only POSTED/LOCKED payment allocations for the LIFO trim plan (excludes DRAFT and VOIDED)", async () => {
      // The trim plan reduces allocations to cover `excess = paid - newTotal`,
      // and `paid` reflects ONLY posted allocations. A DRAFT allocation never
      // touched `paid`, so it must not enter the trim list (else a draft row is
      // trimmed for an excess it never caused). draft-credit-leak sibling.
      const findMany = vi.fn().mockResolvedValueOnce([]);
      const db = { paymentAllocation: { findMany } } as unknown as PrismaClient;
      const repo = new PrismaReceivablesRepository(db);

      await repo.findAllocationsForReceivable("org-1", "ar-1");

      const where = findMany.mock.calls[0]?.[0]?.where;
      expect(where.payment).toEqual({ status: { in: ["POSTED", "LOCKED"] } });
      expect(where.receivableId).toBe("ar-1");
    });
  });

  // ── settlement sync (D1/D2 — unified-comprobante-source-of-truth) ──────────
  // Every status write-site must propagate the mapped SettlementStatus to the
  // linked JE via reverse relation, in the SAME client/tx. STATUS ONLY in this
  // phase: `data` is pinned with toEqual semantics so dueDate propagation
  // (Phase 5) must consciously break these shapes.

  describe("settlement sync — update (D1)", () => {
    it("propagates the mapped settlement status to the linked JE via reverse relation in the same client", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const db = {
        accountsReceivable: { update },
        journalEntry: { updateMany },
      } as unknown as PrismaClient;
      const repo = new PrismaReceivablesRepository(db);

      await repo.update(rehydrate("PARTIAL"));

      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
    });

    it("maps CANCELLED to VOIDED on the JE (shared toSettlementStatus mapper)", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const db = {
        accountsReceivable: { update },
        journalEntry: { updateMany },
      } as unknown as PrismaClient;
      const repo = new PrismaReceivablesRepository(db);

      await repo.update(rehydrate("CANCELLED"));

      expect(updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "VOIDED" },
      });
    });

    it("unlinked receivable: reverse-relation match is a 0-row no-op and the AR update still succeeds", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const updateMany = vi.fn().mockResolvedValue({ count: 0 });
      const db = {
        accountsReceivable: { update },
        journalEntry: { updateMany },
      } as unknown as PrismaClient;
      const repo = new PrismaReceivablesRepository(db);

      await expect(
        repo.update(rehydrate("PENDING", null)),
      ).resolves.toBeUndefined();

      // Uniform issue per D1 (no read-before-write): the updateMany IS sent,
      // the DB simply matches 0 rows for an unlinked receivable.
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
    });
  });

  describe("settlement sync — voidTx (D1)", () => {
    it("stamps the linked JE VOIDED inside the same tx", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await repo.voidTx(tx, "org-1", "rec-1");

      expect(tx.journalEntry.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "VOIDED" },
      });
    });

    it("unlinked receivable: 0-row no-op and the void still succeeds", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
      tx.journalEntry.updateMany.mockResolvedValue({ count: 0 });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await expect(repo.voidTx(tx, "org-1", "rec-1")).resolves.toBeUndefined();

      expect(tx.journalEntry.updateMany).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
    });
  });

  describe("settlement sync — applyAllocationTx (D1, allocation end-state)", () => {
    // The domain computes the resulting ReceivableStatus; the repo must
    // persist THAT status on the AR row and stamp the SAME (mapped) value on
    // the JE. Both sides asserted — end-state is never hand-waved.
    it("partial allocation: AR row gets PARTIAL and JE gets PARTIAL in the same tx", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await repo.applyAllocationTx(
        tx,
        "org-1",
        "rec-1",
        MonetaryAmount.of(700),
        MonetaryAmount.of(300),
        "PARTIAL",
      );

      expect(update.mock.calls[0]?.[0]?.data.status).toBe("PARTIAL");
      expect(tx.journalEntry.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
    });

    it("full allocation: AR row gets PAID and JE gets PAID in the same tx", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await repo.applyAllocationTx(
        tx,
        "org-1",
        "rec-1",
        MonetaryAmount.of(1000),
        MonetaryAmount.zero(),
        "PAID",
      );

      expect(update.mock.calls[0]?.[0]?.data.status).toBe("PAID");
      expect(update.mock.calls[0]?.[0]?.data.balance.toString()).toBe("0");
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PAID" },
      });
    });
  });

  describe("settlement sync — revertAllocationTx (D1, allocation end-state)", () => {
    it("revert with remaining allocations: AR row gets PARTIAL and JE gets PARTIAL in the same tx", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await repo.revertAllocationTx(
        tx,
        "org-1",
        "rec-1",
        MonetaryAmount.of(400),
        MonetaryAmount.of(600),
        "PARTIAL",
      );

      expect(update.mock.calls[0]?.[0]?.data.status).toBe("PARTIAL");
      expect(update.mock.calls[0]?.[0]?.data.paid.toString()).toBe("400");
      expect(tx.journalEntry.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
    });

    it("full revert: AR row returns to PENDING and JE gets PENDING in the same tx", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await repo.revertAllocationTx(
        tx,
        "org-1",
        "rec-1",
        MonetaryAmount.zero(),
        MonetaryAmount.of(1000),
        "PENDING",
      );

      expect(update.mock.calls[0]?.[0]?.data.status).toBe("PENDING");
      expect(update.mock.calls[0]?.[0]?.data.paid.toString()).toBe("0");
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PENDING" },
      });
    });
  });

  // ── H2 atomicity — update/save dual write must be transactional ────────────
  // update()/save() are the NON-tx entry points (canonical status route via
  // makeReceivablesService → root client). Their dual write (AR row + JE
  // settlement stamp) must run inside ONE $transaction: a crash between the
  // two autocommit writes would persist the AR status while JE.paymentStatus
  // stays stale = silent settlement drift (adversarial-verify defect H2).
  // The base (autocommit) client and the tx client carry SEPARATE spies, so
  // any write leaking outside the transaction is observable.

  describe("H2 atomicity — update/save dual write in a single $transaction", () => {
    /** Root-client mock: $transaction hands its callback a tx client with its
     *  OWN delegates. Writes on `base*` delegates = autocommit leaks. */
    const atomicDb = () => {
      const tx = {
        accountsReceivable: {
          update: vi.fn().mockResolvedValue(undefined),
          create: vi.fn().mockResolvedValue(undefined),
        },
        journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      const baseAr = {
        update: vi.fn().mockResolvedValue(undefined),
        create: vi.fn().mockResolvedValue(undefined),
      };
      const baseJe = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
      const $transaction = vi
        .fn()
        .mockImplementation(async (fn: (c: unknown) => Promise<unknown>) =>
          fn(tx),
        );
      const db = {
        accountsReceivable: baseAr,
        journalEntry: baseJe,
        $transaction,
      } as unknown as PrismaClient;
      return { db, tx, baseAr, baseJe, $transaction };
    };

    it("update: both writes execute on the SAME tx client from ONE $transaction — never on the autocommit client", async () => {
      const { db, tx, baseAr, baseJe, $transaction } = atomicDb();
      const repo = new PrismaReceivablesRepository(db);

      await repo.update(rehydrate("PARTIAL"));

      expect($transaction).toHaveBeenCalledTimes(1);
      expect(tx.accountsReceivable.update).toHaveBeenCalledTimes(1);
      expect(tx.accountsReceivable.update.mock.calls[0]?.[0]?.where).toEqual({
        id: "rec-1",
        organizationId: "org-1",
      });
      // Mapped status logic unchanged — only atomicity moved.
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
      expect(baseAr.update).not.toHaveBeenCalled();
      expect(baseJe.updateMany).not.toHaveBeenCalled();
    });

    it("update: when the JE settlement write fails, the AR write must NOT have hit the autocommit client (no partial commit)", async () => {
      const { db, tx, baseAr, baseJe } = atomicDb();
      const boom = new Error("je-write-failed");
      tx.journalEntry.updateMany.mockRejectedValue(boom);
      baseJe.updateMany.mockRejectedValue(boom); // current (non-atomic) path fails here too

      const repo = new PrismaReceivablesRepository(db);

      await expect(repo.update(rehydrate("PAID"))).rejects.toThrow(
        "je-write-failed",
      );

      // Inside $transaction the throw aborts the callback → rollback. A write
      // on the BASE client is autocommit — it survives the throw = H2 drift.
      expect(baseAr.update).not.toHaveBeenCalled();
      expect(tx.accountsReceivable.update).toHaveBeenCalledTimes(1);
    });

    it("save: both writes execute on the SAME tx client from ONE $transaction — never on the autocommit client", async () => {
      const { db, tx, baseAr, baseJe, $transaction } = atomicDb();
      const repo = new PrismaReceivablesRepository(db);

      await repo.save(rehydrate("PARTIAL"));

      expect($transaction).toHaveBeenCalledTimes(1);
      expect(tx.accountsReceivable.create).toHaveBeenCalledTimes(1);
      // D2 stamp still mapped from the entity status — not hardcoded.
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
      expect(baseAr.create).not.toHaveBeenCalled();
      expect(baseJe.updateMany).not.toHaveBeenCalled();
    });

    it("save: when the JE settlement write fails, the AR create must NOT have hit the autocommit client (no partial commit)", async () => {
      const { db, tx, baseAr, baseJe } = atomicDb();
      const boom = new Error("je-write-failed");
      tx.journalEntry.updateMany.mockRejectedValue(boom);
      baseJe.updateMany.mockRejectedValue(boom);

      const repo = new PrismaReceivablesRepository(db);

      await expect(repo.save(buildEntity())).rejects.toThrow("je-write-failed");

      expect(baseAr.create).not.toHaveBeenCalled();
      expect(tx.accountsReceivable.create).toHaveBeenCalledTimes(1);
    });

    // Guard branch (approval pins — PASS on pre-fix code too): a client
    // WITHOUT $transaction (withTransaction-bound repo whose caller already
    // owns the tx) runs both writes directly — already atomic under the
    // caller's tx; wrapping is not required. (Prisma 7 TransactionClient DOES
    // expose $transaction — nested tx = savepoint, also safe — but the guard
    // must not crash on clients that lack it.)
    it("update via withTransaction-bound repo: runs both writes directly on the caller's tx client", async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      const tx = txWith({ update });
      const repo = new PrismaReceivablesRepository(dbWith({})).withTransaction(
        tx as unknown as Prisma.TransactionClient,
      );

      await repo.update(rehydrate("PARTIAL"));

      expect(update).toHaveBeenCalledTimes(1);
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
    });

    it("save via withTransaction-bound repo: runs both writes directly on the caller's tx client", async () => {
      const create = vi.fn().mockResolvedValue(undefined);
      const tx = txWith({ create });
      const repo = new PrismaReceivablesRepository(dbWith({})).withTransaction(
        tx as unknown as Prisma.TransactionClient,
      );

      await repo.save(rehydrate("PAID"));

      expect(create).toHaveBeenCalledTimes(1);
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PAID" },
      });
    });
  });

  describe("settlement sync — creation stamp (D2)", () => {
    it("createTx stamps the linked JE with the mapped created status using the RETURNED row id", async () => {
      const create = vi.fn().mockResolvedValueOnce({ id: "new-rec" });
      const tx = txWith({ create });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      await repo.createTx(tx, {
        organizationId: "org-1",
        contactId: "c-1",
        description: "Sale",
        amount: 500,
        dueDate: new Date("2026-05-15"),
        journalEntryId: "je-1",
      });

      expect(tx.journalEntry.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "new-rec" } } },
        data: { paymentStatus: "PENDING" },
      });
    });

    it("createTx without journalEntryId: uniform sync is a 0-row no-op and the create still succeeds", async () => {
      const create = vi.fn().mockResolvedValueOnce({ id: "new-rec" });
      const tx = txWith({ create });
      tx.journalEntry.updateMany.mockResolvedValue({ count: 0 });
      const repo = new PrismaReceivablesRepository(dbWith({}));

      const result = await repo.createTx(tx, {
        organizationId: "org-1",
        contactId: "c-1",
        description: "x",
        amount: 100,
        dueDate: new Date("2026-05-15"),
      });

      expect(result).toEqual({ id: "new-rec" });
      expect(tx.journalEntry.updateMany).toHaveBeenCalledTimes(1);
    });

    it("save stamps the linked JE from the entity status (mapped, not hardcoded PENDING)", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const db = {
        accountsReceivable: { create },
        journalEntry: { updateMany },
      } as unknown as PrismaClient;
      const repo = new PrismaReceivablesRepository(db);

      // Rehydrated PARTIAL entity: forces toSettlementStatus(entity.status)
      // instead of a hardcoded PENDING stamp.
      await repo.save(rehydrate("PARTIAL"));

      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", receivables: { some: { id: "rec-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
    });

    it("save of a new entity stamps PENDING", async () => {
      const create = vi.fn().mockResolvedValueOnce(undefined);
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const db = {
        accountsReceivable: { create },
        journalEntry: { updateMany },
      } as unknown as PrismaClient;
      const repo = new PrismaReceivablesRepository(db);

      const entity = buildEntity();
      await repo.save(entity);

      expect(updateMany).toHaveBeenCalledWith({
        where: {
          organizationId: "org-1",
          receivables: { some: { id: entity.id } },
        },
        data: { paymentStatus: "PENDING" },
      });
    });
  });
});
