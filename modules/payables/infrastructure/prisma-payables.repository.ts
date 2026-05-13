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
import { toDomain, toPersistence } from "./payables.mapper";

type DbClient = Pick<PrismaClient, "accountsPayable" | "paymentAllocation">;

export class PrismaPayablesRepository implements PayableRepository {
  constructor(private readonly db: DbClient = prisma) {}

  withTransaction(tx: Prisma.TransactionClient): PrismaPayablesRepository {
    return new PrismaPayablesRepository(tx as unknown as DbClient);
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
    await this.db.accountsPayable.update({
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
