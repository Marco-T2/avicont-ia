import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { PayableStatus } from "@/generated/prisma/client";
import type {
  PayableWithContact,
  CreatePayableInput,
  UpdatePayableInput,
  PayableFilters,
  OpenAggregate,
} from "./payables.types";

export class PayablesRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: PayableFilters,
  ): Promise<PayableWithContact[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.accountsPayable.findMany({
      where: {
        ...scope,
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
      include: { contact: true },
      orderBy: { dueDate: "asc" },
    });
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<PayableWithContact | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.accountsPayable.findFirst({
      where: { id, ...scope },
      include: { contact: true },
    });
  }

  async create(
    organizationId: string,
    data: CreatePayableInput,
  ): Promise<PayableWithContact> {
    const scope = this.requireOrg(organizationId);
    const amount = new Prisma.Decimal(data.amount.toString());

    return this.db.accountsPayable.create({
      data: {
        organizationId: scope.organizationId,
        contactId: data.contactId,
        description: data.description,
        amount,
        paid: new Prisma.Decimal(0),
        balance: amount,
        dueDate: data.dueDate,
        status: "PENDING",
        ...(data.sourceType ? { sourceType: data.sourceType } : {}),
        ...(data.sourceId ? { sourceId: data.sourceId } : {}),
        ...(data.journalEntryId ? { journalEntryId: data.journalEntryId } : {}),
        ...(data.notes ? { notes: data.notes } : {}),
      },
      include: { contact: true },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdatePayableInput,
  ): Promise<PayableWithContact> {
    const scope = this.requireOrg(organizationId);

    return this.db.accountsPayable.update({
      where: { id, ...scope },
      data: {
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.dueDate !== undefined ? { dueDate: data.dueDate } : {}),
        ...(data.sourceType !== undefined ? { sourceType: data.sourceType } : {}),
        ...(data.sourceId !== undefined ? { sourceId: data.sourceId } : {}),
        ...(data.journalEntryId !== undefined
          ? { journalEntryId: data.journalEntryId }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes } : {}),
      },
      include: { contact: true },
    });
  }

  async updateStatus(
    organizationId: string,
    id: string,
    status: PayableStatus,
    paid: number | string,
    balance: number | string,
  ): Promise<PayableWithContact> {
    const scope = this.requireOrg(organizationId);

    return this.db.accountsPayable.update({
      where: { id, ...scope },
      data: { status, paid, balance },
      include: { contact: true },
    });
  }

  async createTx(
    tx: Prisma.TransactionClient,
    data: {
      organizationId: string;
      contactId: string;
      description: string;
      amount: number;
      dueDate: Date;
      sourceType?: string;
      sourceId?: string;
      journalEntryId?: string;
    },
  ): Promise<{ id: string }> {
    return tx.accountsPayable.create({
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
    });
  }

  async voidTx(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<void> {
    await tx.accountsPayable.update({
      where: { id },
      data: {
        status: "VOIDED",
        balance: new Prisma.Decimal(0),
      },
    });
  }

  async updatePaymentTx(
    tx: Prisma.TransactionClient,
    id: string,
    paid: number,
    balance: number,
    status: string,
  ): Promise<void> {
    await tx.accountsPayable.update({
      where: { id },
      data: {
        paid: new Prisma.Decimal(paid),
        balance: new Prisma.Decimal(balance),
        status: status as PayableStatus,
      },
    });
  }

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    const scope = this.requireOrg(organizationId);

    const result = await this.db.accountsPayable.aggregate({
      where: {
        ...scope,
        ...(contactId ? { contactId } : {}),
        status: { in: ["PENDING", "PARTIAL"] },
      },
      _sum: { balance: true },
      _count: { id: true },
    });

    return {
      totalBalance: result._sum.balance ?? new Prisma.Decimal(0),
      count: result._count.id,
    };
  }
}
