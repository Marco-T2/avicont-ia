import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { PaymentStatus, ReceivableStatus, PayableStatus } from "@/generated/prisma/client";
import type {
  PaymentWithRelations,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilters,
  AllocationInput,
} from "./payment.types";

const paymentInclude = {
  contact: true,
  period: true,
  journalEntry: true,
  allocations: {
    include: {
      receivable: { include: { contact: true } },
      payable: { include: { contact: true } },
    },
  },
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
    data: CreatePaymentInput,
  ): Promise<PaymentWithRelations> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.payment.create({
      data: {
        organizationId: scope.organizationId,
        status: "DRAFT",
        method: data.method,
        date: data.date,
        amount: new Prisma.Decimal(data.amount),
        creditApplied: new Prisma.Decimal(data.creditApplied ?? 0),
        description: data.description,
        periodId: data.periodId,
        contactId: data.contactId,
        referenceNumber: data.referenceNumber ?? null,
        notes: data.notes ?? null,
        createdById: data.createdById,
        allocations: {
          create: data.allocations.map((a) => ({
            receivableId: a.receivableId ?? null,
            payableId: a.payableId ?? null,
            amount: new Prisma.Decimal(a.amount),
          })),
        },
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

    // If allocations are provided, delete existing and recreate within a transaction
    if (data.allocations) {
      const row = await this.db.$transaction(async (tx) => {
        // Delete existing allocations
        await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });

        // Update payment fields + recreate allocations
        return tx.payment.update({
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
            allocations: {
              create: data.allocations!.map((a) => ({
                receivableId: a.receivableId ?? null,
                payableId: a.payableId ?? null,
                amount: new Prisma.Decimal(a.amount),
              })),
            },
          },
          include: paymentInclude,
        });
      });

      return toPaymentWithRelations(row);
    }

    // No allocation changes — simple update
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

  async createPostedTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    data: CreatePaymentInput,
  ): Promise<PaymentWithRelations> {
    const scope = this.requireOrg(organizationId);

    const row = await tx.payment.create({
      data: {
        organizationId: scope.organizationId,
        status: "POSTED",
        method: data.method,
        date: data.date,
        amount: new Prisma.Decimal(data.amount),
        creditApplied: new Prisma.Decimal(data.creditApplied ?? 0),
        description: data.description,
        periodId: data.periodId,
        contactId: data.contactId,
        referenceNumber: data.referenceNumber ?? null,
        notes: data.notes ?? null,
        createdById: data.createdById,
        allocations: {
          create: data.allocations.map((a) => ({
            receivableId: a.receivableId ?? null,
            payableId: a.payableId ?? null,
            amount: new Prisma.Decimal(a.amount),
          })),
        },
      },
      include: paymentInclude,
    });

    return toPaymentWithRelations(row);
  }

  async updateTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    data: UpdatePaymentInput,
  ): Promise<PaymentWithRelations> {
    const scope = this.requireOrg(organizationId);

    if (data.allocations) {
      await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });

      const row = await tx.payment.update({
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
          allocations: {
            create: data.allocations!.map((a) => ({
              receivableId: a.receivableId ?? null,
              payableId: a.payableId ?? null,
              amount: new Prisma.Decimal(a.amount),
            })),
          },
        },
        include: paymentInclude,
      });

      return toPaymentWithRelations(row);
    }

    const row = await tx.payment.update({
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
  ): Promise<void> {
    const scope = this.requireOrg(organizationId);

    await tx.payment.update({
      where: { id, ...scope },
      data: { status },
    });
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

  // ── Allocation helpers (used within service transactions) ──

  async updateAllocations(
    tx: Prisma.TransactionClient,
    paymentId: string,
    allocations: AllocationInput[],
  ): Promise<void> {
    // Delete existing and recreate
    await tx.paymentAllocation.deleteMany({ where: { paymentId } });

    if (allocations.length > 0) {
      await tx.paymentAllocation.createMany({
        data: allocations.map((a) => ({
          paymentId,
          receivableId: a.receivableId ?? null,
          payableId: a.payableId ?? null,
          amount: new Prisma.Decimal(a.amount),
        })),
      });
    }
  }

  async getAllocations(
    paymentId: string,
  ) {
    return this.db.paymentAllocation.findMany({
      where: { paymentId },
      include: {
        receivable: { include: { contact: true } },
        payable: { include: { contact: true } },
      },
    });
  }

  // ── Customer balance summary ──

  async getCustomerBalance(
    organizationId: string,
    contactId: string,
  ): Promise<{
    totalInvoiced: number;
    totalPaid: number;
    netBalance: number;
    unappliedCredit: number;
  }> {
    const scope = this.requireOrg(organizationId);

    // 1. Sum all non-voided CxC amounts for this customer
    const cxcAgg = await this.db.accountsReceivable.aggregate({
      where: { ...scope, contactId, status: { not: "VOIDED" } },
      _sum: { amount: true },
    });
    const totalInvoiced = Number(cxcAgg._sum.amount ?? 0);

    // 2. Sum all non-voided payment amounts for this customer (cash received)
    const payAgg = await this.db.payment.aggregate({
      where: { ...scope, contactId, status: { not: "VOIDED" } },
      _sum: { amount: true },
    });
    const totalCashPaid = Number(payAgg._sum.amount ?? 0);

    // 3. Sum all allocations from non-voided payments to this customer's CxC
    const allocAgg = await this.db.paymentAllocation.aggregate({
      where: {
        payment: { organizationId, contactId, status: { not: "VOIDED" } },
        receivableId: { not: null },
      },
      _sum: { amount: true },
    });
    const totalAllocated = Number(allocAgg._sum.amount ?? 0);

    // 4. Sum credit consumed FROM this customer's payments by other payments
    const consumedAgg = await this.db.creditConsumption.aggregate({
      where: {
        organizationId,
        sourcePayment: { contactId, status: { not: "VOIDED" } },
        consumerPayment: { status: { not: "VOIDED" } },
      },
      _sum: { amount: true },
    });
    const totalConsumed = Number(consumedAgg._sum.amount ?? 0);

    const unappliedCredit = Math.max(0, totalCashPaid - totalAllocated - totalConsumed);
    const netBalance = totalInvoiced - totalCashPaid;

    return {
      totalInvoiced,
      totalPaid: totalCashPaid,
      netBalance,
      unappliedCredit,
    };
  }

  // ── CxC / CxP payment update helpers (within transaction) ──

  async updateCxCPaymentTx(
    tx: Prisma.TransactionClient,
    receivableId: string,
    paid: number,
    balance: number,
    status: string,
  ): Promise<void> {
    await tx.accountsReceivable.update({
      where: { id: receivableId },
      data: {
        paid: new Prisma.Decimal(paid),
        balance: new Prisma.Decimal(balance),
        status: status as ReceivableStatus,
      },
    });
  }

  async updateCxPPaymentTx(
    tx: Prisma.TransactionClient,
    payableId: string,
    paid: number,
    balance: number,
    status: string,
  ): Promise<void> {
    await tx.accountsPayable.update({
      where: { id: payableId },
      data: {
        paid: new Prisma.Decimal(paid),
        balance: new Prisma.Decimal(balance),
        status: status as PayableStatus,
      },
    });
  }

  // ── Fetch payment with allocations within transaction ──

  async findByIdTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<PaymentWithRelations | null> {
    const scope = this.requireOrg(organizationId);

    const row = await tx.payment.findFirst({
      where: { id, ...scope },
      include: paymentInclude,
    });

    return row ? toPaymentWithRelations(row) : null;
  }
}

// ── Convert Prisma Decimal fields to plain numbers ──

function toPaymentWithRelations(row: unknown): PaymentWithRelations {
  const r = row as Record<string, unknown>;

  // Convert top-level amount and creditApplied
  const result: Record<string, unknown> = {
    ...r,
    amount: Number(r.amount),
    creditApplied: Number(r.creditApplied ?? 0),
  };

  // Convert allocation amounts
  if (Array.isArray(r.allocations)) {
    result.allocations = (r.allocations as Record<string, unknown>[]).map((a) => ({
      ...a,
      amount: Number(a.amount),
    }));
  }

  return result as unknown as PaymentWithRelations;
}
