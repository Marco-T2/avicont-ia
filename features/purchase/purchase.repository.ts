import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { PurchaseStatus, PurchaseType } from "@/generated/prisma/client";
import type {
  PurchaseWithDetails,
  CreatePurchaseInput,
  UpdatePurchaseInput,
  PurchaseFilters,
  PurchaseDetailRow,
} from "./purchase.types";
import { getDisplayCode } from "./purchase.utils";
import { toNoonUtc } from "@/lib/date-utils";

// ── Forma de detalle computado que pasa el servicio ──

export interface ComputedPurchaseDetail {
  description: string;
  lineAmount: number;
  order: number;
  // Columnas FLETE
  fecha?: Date;
  docRef?: string;
  chickenQty?: number;
  pricePerChicken?: number;
  // Columnas POLLO_FAENADO
  productTypeId?: string;
  detailNote?: string;
  boxes?: number;
  grossWeight?: number;
  tare?: number;
  netWeight?: number;
  unitPrice?: number;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
  // Columnas COMPRA_GENERAL / SERVICIO
  quantity?: number;
  expenseAccountId?: string;
}

// ── Campos del resumen de cabecera POLLO_FAENADO calculados por el servicio ──

export interface PfSummary {
  totalGrossKg: number;
  totalNetKg: number;
  totalShrinkKg: number;
  totalShortageKg: number;
  totalRealNetKg: number;
}

// ── Include reducido para consultas de lista ──

const purchaseInclude = {
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
      status: true,
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
  ivaPurchaseBook: true,
} as const;

// ── Include completo para findById (incluye payable con allocations→payment) ──

