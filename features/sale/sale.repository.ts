import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { SaleStatus } from "@/generated/prisma/client";
import type {
  SaleWithDetails,
  CreateSaleInput,
  UpdateSaleInput,
  SaleFilters,
  SaleDetailRow,
} from "./sale.types";
import { getDisplayCode } from "./sale.utils";

// ── Forma de detalle computado que pasa el servicio ──

export interface ComputedSaleDetail {
  description: string;
  lineAmount: number;
  order: number;
  quantity?: number;
  unitPrice?: number;
  incomeAccountId: string;
}

// ── Include reducido para consultas de lista ──

const saleInclude = {
  contact: {
    select: {
      id: true,
      name: true,
      type: true,
      nit: true,
      paymentTermsDays: true,
    },
  },
  period: {
    select: {
      id: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
    },
  },
  details: {
    orderBy: { order: "asc" as const },
  },
} as const;

// ── Include completo para findById (incluye receivable con allocations→payment) ──

const saleDetailInclude = {
  ...saleInclude,
  receivable: {
    select: {
      id: true,
      amount: true,
      paid: true,
      balance: true,
      status: true,
      dueDate: true,
      allocations: {
        select: {
          id: true,
          paymentId: true,
          amount: true,
          payment: {
            select: {
              id: true,
              date: true,
              description: true,
            },
          },
        },
        orderBy: { payment: { date: "asc" as const } },
      },
    },
  },
} as const;

export class SaleRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: SaleFilters,
  ): Promise<SaleWithDetails[]> {
    const scope = this.requireOrg(organizationId);

    const where: Record<string, unknown> = { ...scope };

    if (filters?.status) where.status = filters.status;
    if (filters?.contactId) where.contactId = filters.contactId;
    if (filters?.periodId) where.periodId = filters.periodId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      };
    }

    const rows = await this.db.sale.findMany({
      where,
      include: saleInclude,
      orderBy: { createdAt: "desc" },
    });

    return (rows as unknown[]).map((row) => toSaleWithDetails(row));
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<SaleWithDetails | null> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.sale.findFirst({
      where: { id, ...scope },
      include: saleDetailInclude,
    });

    if (!row) return null;
    return toSaleWithDetails(row);
  }

  async getNextSequenceNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
  ): Promise<number> {
    const last = await tx.sale.findFirst({
      where: { organizationId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
  }

  async create(
    organizationId: string,
    input: CreateSaleInput,
    userId: string,
    computedDetails: ComputedSaleDetail[],
  ): Promise<SaleWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.sale.create({
      data: {
        organizationId: scope.organizationId,
        status: "DRAFT",
        sequenceNumber: 0,
        referenceNumber: input.referenceNumber ?? null,
        date: new Date(input.date),
        contactId: input.contactId,
        periodId: input.periodId,
        description: input.description,
        notes: input.notes ?? null,
        totalAmount: new Prisma.Decimal(0),
        createdById: userId,
        details: {
          create: computedDetails.map((d) => buildDetailData(d)),
        },
      },
      include: saleInclude,
    });

    return toSaleWithDetails(row);
  }

  async createPostedTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    input: CreateSaleInput,
    userId: string,
    sequenceNumber: number,
    computedDetails: ComputedSaleDetail[],
    totalAmount: number,
  ): Promise<SaleWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await tx.sale.create({
      data: {
        organizationId: scope.organizationId,
        status: "POSTED",
        sequenceNumber,
        referenceNumber: input.referenceNumber ?? null,
        date: new Date(input.date),
        contactId: input.contactId,
        periodId: input.periodId,
        description: input.description,
        notes: input.notes ?? null,
        totalAmount: new Prisma.Decimal(totalAmount),
        createdById: userId,
        details: {
          create: computedDetails.map((d) => buildDetailData(d)),
        },
      },
      include: saleInclude,
    });

    return toSaleWithDetails(row);
  }

  async update(
    organizationId: string,
    id: string,
    data: Omit<UpdateSaleInput, "details">,
    computedDetails?: ComputedSaleDetail[],
  ): Promise<SaleWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.$transaction(async (tx) => {
      const updated = await tx.sale.update({
        where: { id, ...scope },
        data: buildUpdateData(data),
        include: saleInclude,
      });

      if (computedDetails !== undefined) {
        await tx.saleDetail.deleteMany({ where: { saleId: id } });
        if (computedDetails.length > 0) {
          await tx.saleDetail.createMany({
            data: computedDetails.map((d): Prisma.SaleDetailCreateManyInput => ({
              saleId: id,
              ...buildDetailData(d),
            })),
          });
        }

        const refreshed = await tx.sale.findFirst({
          where: { id, ...scope },
          include: saleInclude,
        });
        if (!refreshed) throw new Error(`Sale ${id} not found after update`);
        return refreshed;
      }

      return updated;
    });

    return toSaleWithDetails(row);
  }

  async updateStatusTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    status: SaleStatus,
    totalAmount?: number,
    sequenceNumber?: number,
  ): Promise<SaleWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await tx.sale.update({
      where: { id, ...scope },
      data: {
        status,
        ...(totalAmount !== undefined && {
          totalAmount: new Prisma.Decimal(totalAmount),
        }),
        ...(sequenceNumber !== undefined && { sequenceNumber }),
      },
      include: saleInclude,
    });

    return toSaleWithDetails(row);
  }

  async linkJournalAndReceivable(
    tx: Prisma.TransactionClient,
    id: string,
    journalEntryId: string,
    receivableId: string,
  ): Promise<void> {
    await tx.sale.update({
      where: { id },
      data: { journalEntryId, receivableId },
    });
  }

  async hardDelete(organizationId: string, id: string): Promise<void> {
    const scope = this.requireOrg(organizationId);
    await this.db.sale.delete({ where: { id, ...scope } });
  }
}

