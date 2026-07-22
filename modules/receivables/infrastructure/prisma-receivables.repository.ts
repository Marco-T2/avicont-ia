import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type {
  AllocationLifoSnapshot,
  ReceivableRepository,
  ReceivableFilters,
  ReceivableTrimItem,
  OpenAggregate,
  PendingDocumentSnapshot,
  CreateReceivableTxData,
} from "../domain/receivable.repository";
import { Receivable } from "../domain/receivable.entity";
import type { ReceivableStatus } from "../domain/value-objects/receivable-status";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { toSettlementStatus } from "@/modules/shared/domain/value-objects/settlement-status";
import { toDomain, toPersistence } from "./receivables.mapper";

type DbClient = Pick<
  PrismaClient,
  "accountsReceivable" | "paymentAllocation" | "journalEntry"
>;

export class PrismaReceivablesRepository implements ReceivableRepository {
  constructor(private readonly db: DbClient = prisma) {}

  withTransaction(tx: Prisma.TransactionClient): PrismaReceivablesRepository {
    return new PrismaReceivablesRepository(tx as unknown as DbClient);
  }

  /**
   * Propagates a receivable's status onto its linked JournalEntry
   * (unified-comprobante-source-of-truth, D1) within the SAME client/tx.
   *
   * Locates the JE via reverse relation because the *Tx write-sites receive
   * only the receivable id, not journalEntryId. Unlinked receivables are a
   * 0-row no-op — no read-before-write. STATUS ONLY: dueDate propagation is
   * Phase 5.
   */
  private async syncJournalEntrySettlement(
    client: Pick<DbClient, "journalEntry">,
    organizationId: string,
    id: string,
    status: ReceivableStatus,
  ): Promise<void> {
    await client.journalEntry.updateMany({
      where: { organizationId, receivables: { some: { id } } },
      data: { paymentStatus: toSettlementStatus(status) },
    });
  }

  async findAll(
    organizationId: string,
    filters?: ReceivableFilters,
  ): Promise<Receivable[]> {
    const rows = await this.db.accountsReceivable.findMany({
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

  async findById(organizationId: string, id: string): Promise<Receivable | null> {
    const row = await this.db.accountsReceivable.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async save(entity: Receivable): Promise<void> {
    await this.db.accountsReceivable.create({ data: toPersistence(entity) });
    // D2 creation stamp: mapped from the entity's status — not hardcoded.
    await this.syncJournalEntrySettlement(
      this.db,
      entity.organizationId,
      entity.id,
      entity.status,
    );
  }

  async update(entity: Receivable): Promise<void> {
    await this.db.accountsReceivable.update({
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
      this.db,
      entity.organizationId,
      entity.id,
      entity.status,
    );
  }

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    const result = await this.db.accountsReceivable.aggregate({
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

  async findAllocationsForReceivable(
    _organizationId: string,
    receivableId: string,
  ): Promise<AllocationLifoSnapshot[]> {
    const rows = await this.db.paymentAllocation.findMany({
      where: {
        receivableId,
        // Only POSTED/LOCKED allocations contributed to the receivable's `paid`,
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

  async applyTrimPlanTx(
    tx: unknown,
    _organizationId: string,
    _receivableId: string,
    items: ReceivableTrimItem[],
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

  async findPendingByContact(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]> {
    const rows = await this.db.accountsReceivable.findMany({
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
        sale: { select: { referenceNumber: true, date: true } },
        dispatch: { select: { referenceNumber: true, date: true } },
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
      referenceNumber: r.sale?.referenceNumber ?? r.dispatch?.referenceNumber ?? null,
      sourceDate: r.sale?.date ?? r.dispatch?.date ?? r.createdAt,
    }));
  }

  async createTx(
    tx: unknown,
    data: CreateReceivableTxData,
  ): Promise<{ id: string }> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    // Single source for the created row's status AND the D2 creation stamp.
    const status: ReceivableStatus = "PENDING";
    const created = await txClient.accountsReceivable.create({
      data: {
        organizationId: data.organizationId,
        contactId: data.contactId,
        description: data.description,
        amount: new Prisma.Decimal(data.amount),
        paid: new Prisma.Decimal(0),
        balance: new Prisma.Decimal(data.amount),
        dueDate: data.dueDate,
        status,
        ...(data.sourceType ? { sourceType: data.sourceType } : {}),
        ...(data.sourceId ? { sourceId: data.sourceId } : {}),
        ...(data.sourceTypeCode !== undefined
          ? { sourceTypeCode: data.sourceTypeCode }
          : {}),
        ...(data.journalEntryId ? { journalEntryId: data.journalEntryId } : {}),
      },
      select: { id: true },
    });
    await this.syncJournalEntrySettlement(
      txClient,
      data.organizationId,
      created.id,
      status,
    );
    return created;
  }

  async voidTx(tx: unknown, organizationId: string, id: string): Promise<void> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    await txClient.accountsReceivable.update({
      where: { id, organizationId },
      data: { status: "VOIDED", balance: new Prisma.Decimal(0) },
    });
    await this.syncJournalEntrySettlement(txClient, organizationId, id, "VOIDED");
  }

  async findByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<Receivable | null> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    const row = await txClient.accountsReceivable.findFirst({
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
    status: ReceivableStatus,
  ): Promise<void> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    await txClient.accountsReceivable.update({
      where: { id, organizationId },
      data: {
        paid: new Prisma.Decimal(paid.value),
        balance: new Prisma.Decimal(balance.value),
        status,
      },
    });
    await this.syncJournalEntrySettlement(txClient, organizationId, id, status);
  }

  async revertAllocationTx(
    tx: unknown,
    organizationId: string,
    id: string,
    paid: MonetaryAmount,
    balance: MonetaryAmount,
    status: ReceivableStatus,
  ): Promise<void> {
    const txClient = (tx ?? this.db) as Prisma.TransactionClient;
    await txClient.accountsReceivable.update({
      where: { id, organizationId },
      data: {
        paid: new Prisma.Decimal(paid.value),
        balance: new Prisma.Decimal(balance.value),
        status,
      },
    });
    await this.syncJournalEntrySettlement(txClient, organizationId, id, status);
  }
}
