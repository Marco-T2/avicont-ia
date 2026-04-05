import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { PaymentStatus } from "@/generated/prisma/client";
import type {
  PaymentWithRelations,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilters,
} from "./payment.types";

const paymentInclude = {
  contact: true,
  receivable: true,
  payable: true,
} as const;

export class PaymentRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<PaymentWithRelations[]> {
    const scope = this.requireOrg(organizationId);

    const where: Record<string, unknown> = { ...scope };

    if (filters?.status) where.status = filters.status;
    if (filters?.method) where.method = filters.method;
    if (filters?.contactId) where.contactId = filters.contactId;
    if (filters?.periodId) where.periodId = filters.periodId;
    if (filters?.receivableId) where.receivableId = filters.receivableId;
    if (filters?.payableId) where.payableId = filters.payableId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      };
    }

    const rows = await this.db.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
    });

    return rows.map(toPaymentWithRelations);
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<PaymentWithRelations | null> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.payment.findFirst({
      where: { id, ...scope },
      include: paymentInclude,
    });

    return row ? toPaymentWithRelations(row) : null;
  }

  async create(
    organizationId: string,
    input: CreatePaymentInput,
    contactId: string,
  ): Promise<PaymentWithRelations> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.payment.create({
      data: {
        organizationId: scope.organizationId,
        status: "DRAFT",
        method: input.method,
        date: input.date,
        amount: new Prisma.Decimal(input.amount),
        description: input.description,
        periodId: input.periodId,
        contactId,
        referenceNumber: input.referenceNumber ?? null,
        receivableId: input.receivableId ?? null,
        payableId: input.payableId ?? null,
        notes: input.notes ?? null,
        createdById: input.createdById,
      },
      include: paymentInclude,
    });

    return toPaymentWithRelations(row);
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdatePaymentInput,
  ): Promise<PaymentWithRelations> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.payment.update({
      where: { id, ...scope },
      data: {
        ...(data.method !== undefined && { method: data.method }),
        ...(data.date !== undefined && { date: data.date }),
        ...(data.amount !== undefined && {
          amount: new Prisma.Decimal(data.amount),
        }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.referenceNumber !== undefined && {
          referenceNumber: data.referenceNumber,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: paymentInclude,
    });

    return toPaymentWithRelations(row);
  }

  async updateStatusTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    status: PaymentStatus,
  ): Promise<PaymentWithRelations> {
    const scope = this.requireOrg(organizationId);

    const row = await tx.payment.update({
      where: { id, ...scope },
      data: { status },
      include: paymentInclude,
    });

    return toPaymentWithRelations(row);
  }

  async linkJournalEntry(
    tx: Prisma.TransactionClient,
    id: string,
    journalEntryId: string,
  ): Promise<void> {
    await tx.payment.update({
      where: { id },
      data: { journalEntryId },
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const scope = this.requireOrg(organizationId);
    await this.db.payment.delete({ where: { id, ...scope } });
  }
}

// ── Convert Prisma Decimal fields to plain numbers ──

function toPaymentWithRelations(row: unknown): PaymentWithRelations {
  const r = row as Record<string, unknown>;
  return {
    ...r,
    amount: Number(r.amount),
  } as unknown as PaymentWithRelations;
}
