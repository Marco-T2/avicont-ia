import "server-only";
import { prisma } from "@/lib/prisma";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type {
  PaymentRepository,
  PaymentFilters,
  UnappliedPaymentSnapshot,
  CustomerBalanceSnapshot,
} from "../domain/payment.repository";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";
import { Payment } from "../domain/payment.entity";
import { PaymentAllocation } from "../domain/payment-allocation.entity";
import { AllocationTarget } from "../domain/value-objects/allocation-target";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

// ── Prisma include clause for Payment + allocations ────────────────────────

const paymentInclude = {
  allocations: true,
} as const;

// ── DbClient type (minimal intersection needed for this adapter) ────────────

type DbClient = Pick<PrismaClient, "payment" | "paymentAllocation" | "accountsReceivable" | "$transaction">;

// ── Row → Domain mapper ────────────────────────────────────────────────────

function rowToPayment(row: Record<string, unknown>): Payment {
  const allocations = Array.isArray(row.allocations)
    ? (row.allocations as Record<string, unknown>[]).map(rowToAllocation)
    : [];

  return Payment.fromPersistence({
    id: row.id as string,
    organizationId: row.organizationId as string,
    status: row.status as Parameters<typeof Payment.fromPersistence>[0]["status"],
    method: row.method as Parameters<typeof Payment.fromPersistence>[0]["method"],
    date: row.date as Date,
    amount: MonetaryAmount.of(Number(row.amount)),
    description: row.description as string,
    periodId: row.periodId as string,
    contactId: row.contactId as string,
    referenceNumber: row.referenceNumber as number | null,
    journalEntryId: row.journalEntryId as string | null,
    notes: row.notes as string | null,
    accountCode: row.accountCode as string | null,
    operationalDocTypeId: row.operationalDocTypeId as string | null,
    createdById: row.createdById as string,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    allocations,
  });
}

function rowToAllocation(row: Record<string, unknown>): PaymentAllocation {
  const receivableId = row.receivableId as string | null;
  const payableId = row.payableId as string | null;

  const target = receivableId
    ? AllocationTarget.forReceivable(receivableId)
    : AllocationTarget.forPayable(payableId!);

  return PaymentAllocation.fromPersistence({
    id: row.id as string,
    paymentId: row.paymentId as string,
    target,
    amount: MonetaryAmount.of(Number(row.amount)),
  });
}

// ── Domain → Prisma persistence mappers ───────────────────────────────────

function paymentToPrismaData(payment: Payment) {
  const snap = payment.toSnapshot();
  return {
    id: snap.id,
    organizationId: snap.organizationId,
    status: snap.status,
    method: snap.method,
    date: snap.date,
    amount: new Prisma.Decimal(snap.amount),
    description: snap.description,
    periodId: snap.periodId,
    contactId: snap.contactId,
    referenceNumber: snap.referenceNumber,
    journalEntryId: snap.journalEntryId,
    notes: snap.notes,
    accountCode: snap.accountCode,
    operationalDocTypeId: snap.operationalDocTypeId,
    createdById: snap.createdById,
    createdAt: snap.createdAt,
    updatedAt: snap.updatedAt,
  };
}

/**
 * Mapper para nested create dentro de `payment.create({ data: { allocations: { create: [...] } } })`.
 * Retorna shape SIN `paymentId` — Prisma infiere el `paymentId` por la
 * relación parent en nested write y rechaza `paymentId` explicit.
 *
 * Mirror precedent EXACT canonical Sale+Purchase `buildDetailCreate`
 * Without-Parent-Input pattern:
 *   - modules/sale/infrastructure/prisma-sale.repository.ts:213
 *     `Prisma.SaleDetailUncheckedCreateWithoutSaleInput`
 *   - modules/purchase/infrastructure/prisma-purchase.repository.ts:272
 *     `Prisma.PurchaseDetailUncheckedCreateWithoutPurchaseInput`
 */
function allocationsToPrismaNestedCreate(
  payment: Payment,
): Prisma.PaymentAllocationUncheckedCreateWithoutPaymentInput[] {
  const snap = payment.toSnapshot();
  return snap.allocations.map((a) => ({
    id: a.id,
    receivableId: a.receivableId,
    payableId: a.payableId,
    amount: new Prisma.Decimal(a.amount),
  }));
}

/**
 * Mapper para standalone `paymentAllocation.createMany({ data: [...] })`.
 * Retorna shape CON `paymentId` — createMany requiere `paymentId` explicit
 * porque NO hay parent relation context.
 *
 * Mirror precedent EXACT canonical Sale+Purchase callsite createMany pattern:
 *   `details.map(d => ({ saleId: sale.id, ...buildDetailCreate(d) }))`
 *   `details.map(d => ({ purchaseId: purchase.id, ...buildDetailCreate(d) }))`
 *
 * Usado en `update`/`updateTx` flow delete-then-recreate (mirrors legacy).
 */
function allocationsToPrismaCreateMany(payment: Payment) {
  const snap = payment.toSnapshot();
  return snap.allocations.map((a) => ({
    id: a.id,
    paymentId: a.paymentId,
    receivableId: a.receivableId,
    payableId: a.payableId,
    amount: new Prisma.Decimal(a.amount),
  }));
}

// ── Adapter ────────────────────────────────────────────────────────────────

export class PrismaPaymentsRepository implements PaymentRepository {
  constructor(private readonly db: DbClient = prisma) {}

  // ── findById ──────────────────────────────────────────────────────────────

  async findById(organizationId: string, id: string): Promise<Payment | null> {
    const row = await this.db.payment.findFirst({
      where: { id, organizationId },
      include: paymentInclude,
    });
    return row ? rowToPayment(row as unknown as Record<string, unknown>) : null;
  }

