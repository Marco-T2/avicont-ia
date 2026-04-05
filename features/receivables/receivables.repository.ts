import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { ReceivableStatus } from "@/generated/prisma/client";
import type {
  ReceivableWithContact,
  CreateReceivableInput,
  UpdateReceivableInput,
  ReceivableFilters,
  OpenAggregate,
  AccountsReceivable,
} from "./receivables.types";

export class ReceivablesRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: ReceivableFilters,
  ): Promise<ReceivableWithContact[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.accountsReceivable.findMany({
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
  ): Promise<ReceivableWithContact | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.accountsReceivable.findFirst({
      where: { id, ...scope },
      include: { contact: true },
    });
  }

  async create(
    organizationId: string,
    data: CreateReceivableInput,
  ): Promise<ReceivableWithContact> {
    const scope = this.requireOrg(organizationId);
    const amount = new Prisma.Decimal(data.amount.toString());

    return this.db.accountsReceivable.create({
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
    data: UpdateReceivableInput,
  ): Promise<ReceivableWithContact> {
    const scope = this.requireOrg(organizationId);

    return this.db.accountsReceivable.update({
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
    status: ReceivableStatus,
    paid: Prisma.Decimal,
    balance: Prisma.Decimal,
  ): Promise<ReceivableWithContact> {
    const scope = this.requireOrg(organizationId);

    return this.db.accountsReceivable.update({
      where: { id, ...scope },
      data: { status, paid, balance },
      include: { contact: true },
    });
  }

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    const scope = this.requireOrg(organizationId);

    const result = await this.db.accountsReceivable.aggregate({
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