// ── Auxiliares ──

function buildDetailData(d: ComputedSaleDetail): Prisma.SaleDetailUncheckedCreateWithoutSaleInput {
  return {
    description: d.description,
    lineAmount: new Prisma.Decimal(d.lineAmount),
    order: d.order,
    quantity: d.quantity !== undefined ? new Prisma.Decimal(d.quantity) : null,
    unitPrice: d.unitPrice !== undefined ? new Prisma.Decimal(d.unitPrice) : null,
    incomeAccountId: d.incomeAccountId,
  };
}

function buildUpdateData(
  data: Omit<UpdateSaleInput, "details">,
): Record<string, unknown> {
  return {
    ...(data.date !== undefined && { date: new Date(data.date) }),
    ...(data.contactId !== undefined && { contactId: data.contactId }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.referenceNumber !== undefined && {
      referenceNumber: data.referenceNumber,
    }),
    ...(data.notes !== undefined && { notes: data.notes }),
  };
}

// ── Convertir campos Decimal de Prisma a números planos ──

function toSaleWithDetails(row: unknown): SaleWithDetails {
  const r = row as Record<string, unknown>;

  return {
    ...r,
    totalAmount: Number(r.totalAmount),
    details: ((r.details as unknown[]) ?? []).map((d) => {
      const detail = d as Record<string, unknown>;
      return {
        ...detail,
        lineAmount: Number(detail.lineAmount),
        quantity: detail.quantity !== null ? Number(detail.quantity) : null,
        unitPrice: detail.unitPrice !== null ? Number(detail.unitPrice) : null,
      } as SaleDetailRow;
    }),
    displayCode: getDisplayCode(r.sequenceNumber as number),
    receivable: r.receivable
      ? {
          ...(r.receivable as Record<string, unknown>),
          amount: Number((r.receivable as Record<string, unknown>).amount),
          paid: Number((r.receivable as Record<string, unknown>).paid),
          balance: Number((r.receivable as Record<string, unknown>).balance),
          allocations: (
            ((r.receivable as Record<string, unknown>).allocations as unknown[]) ?? []
          ).map((a) => {
            const alloc = a as Record<string, unknown>;
            return {
              ...alloc,
              amount: Number(alloc.amount),
            };
          }),
        }
      : null,
  } as unknown as SaleWithDetails;
}
