import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { DispatchStatus, DispatchType } from "@/generated/prisma/client";
import { toNoonUtc } from "@/lib/date-utils";
import type {
  DispatchWithDetails,
  CreateDispatchInput,
  UpdateDispatchInput,
  DispatchFilters,
} from "./dispatch.types";

// ── Forma del detalle calculado que pasa el servicio ──

export interface ComputedDetail {
  productTypeId?: string;
  detailNote?: string;
  description: string;
  boxes: number;
  grossWeight: number;
  tare: number;
  netWeight: number;
  unitPrice: number;
  shrinkage?: number;
  shortage?: number;
  realNetWeight?: number;
  lineAmount: number;
  order: number;
}

// ── Campos del resumen de cabecera BC calculados por el servicio ──

export interface BcSummary {
  totalGrossKg: number;
  totalNetKg: number;
  totalShrinkKg: number;
  totalShortageKg: number;
  totalRealNetKg: number;
  avgKgPerChicken: number;
}

const dispatchInclude = {
  details: {
    orderBy: { order: "asc" as const },
    include: { productType: true },
  },
  contact: true,
} as const;

const dispatchDetailInclude = {
  ...dispatchInclude,
  receivable: {
    select: {
      id: true,
      amount: true,
      paid: true,
      balance: true,
      status: true,
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

export class DispatchRepository extends BaseRepository {
  async findAll(
    organizationId: string,
    filters?: DispatchFilters,
  ): Promise<DispatchWithDetails[]> {
    const scope = this.requireOrg(organizationId);

    const where: Record<string, unknown> = { ...scope };

    if (filters?.dispatchType) where.dispatchType = filters.dispatchType;
    if (filters?.status) where.status = filters.status;
    if (filters?.contactId) where.contactId = filters.contactId;
    if (filters?.periodId) where.periodId = filters.periodId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      };
    }

    const rows = await this.db.dispatch.findMany({
      where,
      include: dispatchInclude,
      orderBy: { createdAt: "desc" },
    });

    return rows as unknown as DispatchWithDetails[];
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<DispatchWithDetails | null> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.dispatch.findFirst({
      where: { id, ...scope },
      include: dispatchDetailInclude,
    });

    return row as unknown as DispatchWithDetails | null;
  }

  async getNextSequenceNumber(
    tx: Prisma.TransactionClient,
    organizationId: string,
    dispatchType: DispatchType,
  ): Promise<number> {
    const last = await tx.dispatch.findFirst({
      where: { organizationId, dispatchType },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
  }

  async create(
    organizationId: string,
    input: CreateDispatchInput,
    sequenceNumber: number,
    computedDetails: ComputedDetail[],
    bcSummary?: BcSummary,
  ): Promise<DispatchWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.dispatch.create({
      data: {
        organizationId: scope.organizationId,
        dispatchType: input.dispatchType,
        status: "DRAFT",
        sequenceNumber,
        referenceNumber: input.referenceNumber ?? null,
        date: toNoonUtc(input.date),
        contactId: input.contactId,
        periodId: input.periodId,
        description: input.description,
        notes: input.notes ?? null,
        // Campos de cabecera exclusivos de BC
        farmOrigin: input.farmOrigin ?? null,
        chickenCount: input.chickenCount ?? null,
        shrinkagePct:
          input.shrinkagePct !== undefined
            ? new Prisma.Decimal(input.shrinkagePct)
            : null,
        avgKgPerChicken:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.avgKgPerChicken)
            : null,
        totalGrossKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalGrossKg)
            : null,
        totalNetKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalNetKg)
            : null,
        totalShrinkKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalShrinkKg)
            : null,
        totalShortageKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalShortageKg)
            : null,
        totalRealNetKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalRealNetKg)
            : null,
        // totalAmount se almacena como 0 en DRAFT — se actualiza al contabilizar
        totalAmount: new Prisma.Decimal(0),
        createdById: input.createdById,
        details: {
          create: computedDetails.map((d) => ({
            productTypeId: d.productTypeId ?? null,
            detailNote: d.detailNote ?? null,
            description: d.description,
            boxes: d.boxes,
            grossWeight: new Prisma.Decimal(d.grossWeight),
            tare: new Prisma.Decimal(d.tare),
            netWeight: new Prisma.Decimal(d.netWeight),
            unitPrice: new Prisma.Decimal(d.unitPrice),
            shrinkage:
              d.shrinkage !== undefined ? new Prisma.Decimal(d.shrinkage) : null,
            shortage:
              d.shortage !== undefined ? new Prisma.Decimal(d.shortage) : null,
            realNetWeight:
              d.realNetWeight !== undefined
                ? new Prisma.Decimal(d.realNetWeight)
                : null,
            lineAmount: new Prisma.Decimal(d.lineAmount),
            order: d.order,
          })),
        },
      },
      include: dispatchInclude,
    });

    return toDispatchWithDetails(row);
  }

  async update(
    organizationId: string,
    id: string,
    data: Omit<UpdateDispatchInput, "details">,
    computedDetails?: ComputedDetail[],
    bcSummary?: BcSummary,
  ): Promise<DispatchWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await this.db.$transaction(async (tx) => {
      const updated = await tx.dispatch.update({
        where: { id, ...scope },
        data: {
          ...(data.date !== undefined && { date: toNoonUtc(data.date) }),
          ...(data.contactId !== undefined && { contactId: data.contactId }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.referenceNumber !== undefined && {
            referenceNumber: data.referenceNumber,
          }),
          ...(data.notes !== undefined && { notes: data.notes }),
          ...(data.farmOrigin !== undefined && { farmOrigin: data.farmOrigin }),
          ...(data.chickenCount !== undefined && { chickenCount: data.chickenCount }),
          ...(data.shrinkagePct !== undefined && {
            shrinkagePct: new Prisma.Decimal(data.shrinkagePct),
          }),
          ...(bcSummary !== undefined && {
            avgKgPerChicken: new Prisma.Decimal(bcSummary.avgKgPerChicken),
            totalGrossKg: new Prisma.Decimal(bcSummary.totalGrossKg),
            totalNetKg: new Prisma.Decimal(bcSummary.totalNetKg),
            totalShrinkKg: new Prisma.Decimal(bcSummary.totalShrinkKg),
            totalShortageKg: new Prisma.Decimal(bcSummary.totalShortageKg),
            totalRealNetKg: new Prisma.Decimal(bcSummary.totalRealNetKg),
          }),
        },
        include: dispatchInclude,
      });

      if (computedDetails !== undefined) {
        await tx.dispatchDetail.deleteMany({ where: { dispatchId: id } });
        if (computedDetails.length > 0) {
          await tx.dispatchDetail.createMany({
            data: computedDetails.map((d) => ({
              dispatchId: id,
              productTypeId: d.productTypeId ?? null,
              detailNote: d.detailNote ?? null,
              description: d.description,
              boxes: d.boxes,
              grossWeight: new Prisma.Decimal(d.grossWeight),
              tare: new Prisma.Decimal(d.tare),
              netWeight: new Prisma.Decimal(d.netWeight),
              unitPrice: new Prisma.Decimal(d.unitPrice),
              shrinkage:
                d.shrinkage !== undefined ? new Prisma.Decimal(d.shrinkage) : null,
              shortage:
                d.shortage !== undefined ? new Prisma.Decimal(d.shortage) : null,
              realNetWeight:
                d.realNetWeight !== undefined
                  ? new Prisma.Decimal(d.realNetWeight)
                  : null,
              lineAmount: new Prisma.Decimal(d.lineAmount),
              order: d.order,
            })),
          });
        }

        // Volver a buscar con los detalles actualizados
        const refreshed = await tx.dispatch.findFirst({
          where: { id, ...scope },
          include: dispatchInclude,
        });
        if (!refreshed) throw new Error(`Dispatch ${id} not found after update`);
        return refreshed;
      }

      return updated;
    });

    return toDispatchWithDetails(row);
  }

  async updateStatusTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    status: DispatchStatus,
    totalAmount?: number,
    sequenceNumber?: number,
  ): Promise<DispatchWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await tx.dispatch.update({
      where: { id, ...scope },
      data: {
        status,
        ...(totalAmount !== undefined && {
          totalAmount: new Prisma.Decimal(totalAmount),
        }),
        ...(sequenceNumber !== undefined && { sequenceNumber }),
      },
      include: dispatchInclude,
    });

    return toDispatchWithDetails(row);
  }

  async linkJournalAndReceivable(
    tx: Prisma.TransactionClient,
    id: string,
    journalEntryId: string,
    receivableId: string,
  ): Promise<void> {
    await tx.dispatch.update({
      where: { id },
      data: { journalEntryId, receivableId },
    });
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const scope = this.requireOrg(organizationId);
    await this.db.dispatch.delete({ where: { id, ...scope } });
  }

  /**
   * Elimina un despacho DRAFT dentro de una transacción.
   * El cascade gestiona la eliminación de detalles. El servicio debe verificar el estado DRAFT antes de llamar.
   */
  async deleteDraft(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<void> {
    await tx.dispatch.delete({
      where: { id, organizationId },
    });
  }

  /**
   * Eliminación definitiva no transaccional para despachos DRAFT (usada por DELETE de la API).
   * El servicio debe verificar el estado DRAFT antes de llamar.
   */
  async hardDelete(organizationId: string, id: string): Promise<void> {
    const scope = this.requireOrg(organizationId);
    await this.db.dispatch.delete({ where: { id, ...scope } });
  }

  /**
   * Crea un nuevo despacho DRAFT clonado a partir de los datos de un despacho origen.
   * Copia todos los campos de cabecera y líneas de detalle. Reinicia secuencia, estado y vínculos.
   */
  async cloneToDraft(
    tx: Prisma.TransactionClient,
    organizationId: string,
    sourceDispatch: DispatchWithDetails,
  ): Promise<DispatchWithDetails> {
    const row = await tx.dispatch.create({
      data: {
        organizationId,
        dispatchType: sourceDispatch.dispatchType,
        status: "DRAFT",
        sequenceNumber: 0,
        referenceNumber: sourceDispatch.referenceNumber ?? null,
        date: sourceDispatch.date,
        contactId: sourceDispatch.contactId,
        periodId: sourceDispatch.periodId,
        description: sourceDispatch.description,
        notes: sourceDispatch.notes ?? null,
        farmOrigin: sourceDispatch.farmOrigin ?? null,
        chickenCount: sourceDispatch.chickenCount ?? null,
        shrinkagePct:
          sourceDispatch.shrinkagePct !== null
            ? new Prisma.Decimal(sourceDispatch.shrinkagePct)
            : null,
        avgKgPerChicken:
          sourceDispatch.avgKgPerChicken !== null
            ? new Prisma.Decimal(sourceDispatch.avgKgPerChicken)
            : null,
        totalGrossKg:
          sourceDispatch.totalGrossKg !== null
            ? new Prisma.Decimal(sourceDispatch.totalGrossKg)
            : null,
        totalNetKg:
          sourceDispatch.totalNetKg !== null
            ? new Prisma.Decimal(sourceDispatch.totalNetKg)
            : null,
        totalShrinkKg:
          sourceDispatch.totalShrinkKg !== null
            ? new Prisma.Decimal(sourceDispatch.totalShrinkKg)
            : null,
        totalShortageKg:
          sourceDispatch.totalShortageKg !== null
            ? new Prisma.Decimal(sourceDispatch.totalShortageKg)
            : null,
        totalRealNetKg:
          sourceDispatch.totalRealNetKg !== null
            ? new Prisma.Decimal(sourceDispatch.totalRealNetKg)
            : null,
        totalAmount: new Prisma.Decimal(0),
        journalEntryId: null,
        receivableId: null,
        createdById: sourceDispatch.createdById,
        details: {
          create: sourceDispatch.details.map((d) => ({
            productTypeId: d.productTypeId ?? null,
            detailNote: d.detailNote ?? null,
            description: d.description,
            boxes: d.boxes,
            grossWeight: new Prisma.Decimal(Number(d.grossWeight)),
            tare: new Prisma.Decimal(Number(d.tare)),
            netWeight: new Prisma.Decimal(Number(d.netWeight)),
            unitPrice: new Prisma.Decimal(Number(d.unitPrice)),
            shrinkage:
              d.shrinkage !== null
                ? new Prisma.Decimal(Number(d.shrinkage))
                : null,
            shortage:
              d.shortage !== null
                ? new Prisma.Decimal(Number(d.shortage))
                : null,
            realNetWeight:
              d.realNetWeight !== null
                ? new Prisma.Decimal(Number(d.realNetWeight))
                : null,
            lineAmount: new Prisma.Decimal(Number(d.lineAmount)),
            order: d.order,
          })),
        },
      },
      include: dispatchInclude,
    });

    return toDispatchWithDetails(row);
  }
  async createPostedTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    input: CreateDispatchInput,
    sequenceNumber: number,
    computedDetails: ComputedDetail[],
    totalAmount: number,
    bcSummary?: BcSummary,
  ): Promise<DispatchWithDetails> {
    const scope = this.requireOrg(organizationId);

    const row = await tx.dispatch.create({
      data: {
        organizationId: scope.organizationId,
        dispatchType: input.dispatchType,
        status: "POSTED",
        sequenceNumber,
        referenceNumber: input.referenceNumber ?? null,
        date: toNoonUtc(input.date),
        contactId: input.contactId,
        periodId: input.periodId,
        description: input.description,
        notes: input.notes ?? null,
        farmOrigin: input.farmOrigin ?? null,
        chickenCount: input.chickenCount ?? null,
        shrinkagePct:
          input.shrinkagePct !== undefined
            ? new Prisma.Decimal(input.shrinkagePct)
            : null,
        avgKgPerChicken:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.avgKgPerChicken)
            : null,
        totalGrossKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalGrossKg)
            : null,
        totalNetKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalNetKg)
            : null,
        totalShrinkKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalShrinkKg)
            : null,
        totalShortageKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalShortageKg)
            : null,
        totalRealNetKg:
          bcSummary !== undefined
            ? new Prisma.Decimal(bcSummary.totalRealNetKg)
            : null,
        totalAmount: new Prisma.Decimal(totalAmount),
        createdById: input.createdById,
        details: {
          create: computedDetails.map((d) => ({
            productTypeId: d.productTypeId ?? null,
            detailNote: d.detailNote ?? null,
            description: d.description,
            boxes: d.boxes,
            grossWeight: new Prisma.Decimal(d.grossWeight),
            tare: new Prisma.Decimal(d.tare),
            netWeight: new Prisma.Decimal(d.netWeight),
            unitPrice: new Prisma.Decimal(d.unitPrice),
            shrinkage:
              d.shrinkage !== undefined ? new Prisma.Decimal(d.shrinkage) : null,
            shortage:
              d.shortage !== undefined ? new Prisma.Decimal(d.shortage) : null,
            realNetWeight:
              d.realNetWeight !== undefined
                ? new Prisma.Decimal(d.realNetWeight)
                : null,
            lineAmount: new Prisma.Decimal(d.lineAmount),
            order: d.order,
          })),
        },
      },
      include: dispatchInclude,
    });

    return toDispatchWithDetails(row);
  }

  async updateTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
    data: Omit<UpdateDispatchInput, "details">,
    computedDetails?: ComputedDetail[],
    bcSummary?: BcSummary,
  ): Promise<DispatchWithDetails> {
    const scope = this.requireOrg(organizationId);

    const updated = await tx.dispatch.update({
      where: { id, ...scope },
      data: {
        ...(data.date !== undefined && { date: toNoonUtc(data.date) }),
        ...(data.contactId !== undefined && { contactId: data.contactId }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.referenceNumber !== undefined && {
          referenceNumber: data.referenceNumber,
        }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.farmOrigin !== undefined && { farmOrigin: data.farmOrigin }),
        ...(data.chickenCount !== undefined && { chickenCount: data.chickenCount }),
        ...(data.shrinkagePct !== undefined && {
          shrinkagePct: new Prisma.Decimal(data.shrinkagePct),
        }),
        ...(bcSummary !== undefined && {
          avgKgPerChicken: new Prisma.Decimal(bcSummary.avgKgPerChicken),
          totalGrossKg: new Prisma.Decimal(bcSummary.totalGrossKg),
          totalNetKg: new Prisma.Decimal(bcSummary.totalNetKg),
          totalShrinkKg: new Prisma.Decimal(bcSummary.totalShrinkKg),
          totalShortageKg: new Prisma.Decimal(bcSummary.totalShortageKg),
          totalRealNetKg: new Prisma.Decimal(bcSummary.totalRealNetKg),
        }),
      },
      include: dispatchInclude,
    });

    if (computedDetails !== undefined) {
      await tx.dispatchDetail.deleteMany({ where: { dispatchId: id } });
      if (computedDetails.length > 0) {
        await tx.dispatchDetail.createMany({
          data: computedDetails.map((d) => ({
            dispatchId: id,
            productTypeId: d.productTypeId ?? null,
            detailNote: d.detailNote ?? null,
            description: d.description,
            boxes: d.boxes,
            grossWeight: new Prisma.Decimal(d.grossWeight),
            tare: new Prisma.Decimal(d.tare),
            netWeight: new Prisma.Decimal(d.netWeight),
            unitPrice: new Prisma.Decimal(d.unitPrice),
            shrinkage:
              d.shrinkage !== undefined ? new Prisma.Decimal(d.shrinkage) : null,
            shortage:
              d.shortage !== undefined ? new Prisma.Decimal(d.shortage) : null,
            realNetWeight:
              d.realNetWeight !== undefined
                ? new Prisma.Decimal(d.realNetWeight)
                : null,
            lineAmount: new Prisma.Decimal(d.lineAmount),
            order: d.order,
          })),
        });
      }

      const refreshed = await tx.dispatch.findFirst({
        where: { id, ...scope },
        include: dispatchInclude,
      });
      if (!refreshed) throw new Error(`Dispatch ${id} not found after update`);
      return toDispatchWithDetails(refreshed);
    }

    return toDispatchWithDetails(updated);
  }
}

