import { describe, it, expect, vi } from "vitest";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { PrismaPayablesRepository } from "../prisma-payables.repository";
import { Payable } from "../../domain/payable.entity";
import type { PayableStatus } from "../../domain/value-objects/payable-status";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

const dbWith = (overrides: Record<string, unknown>): PrismaClient =>
  ({
    accountsPayable: overrides,
    journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  }) as unknown as PrismaClient;

/** Tx mock with the journalEntry delegate the settlement sync (D1) targets. */
const txWith = (overrides: Record<string, unknown>) => ({
  accountsPayable: overrides,
  journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
});

/** Rehydrated entity in an arbitrary status for settlement-sync cases. */
const rehydrate = (
  status: PayableStatus,
  journalEntryId: string | null = "je-1",
) =>
  Payable.fromPersistence({
    id: "pay-1",
    organizationId: "org-1",
    contactId: "contact-1",
    description: "Factura proveedor",
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
    it("returns plain-number snapshots ordered by createdAt asc, includes sourceTypeCode + purchase meta (referenceNumber, sourceDate)", async () => {
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
          sourceTypeCode: "CG",
          createdAt: new Date("2026-04-01"),
          purchase: { referenceNumber: 1023, date: new Date("2026-03-20") },
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
          sourceTypeCode: true,
          createdAt: true,
          purchase: { select: { referenceNumber: true, date: true } },
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
          sourceTypeCode: "CG",
          createdAt: new Date("2026-04-01"),
          referenceNumber: 1023,
          sourceDate: new Date("2026-03-20"),
        },
      ]);
    });

    it("orphan AP (no purchase loaded) falls back to null referenceNumber + createdAt as sourceDate", async () => {
      const findMany = vi.fn().mockResolvedValueOnce([
        {
          id: "p2",
          description: "orphan",
          amount: new Prisma.Decimal(50),
          paid: new Prisma.Decimal(0),
          balance: new Prisma.Decimal(50),
          dueDate: new Date("2026-06-01"),
          sourceType: "purchase",
          sourceId: "p-deleted",
          sourceTypeCode: null,
          createdAt: new Date("2026-05-10"),
          purchase: null,
        },
      ]);
      const repo = new PrismaPayablesRepository(dbWith({ findMany }));

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
      const create = vi.fn().mockResolvedValueOnce({ id: "new-pay" });
      const tx = txWith({ create });
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
      const tx = txWith({ create });
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

    it("persists sourceTypeCode when provided (D4 — mirror receivables:193)", async () => {
      const create = vi.fn().mockResolvedValueOnce({ id: "new-pay" });
      const tx = txWith({ create });
      const repo = new PrismaPayablesRepository(dbWith({}));

      await repo.createTx(tx, {
        organizationId: "org-1",
        contactId: "c-1",
        description: "Purchase",
        amount: 500,
        dueDate: new Date("2026-05-15"),
        sourceTypeCode: "CG",
      });

      const callArg = create.mock.calls[0]?.[0];
      expect(callArg.data.sourceTypeCode).toBe("CG");
    });

    it("omits sourceTypeCode key entirely when undefined (NULL by DB default)", async () => {
      const create = vi.fn().mockResolvedValueOnce({ id: "new-pay" });
      const tx = txWith({ create });
      const repo = new PrismaPayablesRepository(dbWith({}));

      await repo.createTx(tx, {
        organizationId: "org-1",
        contactId: "c-1",
        description: "x",
        amount: 100,
        dueDate: new Date("2026-05-15"),
      });

      const callArg = create.mock.calls[0]?.[0];
      expect("sourceTypeCode" in callArg.data).toBe(false);
    });
  });

  describe("voidTx", () => {
    it("updates inside tx with status=VOIDED and balance=0", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
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
      const tx = txWith({ findFirst });
      const repo = new PrismaPayablesRepository(dbWith({}));

      const result = await repo.findByIdTx(tx, "org-1", "pay-missing");

      expect(findFirst).toHaveBeenCalledWith({
        where: { id: "pay-missing", organizationId: "org-1" },
      });
      expect(result).toBeNull();
    });

    it("returns a Payable when found", async () => {
      const findFirst = vi.fn().mockResolvedValueOnce(buildRow());
      const tx = txWith({ findFirst });
      const repo = new PrismaPayablesRepository(dbWith({}));

      const result = await repo.findByIdTx(tx, "org-1", "pay-1");

      expect(result?.id).toBe("pay-1");
    });
  });

  describe("applyAllocationTx", () => {
    it("updates inside tx with computed paid+balance+status (no business logic in adapter)", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
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
      const tx = txWith({ update });
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
      const tx = txWith({ create: txCreate }) as unknown as Prisma.TransactionClient;
      const baseDb = dbWith({ create: vi.fn() });
      const repo = new PrismaPayablesRepository(baseDb);

      await repo.withTransaction(tx).save(buildEntity());

      expect(txCreate).toHaveBeenCalled();
    });
  });

  // ── findAllocationsForPayable ───────────────────────────────────────────────

  describe("findAllocationsForPayable", () => {
    it("includes only POSTED/LOCKED payment allocations for the LIFO trim plan (excludes DRAFT and VOIDED)", async () => {
      // The trim plan reduces allocations to cover `excess = paid - newTotal`,
      // and `paid` reflects ONLY posted allocations. A DRAFT allocation never
      // touched `paid`, so it must not enter the trim list (else a draft row is
      // trimmed for an excess it never caused). draft-credit-leak sibling.
      const findMany = vi.fn().mockResolvedValueOnce([]);
      const db = { paymentAllocation: { findMany } } as unknown as PrismaClient;
      const repo = new PrismaPayablesRepository(db);

      await repo.findAllocationsForPayable("org-1", "ap-1");

      const where = findMany.mock.calls[0]?.[0]?.where;
      expect(where.payment).toEqual({ status: { in: ["POSTED", "LOCKED"] } });
      expect(where.payableId).toBe("ap-1");
    });
  });

  // ── settlement sync (D1/D2 — unified-comprobante-source-of-truth) ──────────
  // Sister mirror of receivables: every status write-site must propagate the
  // mapped SettlementStatus to the linked JE via reverse relation
  // (payables: { some: { id } }), in the SAME client/tx. STATUS ONLY in this
  // phase: `data` is pinned with toEqual semantics so dueDate propagation
  // (Phase 5) must consciously break these shapes.

  describe("settlement sync — update (D1)", () => {
    it("propagates the mapped settlement status to the linked JE via reverse relation in the same client", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const db = {
        accountsPayable: { update },
        journalEntry: { updateMany },
      } as unknown as PrismaClient;
      const repo = new PrismaPayablesRepository(db);

      await repo.update(rehydrate("PARTIAL"));

      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", payables: { some: { id: "pay-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
    });

    it("maps CANCELLED to VOIDED on the JE (shared toSettlementStatus mapper)", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const updateMany = vi.fn().mockResolvedValue({ count: 1 });
      const db = {
        accountsPayable: { update },
        journalEntry: { updateMany },
      } as unknown as PrismaClient;
      const repo = new PrismaPayablesRepository(db);

      await repo.update(rehydrate("CANCELLED"));

      expect(updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", payables: { some: { id: "pay-1" } } },
        data: { paymentStatus: "VOIDED" },
      });
    });

    it("unlinked payable: reverse-relation match is a 0-row no-op and the AP update still succeeds", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const updateMany = vi.fn().mockResolvedValue({ count: 0 });
      const db = {
        accountsPayable: { update },
        journalEntry: { updateMany },
      } as unknown as PrismaClient;
      const repo = new PrismaPayablesRepository(db);

      await expect(
        repo.update(rehydrate("PENDING", null)),
      ).resolves.toBeUndefined();

      // Uniform issue per D1 (no read-before-write): the updateMany IS sent,
      // the DB simply matches 0 rows for an unlinked payable.
      expect(updateMany).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
    });
  });

  describe("settlement sync — voidTx (D1)", () => {
    it("stamps the linked JE VOIDED inside the same tx", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
      const repo = new PrismaPayablesRepository(dbWith({}));

      await repo.voidTx(tx, "org-1", "pay-1");

      expect(tx.journalEntry.updateMany).toHaveBeenCalledTimes(1);
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", payables: { some: { id: "pay-1" } } },
        data: { paymentStatus: "VOIDED" },
      });
    });

    it("unlinked payable: 0-row no-op and the void still succeeds", async () => {
      const update = vi.fn().mockResolvedValueOnce(undefined);
      const tx = txWith({ update });
      tx.journalEntry.updateMany.mockResolvedValue({ count: 0 });
      const repo = new PrismaPayablesRepository(dbWith({}));

      await expect(repo.voidTx(tx, "org-1", "pay-1")).resolves.toBeUndefined();

      expect(tx.journalEntry.updateMany).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(1);
    });
  });

  // ── atomicity (H2 mirror) — update dual write must be transactional ────────
  // update() is a NON-tx entry point (root client): its dual write (AP row +
  // JE settlement stamp) must run inside ONE $transaction — a crash between
  // two autocommit writes would persist the AP status while JE.paymentStatus
  // stays stale = silent settlement drift (receivables defect H2; payables
  // must NOT inherit it). Base (autocommit) client and tx client carry
  // SEPARATE spies, so any write leaking outside the transaction is
  // observable.

  describe("H2-mirror atomicity — update dual write in a single $transaction", () => {
    /** Root-client mock: $transaction hands its callback a tx client with its
     *  OWN delegates. Writes on `base*` delegates = autocommit leaks. */
    const atomicDb = () => {
      const tx = {
        accountsPayable: {
          update: vi.fn().mockResolvedValue(undefined),
          create: vi.fn().mockResolvedValue(undefined),
        },
        journalEntry: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      };
      const baseAp = {
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
        accountsPayable: baseAp,
        journalEntry: baseJe,
        $transaction,
      } as unknown as PrismaClient;
      return { db, tx, baseAp, baseJe, $transaction };
    };

    it("update: both writes execute on the SAME tx client from ONE $transaction — never on the autocommit client", async () => {
      const { db, tx, baseAp, baseJe, $transaction } = atomicDb();
      const repo = new PrismaPayablesRepository(db);

      await repo.update(rehydrate("PARTIAL"));

      expect($transaction).toHaveBeenCalledTimes(1);
      expect(tx.accountsPayable.update).toHaveBeenCalledTimes(1);
      expect(tx.accountsPayable.update.mock.calls[0]?.[0]?.where).toEqual({
        id: "pay-1",
        organizationId: "org-1",
      });
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", payables: { some: { id: "pay-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
      expect(baseAp.update).not.toHaveBeenCalled();
      expect(baseJe.updateMany).not.toHaveBeenCalled();
    });

    it("update: when the JE settlement write fails, the AP write must NOT have hit the autocommit client (no partial commit)", async () => {
      const { db, tx, baseAp, baseJe } = atomicDb();
      const boom = new Error("je-write-failed");
      tx.journalEntry.updateMany.mockRejectedValue(boom);
      baseJe.updateMany.mockRejectedValue(boom); // a non-atomic path must fail here too

      const repo = new PrismaPayablesRepository(db);

      await expect(repo.update(rehydrate("PAID"))).rejects.toThrow(
        "je-write-failed",
      );

      // Inside $transaction the throw aborts the callback → rollback. A write
      // on the BASE client is autocommit — it survives the throw = H2 drift.
      expect(baseAp.update).not.toHaveBeenCalled();
      expect(tx.accountsPayable.update).toHaveBeenCalledTimes(1);
    });

    // Guard branch: a client WITHOUT $transaction (withTransaction-bound repo
    // whose caller already owns the tx) runs both writes directly — already
    // atomic under the caller's tx; wrapping is not required.
    it("update via withTransaction-bound repo: runs both writes directly on the caller's tx client", async () => {
      const update = vi.fn().mockResolvedValue(undefined);
      const tx = txWith({ update });
      const repo = new PrismaPayablesRepository(dbWith({})).withTransaction(
        tx as unknown as Prisma.TransactionClient,
      );

      await repo.update(rehydrate("PARTIAL"));

      expect(update).toHaveBeenCalledTimes(1);
      expect(tx.journalEntry.updateMany).toHaveBeenCalledWith({
        where: { organizationId: "org-1", payables: { some: { id: "pay-1" } } },
        data: { paymentStatus: "PARTIAL" },
      });
    });
  });
});
