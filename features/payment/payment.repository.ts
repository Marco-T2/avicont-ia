import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { PaymentStatus, ReceivableStatus, PayableStatus } from "@/generated/prisma/client";
import type {
  PaymentWithRelations,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilters,
  AllocationInput,
  UnappliedPayment,
} from "./payment.types";

const paymentInclude = {
  contact: true,
  period: true,
  journalEntry: true,
  operationalDocType: { select: { id: true, code: true, name: true } },
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
        description: data.description,
        periodId: data.periodId,
        contactId: data.contactId,
        referenceNumber: data.referenceNumber ?? null,
        operationalDocTypeId: data.operationalDocTypeId ?? null,
        notes: data.notes ?? null,
        accountCode: data.accountCode ?? null,
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

    // Si se proveen asignaciones, eliminar las existentes y recrearlas dentro de una transacción
    if (data.allocations) {
      const row = await this.db.$transaction(async (tx) => {
        // Eliminar asignaciones existentes
        await tx.paymentAllocation.deleteMany({ where: { paymentId: id } });

        // Actualizar campos del pago + recrear asignaciones
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
            ...(data.operationalDocTypeId !== undefined && {
              operationalDocTypeId: data.operationalDocTypeId,
            }),
            ...(data.notes !== undefined && { notes: data.notes }),
            ...(data.accountCode !== undefined && { accountCode: data.accountCode }),
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

    // Sin cambios en asignaciones — actualización simple
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
        ...(data.operationalDocTypeId !== undefined && {
          operationalDocTypeId: data.operationalDocTypeId,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.accountCode !== undefined && { accountCode: data.accountCode }),
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
        description: data.description,
        periodId: data.periodId,
        contactId: data.contactId,
        referenceNumber: data.referenceNumber ?? null,
        operationalDocTypeId: data.operationalDocTypeId ?? null,
        notes: data.notes ?? null,
        accountCode: data.accountCode ?? null,
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
          ...(data.operationalDocTypeId !== undefined && {
            operationalDocTypeId: data.operationalDocTypeId,
          }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.accountCode !== undefined && { accountCode: data.accountCode }),
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
        ...(data.operationalDocTypeId !== undefined && {
          operationalDocTypeId: data.operationalDocTypeId,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.accountCode !== undefined && { accountCode: data.accountCode }),
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

  // ── Helpers de asignación (usados dentro de transacciones del servicio) ──

  async updateAllocations(
    tx: Prisma.TransactionClient,
    paymentId: string,
    allocations: AllocationInput[],
  ): Promise<void> {
    // Eliminar existentes y recrear
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

  // ── Resumen del saldo del cliente ──

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

    // 1. Sumar todos los montos CxC no anulados para este cliente
    const cxcAgg = await this.db.accountsReceivable.aggregate({
      where: { ...scope, contactId, status: { not: "VOIDED" } },
      _sum: { amount: true },
    });
    const totalInvoiced = Number(cxcAgg._sum.amount ?? 0);

    // 2. Sumar todos los montos de pago no anulados para este cliente (efectivo recibido)
    const payAgg = await this.db.payment.aggregate({
      where: { ...scope, contactId, status: { not: "VOIDED" } },
      _sum: { amount: true },
    });
    const totalCashPaid = Number(payAgg._sum.amount ?? 0);

    // 3. Sumar todas las asignaciones de pagos no anulados a las CxC de este cliente
    const allocAgg = await this.db.paymentAllocation.aggregate({
      where: {
        payment: { organizationId, contactId, status: { not: "VOIDED" } },
        receivableId: { not: null },
      },
      _sum: { amount: true },
    });
    const totalAllocated = Number(allocAgg._sum.amount ?? 0);

    const unappliedCredit = Math.max(0, totalCashPaid - totalAllocated);
    const netBalance = totalInvoiced - totalCashPaid;

    return {
      totalInvoiced,
      totalPaid: totalCashPaid,
      netBalance,
      unappliedCredit,
    };
  }

  async findUnappliedPayments(
    organizationId: string,
    contactId: string,
    excludePaymentId?: string,
  ): Promise<UnappliedPayment[]> {
    const scope = this.requireOrg(organizationId);

    // Obtener todos los pagos no anulados para este contacto, con sus asignaciones
    const payments = await this.db.payment.findMany({
      where: {
        ...scope,
        contactId,
        status: { not: "VOIDED" },
        ...(excludePaymentId && { id: { not: excludePaymentId } }),
      },
      include: {
        allocations: { select: { amount: true } },
      },
      orderBy: { date: "asc" },
    });

    return payments
      .map((p) => {
        const totalAllocated = p.allocations.reduce(
          (sum: number, a: { amount: unknown }) => sum + Number(a.amount),
          0,
        );
        const available = Number(p.amount) - totalAllocated;

        return {
          id: p.id,
          date: p.date,
          amount: Number(p.amount),
          description: p.description,
          totalAllocated,
          available,
        };
      })
      .filter((p) => p.available > 0);
  }

  // ── Helpers de actualización de pago CxC / CxP (dentro de transacción) ──

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

  // ── Obtener pago con asignaciones dentro de transacción ──

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

// ── Convertir campos Decimal de Prisma a números planos ──

function toPaymentWithRelations(row: unknown): PaymentWithRelations {
  const r = row as Record<string, unknown>;

  // Convertir el monto de nivel superior
  const result: Record<string, unknown> = {
    ...r,
    amount: Number(r.amount),
  };

  // Convertir montos de las asignaciones
  if (Array.isArray(r.allocations)) {
    result.allocations = (r.allocations as Record<string, unknown>[]).map((a) => ({
      ...a,
      amount: Number(a.amount),
    }));
  }

  return result as unknown as PaymentWithRelations;
}