const purchaseDetailInclude = {
  ...purchaseInclude,
  payable: {
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

export class PurchaseRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: PurchaseFilters,
  ): Promise<PurchaseWithDetails[]> {
    const scope = this.requireOrg(organizationId);

    const where: Record<string, unknown> = { ...scope };

    if (filters?.purchaseType) where.purchaseType = filters.purchaseType;
    if (filters?.status) where.status = filters.status;
    if (filters?.contactId) where.contactId = filters.contactId;
    if (filters?.periodId) where.periodId = filters.periodId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      };
    }

    const rows = await this.db.purchase.findMany({
      where,
      include: purchaseInclude,
      orderBy: { createdAt: "desc" },
    });

    return (rows as unknown[]).map((row) => toPurchaseWithDetails(row));
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<PurchaseWithDetails | null> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.purchase.findFirst({
      where: { id, ...scope },
      include: purchaseDetailInclude,
    });

    if (!row) return null;
    return toPurchaseWithDetails(row);
  }

  async getNextSequenceNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    purchaseType: PurchaseType,
  ): Promise<number> {
    const last = await tx.purchase.findFirst({
      where: { organizationId, purchaseType },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
  }

  async create(
    organizationId: string,
    input: CreatePurchaseInput,
    userId: string,
    computedDetails: ComputedPurchaseDetail[],
    pfSummary?: PfSummary,
  ): Promise<PurchaseWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.purchase.create({
      data: {
        organizationId: scope.organizationId,
        purchaseType: input.purchaseType,
        status: "DRAFT",
        sequenceNumber: 0,
        referenceNumber: input.referenceNumber ?? null,
        date: toNoonUtc(input.date),
        contactId: input.contactId,
        periodId: input.periodId,
        description: input.description,
        notes: input.notes ?? null,
        ruta: input.ruta ?? null,
        farmOrigin: input.farmOrigin ?? null,
        chickenCount: input.chickenCount ?? null,
        shrinkagePct:
          input.shrinkagePct !== undefined
            ? new Prisma.Decimal(input.shrinkagePct)
            : null,
        totalGrossKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalGrossKg)
            : null,
        totalNetKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalNetKg)
            : null,
        totalShrinkKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalShrinkKg)
            : null,
        totalShortageKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalShortageKg)
            : null,
        totalRealNetKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalRealNetKg)
            : null,
        totalAmount: new Prisma.Decimal(0),
        createdById: userId,
        details: {
          create: computedDetails.map((d) => buildDetailData(d)),
        },
      },
      include: purchaseInclude,
    });

    return toPurchaseWithDetails(row);
  }

  async createPostedTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    input: CreatePurchaseInput,
    userId: string,
    sequenceNumber: number,
    computedDetails: ComputedPurchaseDetail[],
    totalAmount: number,
    pfSummary?: PfSummary,
  ): Promise<PurchaseWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await tx.purchase.create({
      data: {
        organizationId: scope.organizationId,
        purchaseType: input.purchaseType,
        status: "POSTED",
        sequenceNumber,
        referenceNumber: input.referenceNumber ?? null,
        date: toNoonUtc(input.date),
        contactId: input.contactId,
        periodId: input.periodId,
        description: input.description,
        notes: input.notes ?? null,
        ruta: input.ruta ?? null,
        farmOrigin: input.farmOrigin ?? null,
        chickenCount: input.chickenCount ?? null,
        shrinkagePct:
          input.shrinkagePct !== undefined
            ? new Prisma.Decimal(input.shrinkagePct)
            : null,
        totalGrossKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalGrossKg)
            : null,
        totalNetKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalNetKg)
            : null,
        totalShrinkKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalShrinkKg)
            : null,
        totalShortageKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalShortageKg)
            : null,
        totalRealNetKg:
          pfSummary !== undefined
            ? new Prisma.Decimal(pfSummary.totalRealNetKg)
            : null,
        totalAmount: new Prisma.Decimal(totalAmount),
        createdById: userId,
        details: {
          create: computedDetails.map((d) => buildDetailData(d)),
        },
      },
      include: purchaseInclude,
    });

    return toPurchaseWithDetails(row);
  }

  async update(
    organizationId: string,
    id: string,
    data: Omit<UpdatePurchaseInput, "details">,
    computedDetails?: ComputedPurchaseDetail[],
    pfSummary?: PfSummary,
  ): Promise<PurchaseWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.$transaction(async (tx) => {
      const updated = await tx.purchase.update({
        where: { id, ...scope },
        data: buildUpdateData(data, pfSummary),
        include: purchaseInclude,
      });

      if (computedDetails !== undefined) {
        await tx.purchaseDetail.deleteMany({ where: { purchaseId: id } });
        if (computedDetails.length > 0) {
          await tx.purchaseDetail.createMany({
            data: computedDetails.map((d): Prisma.PurchaseDetailCreateManyInput => ({
              purchaseId: id,
              ...buildDetailData(d),
            })),
          });
        }

        const refreshed = await tx.purchase.findFirst({
          where: { id, ...scope },
          include: purchaseInclude,
        });
        if (!refreshed) throw new Error(`Purchase ${id} not found after update`);
        return refreshed;
      }

      return updated;
    });

    return toPurchaseWithDetails(row);
  }

  async updateTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    data: Omit<UpdatePurchaseInput, "details">,
    computedDetails?: ComputedPurchaseDetail[],
    pfSummary?: PfSummary,
  ): Promise<PurchaseWithDetails> {
    const scope = this.requireOrg(organizationId);

    const updated = await tx.purchase.update({
      where: { id, ...scope },
      data: buildUpdateData(data, pfSummary),
      include: purchaseInclude,
    });

    if (computedDetails !== undefined) {
      await tx.purchaseDetail.deleteMany({ where: { purchaseId: id } });
      if (computedDetails.length > 0) {
        await tx.purchaseDetail.createMany({
          data: computedDetails.map((d): Prisma.PurchaseDetailCreateManyInput => ({
            purchaseId: id,
            ...buildDetailData(d),
          })),
        });
      }

      const refreshed = await tx.purchase.findFirst({
        where: { id, ...scope },
        include: purchaseInclude,
      });
      if (!refreshed) throw new Error(`Purchase ${id} not found after update`);
      return toPurchaseWithDetails(refreshed);
    }

    return toPurchaseWithDetails(updated);
  }

  async updateStatusTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    status: PurchaseStatus,
    totalAmount?: number,
    sequenceNumber?: number,
  ): Promise<PurchaseWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await tx.purchase.update({
      where: { id, ...scope },
      data: {
        status,
        ...(totalAmount !== undefined && {
          totalAmount: new Prisma.Decimal(totalAmount),
        }),
        ...(sequenceNumber !== undefined && { sequenceNumber }),
      },
      include: purchaseInclude,
    });

    return toPurchaseWithDetails(row);
  }

  async linkJournalAndPayable(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    journalEntryId: string,
    payableId: string,
  ): Promise<void> {
    await tx.purchase.update({
      where: { id, organizationId },
      data: { journalEntryId, payableId },
    });
  }

  /**
   * Eliminación física no transaccional para compras en DRAFT (usada por el DELETE de la API).
   * El servicio debe verificar el estado DRAFT antes de llamar.
   */
  async hardDelete(organizationId: string, id: string): Promise<void> {
    const scope = this.requireOrg(organizationId);
    await this.db.purchase.delete({ where: { id, ...scope } });
  }
}

// ── Auxiliares ──

