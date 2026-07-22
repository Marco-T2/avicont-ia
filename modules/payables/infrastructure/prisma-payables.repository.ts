import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type {
  PayableRepository,
  PayableFilters,
  OpenAggregate,
  PendingDocumentSnapshot,
  CreatePayableTxData,
  AllocationLifoSnapshot,
  PayableTrimItem,
} from "../domain/payable.repository";
import { Payable } from "../domain/payable.entity";
import type { PayableStatus } from "../domain/value-objects/payable-status";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { toSettlementStatus } from "@/modules/shared/domain/value-objects/settlement-status";
import { toDomain, toPersistence } from "./payables.mapper";

type DbClient = Pick<
  PrismaClient,
  "accountsPayable" | "paymentAllocation" | "journalEntry"
> & {
  /** Present on the root client; used by `atomically` to open a repo-local
   *  tx for the non-tx entry points (H2 mirror). Optional so clients without
   *  it (narrow tx tokens) still fit — they run writes directly. */
  $transaction?: PrismaClient["$transaction"];
};

export class PrismaPayablesRepository implements PayableRepository {
  constructor(private readonly db: DbClient = prisma) {}

  withTransaction(tx: Prisma.TransactionClient): PrismaPayablesRepository {
    return new PrismaPayablesRepository(tx as unknown as DbClient);
  }

  /**
   * Propagates a payable's status onto its linked JournalEntry
   * (unified-comprobante-source-of-truth, D1) within the SAME client/tx.
   * Sister mirror of PrismaReceivablesRepository.
   *
   * Locates the JE via reverse relation because the *Tx write-sites receive
   * only the payable id, not journalEntryId. Unlinked payables are a
   * 0-row no-op — no read-before-write. STATUS ONLY: dueDate propagation is
   * Phase 5.
   */
  private async syncJournalEntrySettlement(
    client: Pick<DbClient, "journalEntry">,
    organizationId: string,
    id: string,
    status: PayableStatus,
  ): Promise<void> {
    await client.journalEntry.updateMany({
      where: { organizationId, payables: { some: { id } } },
      data: { paymentStatus: toSettlementStatus(status) },
    });
  }

  /**
   * Runs `fn` atomically. `save`/`update` are the NON-tx entry points (root
   * client): their dual write (AP row + JE settlement stamp, D1/D2) must not
   * straddle two autocommits — a crash between them persists the AP status
   * while JE.paymentStatus stays stale (silent settlement drift, receivables
   * defect H2; payables mirrors the fix from the start).
   *
   * Guard: a client without `$transaction` (a bare tx token) is already
   * inside the caller's transaction — run directly. On Prisma 7 the real
   * `TransactionClient` DOES expose `$transaction` (nested tx = savepoint on
   * postgres), so a withTransaction-bound repo wrapping again stays atomic.
   */
  private async atomically(fn: (client: DbClient) => Promise<void>): Promise<void> {
    if (typeof this.db.$transaction === "function") {
      await this.db.$transaction(async (tx) => fn(tx as unknown as DbClient));
      return;
    }
    await fn(this.db);
  }

  async findAll(
    organizationId: string,
    filters?: PayableFilters,
  ): Promise<Payable[]> {
    const rows = await this.db.accountsPayable.findMany({
      where: {
        organizationId,
        ...(filters?.contactId ? { contactId: filters.contactId } : {}),
        ...(filters?.status ? { status: filters.status } : {}),
        ...(filters?.dueDateFrom || filters?.dueDateTo
          ? {
              dueDate: {
                ...(filters.dueDateFrom ? { gte: filters.dueDateFrom } : {}),
                ...(filters.dueDateTo ? { lte: filters.dueDateTo } : {}),
              },
            }
          : {}),
      },
      orderBy: { dueDate: "asc" },
    });
    return rows.map(toDomain);
  }

  async findById(organizationId: string, id: string): Promise<Payable | null> {
    const row = await this.db.accountsPayable.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async save(entity: Payable): Promise<void> {
    await this.db.accountsPayable.create({ data: toPersistence(entity) });
  }

  async update(entity: Payable): Promise<void> {
    await this.atomically(async (client) => {
      await client.accountsPayable.update({
        where: { id: entity.id, organizationId: entity.organizationId },
        data: {
          description: entity.description,
          dueDate: entity.dueDate,
          status: entity.status,
          amount: new Prisma.Decimal(entity.amount.value),
          paid: new Prisma.Decimal(entity.paid.value),
          balance: new Prisma.Decimal(entity.balance.value),
          sourceType: entity.sourceType,
          sourceId: entity.sourceId,
          journalEntryId: entity.journalEntryId,
          notes: entity.notes,
        },
      });
      await this.syncJournalEntrySettlement(
        client,
        entity.organizationId,
        entity.id,
        entity.status,
      );
    });
  }

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    const result = await this.db.accountsPayable.aggregate({
      where: {
        organizationId,
        ...(contactId ? { contactId } : {}),
        status: { in: ["PENDING", "PARTIAL"] },
      },
      _sum: { balance: true },
      _count: { id: true },
    });
    return {
      totalBalance: result._sum.balance ? Number(result._sum.balance) : 0,
      count: result._count.id,
    };
  }