  // ── findByIdTx ────────────────────────────────────────────────────────────

  async findByIdTx(tx: unknown, organizationId: string, id: string): Promise<Payment | null> {
    const txClient = tx as Prisma.TransactionClient;
    const row = await txClient.payment.findFirst({
      where: { id, organizationId },
      include: paymentInclude,
    });
    return row ? rowToPayment(row as unknown as Record<string, unknown>) : null;
  }

  // ── findAll ───────────────────────────────────────────────────────────────

  async findAll(organizationId: string, filters?: PaymentFilters): Promise<Payment[]> {
    const where: Record<string, unknown> = { organizationId };

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

    return rows.map((r) => rowToPayment(r as unknown as Record<string, unknown>));
  }

  // ── findPaginated ─────────────────────────────────────────────────────────

  async findPaginated(
    organizationId: string,
    filters?: PaymentFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Payment>> {
    const where: Record<string, unknown> = { organizationId };
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

    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [rows, total] = await Promise.all([
      this.db.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: "desc" },
        skip: skip,
        take: take,
      }),
      this.db.payment.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: rows.map((r) => rowToPayment(r as unknown as Record<string, unknown>)),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  // ── save ──────────────────────────────────────────────────────────────────

  async save(payment: Payment): Promise<void> {
    const data = paymentToPrismaData(payment);
    const allocations = allocationsToPrismaNestedCreate(payment);

    await this.db.payment.create({
      data: {
        ...data,
        allocations: {
          create: allocations,
        },
      },
    });
  }

  // ── saveTx ────────────────────────────────────────────────────────────────

  async saveTx(tx: unknown, payment: Payment): Promise<void> {
    const txClient = tx as Prisma.TransactionClient;
    const data = paymentToPrismaData(payment);
    const allocations = allocationsToPrismaNestedCreate(payment);

    await txClient.payment.create({
      data: {
        ...data,
        allocations: {
          create: allocations,
        },
      },
    });
  }

  // ── update ────────────────────────────────────────────────────────────────

  async update(payment: Payment): Promise<void> {
    const data = paymentToPrismaData(payment);
    const allocations = allocationsToPrismaCreateMany(payment);
    const { id, organizationId, ...fields } = data;

    // Delete existing allocations first, then update payment scalar fields,
    // then recreate allocations — mirrors legacy delete-then-recreate pattern.
    await this.db.paymentAllocation.deleteMany({ where: { paymentId: id } });
    await this.db.payment.update({
      where: { id, organizationId },
      data: fields,
    });
    if (allocations.length > 0) {
      await this.db.paymentAllocation.createMany({ data: allocations });
    }
  }

  // ── updateTx ──────────────────────────────────────────────────────────────

  async updateTx(tx: unknown, payment: Payment): Promise<void> {
    const txClient = tx as Prisma.TransactionClient;
    const data = paymentToPrismaData(payment);
    const allocations = allocationsToPrismaCreateMany(payment);
    const { id, organizationId, ...fields } = data;

    await txClient.paymentAllocation.deleteMany({ where: { paymentId: id } });
    await txClient.payment.update({
      where: { id, organizationId },
      data: fields,
    });
    if (allocations.length > 0) {
      await txClient.paymentAllocation.createMany({ data: allocations });
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────

  async delete(organizationId: string, id: string): Promise<void> {
    await this.db.payment.delete({ where: { id, organizationId } });
  }

  // ── deleteTx ──────────────────────────────────────────────────────────────

  async deleteTx(tx: unknown, organizationId: string, id: string): Promise<void> {
    const txClient = tx as Prisma.TransactionClient;
    await txClient.payment.delete({ where: { id, organizationId } });
  }

  // ── findUnappliedByContact ─────────────────────────────────────────────────

  async findUnappliedByContact(
    organizationId: string,
    contactId: string,
    excludePaymentId?: string,
  ): Promise<UnappliedPaymentSnapshot[]> {
    const rows = await this.db.payment.findMany({
      where: {
        organizationId,
        contactId,
        status: { not: "VOIDED" },
        ...(excludePaymentId ? { id: { not: excludePaymentId } } : {}),
      },
      include: {
        allocations: { select: { amount: true } },
      },
      orderBy: { date: "asc" },
    });

    return (rows as unknown as Array<{
      id: string;
      date: Date;
      amount: { toString(): string };
      description: string;
      allocations: Array<{ amount: { toString(): string } }>;
    }>)
      .map((p) => {
        const totalAllocated = p.allocations.reduce(
          (sum, a) => sum + Number(a.amount),
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

  // ── getCustomerBalance ────────────────────────────────────────────────────

  async getCustomerBalance(
    organizationId: string,
    contactId: string,
  ): Promise<CustomerBalanceSnapshot> {
    // 1. Sum all non-voided receivables for this contact
    const cxcAgg = await this.db.accountsReceivable.aggregate({
      where: { organizationId, contactId, status: { not: "VOIDED" } },
      _sum: { amount: true },
    });
    const totalInvoiced = Number(cxcAgg._sum.amount ?? 0);

    // 2. Sum all non-voided payment amounts for this contact
    const payAgg = await this.db.payment.aggregate({
      where: { organizationId, contactId, status: { not: "VOIDED" } },
      _sum: { amount: true },
    });
    const totalCashPaid = Number(payAgg._sum.amount ?? 0);

    // 3. Sum all allocations from non-voided payments to receivables for this contact
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

  // ── transaction ───────────────────────────────────────────────────────────

  async transaction<T>(
    fn: (tx: unknown) => Promise<T>,
    options?: { timeout?: number; maxWait?: number },
  ): Promise<T> {
    return (this.db as unknown as PrismaClient).$transaction(fn, options);
  }
}