function buildDetailData(d: ComputedPurchaseDetail): Prisma.PurchaseDetailUncheckedCreateWithoutPurchaseInput {
  return {
    description: d.description,
    lineAmount: new Prisma.Decimal(d.lineAmount),
    order: d.order,
    // FLETE
    fecha: d.fecha ?? null,
    docRef: d.docRef ?? null,
    chickenQty: d.chickenQty ?? null,
    pricePerChicken:
      d.pricePerChicken !== undefined ? new Prisma.Decimal(d.pricePerChicken) : null,
    // POLLO_FAENADO
    productTypeId: d.productTypeId ?? null,
    detailNote: d.detailNote ?? null,
    boxes: d.boxes ?? null,
    grossWeight:
      d.grossWeight !== undefined ? new Prisma.Decimal(d.grossWeight) : null,
    tare: d.tare !== undefined ? new Prisma.Decimal(d.tare) : null,
    netWeight:
      d.netWeight !== undefined ? new Prisma.Decimal(d.netWeight) : null,
    unitPrice:
      d.unitPrice !== undefined ? new Prisma.Decimal(d.unitPrice) : null,
    shrinkage:
      d.shrinkage !== undefined ? new Prisma.Decimal(d.shrinkage) : null,
    shortage:
      d.shortage !== undefined ? new Prisma.Decimal(d.shortage) : null,
    realNetWeight:
      d.realNetWeight !== undefined ? new Prisma.Decimal(d.realNetWeight) : null,
    // COMPRA_GENERAL / SERVICIO
    quantity:
      d.quantity !== undefined ? new Prisma.Decimal(d.quantity) : null,
    expenseAccountId: d.expenseAccountId ?? null,
  };
}

function buildUpdateData(
  data: Omit<UpdatePurchaseInput, "details">,
  pfSummary?: PfSummary,
): Record<string, unknown> {
  return {
    ...(data.date !== undefined && { date: toNoonUtc(data.date) }),
    ...(data.contactId !== undefined && { contactId: data.contactId }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.referenceNumber !== undefined && {
      referenceNumber: data.referenceNumber,
    }),
    ...(data.notes !== undefined && { notes: data.notes }),
    ...(data.ruta !== undefined && { ruta: data.ruta }),
    ...(data.farmOrigin !== undefined && { farmOrigin: data.farmOrigin }),
    ...(data.chickenCount !== undefined && { chickenCount: data.chickenCount }),
    ...(data.shrinkagePct !== undefined && {
      shrinkagePct: new Prisma.Decimal(data.shrinkagePct),
    }),
    ...(pfSummary !== undefined && {
      totalGrossKg: new Prisma.Decimal(pfSummary.totalGrossKg),
      totalNetKg: new Prisma.Decimal(pfSummary.totalNetKg),
      totalShrinkKg: new Prisma.Decimal(pfSummary.totalShrinkKg),
      totalShortageKg: new Prisma.Decimal(pfSummary.totalShortageKg),
      totalRealNetKg: new Prisma.Decimal(pfSummary.totalRealNetKg),
    }),
  };
}

// ── Convertir campos Decimal de Prisma a números planos ──

function toPurchaseWithDetails(row: unknown): PurchaseWithDetails {
  const r = row as Record<string, unknown>;

  return {
    ...r,
    totalAmount: Number(r.totalAmount),
    shrinkagePct: r.shrinkagePct !== null ? Number(r.shrinkagePct) : null,
    totalGrossKg: r.totalGrossKg !== null ? Number(r.totalGrossKg) : null,
    totalNetKg: r.totalNetKg !== null ? Number(r.totalNetKg) : null,
    totalShrinkKg: r.totalShrinkKg !== null ? Number(r.totalShrinkKg) : null,
    totalShortageKg:
      r.totalShortageKg !== null ? Number(r.totalShortageKg) : null,
    totalRealNetKg:
      r.totalRealNetKg !== null ? Number(r.totalRealNetKg) : null,
    details: ((r.details as unknown[]) ?? []).map((d) => {
      const detail = d as Record<string, unknown>;
      return {
        ...detail,
        lineAmount: Number(detail.lineAmount),
        pricePerChicken:
          detail.pricePerChicken !== null ? Number(detail.pricePerChicken) : null,
        grossWeight:
          detail.grossWeight !== null ? Number(detail.grossWeight) : null,
        tare: detail.tare !== null ? Number(detail.tare) : null,
        netWeight: detail.netWeight !== null ? Number(detail.netWeight) : null,
        unitPrice: detail.unitPrice !== null ? Number(detail.unitPrice) : null,
        shrinkage: detail.shrinkage !== null ? Number(detail.shrinkage) : null,
        shortage: detail.shortage !== null ? Number(detail.shortage) : null,
        realNetWeight:
          detail.realNetWeight !== null ? Number(detail.realNetWeight) : null,
        quantity: detail.quantity !== null ? Number(detail.quantity) : null,
      } as PurchaseDetailRow;
    }),
    displayCode: getDisplayCode(
      r.purchaseType as import("@/generated/prisma/client").PurchaseType,
      r.sequenceNumber as number,
    ),
    payable: r.payable
      ? {
          ...(r.payable as Record<string, unknown>),
          amount: Number((r.payable as Record<string, unknown>).amount),
          paid: Number((r.payable as Record<string, unknown>).paid),
          balance: Number((r.payable as Record<string, unknown>).balance),
          allocations: (
            ((r.payable as Record<string, unknown>).allocations as unknown[]) ??
            []
          ).map((a) => {
            const alloc = a as Record<string, unknown>;
            return {
              ...alloc,
              amount: Number(alloc.amount),
            };
          }),
        }
      : null,
  } as unknown as PurchaseWithDetails;
}