  async findPendingByContact(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]> {
    const rows = await this.db.accountsPayable.findMany({
      where: { organizationId, contactId, status: { in: ["PENDING", "PARTIAL"] } },
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
    return rows.map((r) => ({
      id: r.id,
      description: r.description,
      amount: Number(r.amount),
      paid: Number(r.paid),
      balance: Number(r.balance),
      dueDate: r.dueDate,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      sourceTypeCode: r.sourceTypeCode,
      createdAt: r.createdAt,
      referenceNumber: r.purchase?.referenceNumber ?? null,
      sourceDate: r.purchase?.date ?? r.createdAt,
    }));
  }

  async applyTrimPlanTx(
    tx: unknown,
    _organizationId: string,
    _payableId: string,
    items: PayableTrimItem[],
  ): Promise<void> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    for (const item of items) {
      if (item.newAmount <= 0) {
        await txClient.paymentAllocation.delete({
          where: { id: item.allocationId },
        });
      } else {
        await txClient.paymentAllocation.update({
          where: { id: item.allocationId },
          data: { amount: new Prisma.Decimal(item.newAmount) },
        });
      }
    }
  }

  async findAllocationsForPayable(
    _organizationId: string,
    payableId: string,
  ): Promise<AllocationLifoSnapshot[]> {
    const rows = await this.db.paymentAllocation.findMany({
      where: {
        payableId,
        // Only POSTED/LOCKED allocations contributed to the payable's `paid`,
        // so only they are eligible for the LIFO trim. A DRAFT allocation never
        // touched `paid` and must not be trimmed (draft-credit-leak sibling).
        payment: { status: { in: ["POSTED", "LOCKED"] } },
      },
      orderBy: { id: "desc" },
      include: { payment: { select: { date: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      amount: Number(r.amount),
      payment: { date: r.payment.date },
    }));
  }

  async createTx(
    tx: unknown,
    data: CreatePayableTxData,
  ): Promise<{ id: string }> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    return txClient.accountsPayable.create({
      data: {
        organizationId: data.organizationId,
        contactId: data.contactId,
        description: data.description,
        amount: new Prisma.Decimal(data.amount),
        paid: new Prisma.Decimal(0),
        balance: new Prisma.Decimal(data.amount),
        dueDate: data.dueDate,
        status: "PENDING",
        ...(data.sourceType ? { sourceType: data.sourceType } : {}),
        ...(data.sourceId ? { sourceId: data.sourceId } : {}),
        ...(data.sourceTypeCode !== undefined
          ? { sourceTypeCode: data.sourceTypeCode }
          : {}),
        ...(data.journalEntryId ? { journalEntryId: data.journalEntryId } : {}),
      },
      select: { id: true },
    });
  }

  async voidTx(tx: unknown, organizationId: string, id: string): Promise<void> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    await txClient.accountsPayable.update({
      where: { id, organizationId },
      data: { status: "VOIDED", balance: new Prisma.Decimal(0) },
    });
  }

  async findByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<Payable | null> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    const row = await txClient.accountsPayable.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async applyAllocationTx(
    tx: unknown,
    organizationId: string,
    id: string,
    paid: MonetaryAmount,
    balance: MonetaryAmount,
    status: PayableStatus,
  ): Promise<void> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    await txClient.accountsPayable.update({
      where: { id, organizationId },
      data: {
        paid: new Prisma.Decimal(paid.value),
        balance: new Prisma.Decimal(balance.value),
        status,
      },
    });
  }

  async revertAllocationTx(
    tx: unknown,
    organizationId: string,
    id: string,
    paid: MonetaryAmount,
    balance: MonetaryAmount,
    status: PayableStatus,
  ): Promise<void> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    await txClient.accountsPayable.update({
      where: { id, organizationId },
      data: {
        paid: new Prisma.Decimal(paid.value),
        balance: new Prisma.Decimal(balance.value),
        status,
      },
    });
  }
}