// ── Convertir campos Decimal de Prisma a números simples en el valor de retorno ──

function toDispatchWithDetails(row: unknown): DispatchWithDetails {
  const r = row as Record<string, unknown>;
  return {
    ...r,
    totalAmount: Number(r.totalAmount),
    shrinkagePct: r.shrinkagePct !== null ? Number(r.shrinkagePct) : null,
    avgKgPerChicken: r.avgKgPerChicken !== null ? Number(r.avgKgPerChicken) : null,
    totalGrossKg: r.totalGrossKg !== null ? Number(r.totalGrossKg) : null,
    totalNetKg: r.totalNetKg !== null ? Number(r.totalNetKg) : null,
    totalShrinkKg: r.totalShrinkKg !== null ? Number(r.totalShrinkKg) : null,
    totalShortageKg: r.totalShortageKg !== null ? Number(r.totalShortageKg) : null,
    totalRealNetKg: r.totalRealNetKg !== null ? Number(r.totalRealNetKg) : null,
    details: ((r.details as unknown[]) ?? []).map((d) => {
      const detail = d as Record<string, unknown>;
      return {
        ...detail,
        grossWeight: Number(detail.grossWeight),
        tare: Number(detail.tare),
        netWeight: Number(detail.netWeight),
        unitPrice: Number(detail.unitPrice),
        shrinkage: detail.shrinkage !== null ? Number(detail.shrinkage) : null,
        shortage: detail.shortage !== null ? Number(detail.shortage) : null,
        realNetWeight:
          detail.realNetWeight !== null ? Number(detail.realNetWeight) : null,
        lineAmount: Number(detail.lineAmount),
      };
    }),
    displayCode: "", // se completa en la capa de servicio
    receivable: r.receivable
      ? {
          ...(r.receivable as Record<string, unknown>),
          amount: Number((r.receivable as Record<string, unknown>).amount),
          paid: Number((r.receivable as Record<string, unknown>).paid),
          balance: Number((r.receivable as Record<string, unknown>).balance),
          allocations: (
            (r.receivable as Record<string, unknown>).allocations as unknown[] ?? []
          ).map((a) => {
            const alloc = a as Record<string, unknown>;
            return {
              ...alloc,
              amount: Number(alloc.amount),
            };
          }),
        }
      : null,
  } as unknown as DispatchWithDetails;
}
