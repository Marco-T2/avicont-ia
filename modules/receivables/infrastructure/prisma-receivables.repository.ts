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
import { toDomain, toPersistence } from "./receivables.mapper";

type DbClient = Pick<PrismaClient, "accountsReceivable" | "paymentAllocation">;

export class PrismaReceivablesRepository implements ReceivableRepository {
  constructor(private readonly db: DbClient = prisma) {}

  withTransaction(tx: Prisma.TransactionClient): PrismaReceivablesRepository {
    return new PrismaReceivablesRepository(tx as unknown as DbClient);
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
        payment: { status: { not: "VOIDED" } },
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
    const txClient = tx as Prisma.TransactionClient;
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
        createdAt: true,
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
      createdAt: r.createdAt,
    }));
  }

  async createTx(
    tx: unknown,
    data: CreateReceivableTxData,
  ): Promise<{ id: string }> {
    const txClient = tx as Prisma.TransactionClient;
    return txClient.accountsReceivable.create({
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
        ...(data.journalEntryId ? { journalEntryId: data.journalEntryId } : {}),
      },
      select: { id: true },
    });
  }

  async voidTx(tx: unknown, organizationId: string, id: string): Promise<void> {
    const txClient = tx as Prisma.TransactionClient;
    await txClient.accountsReceivable.update({
      where: { id, organizationId },
      data: { status: "VOIDED", balance: new Prisma.Decimal(0) },
    });
  }

  async findByIdTx(
    tx: unknown,
    organizationId: string,
    id: string,
  ): Promise<Receivable | null> {
    const txClient = tx as Prisma.TransactionClient;
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
    const txClient = tx as Prisma.TransactionClient;
    await txClient.accountsReceivable.update({
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
    status: ReceivableStatus,
  ): Promise<void> {
    const txClient = tx as Prisma.TransactionClient;
    await txClient.accountsReceivable.update({
      where: { id, organizationId },
      data: {
        paid: new Prisma.Decimal(paid.value),
        balance: new Prisma.Decimal(balance.value),
        status,
      },
    });
  }
}
