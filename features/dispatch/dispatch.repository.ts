import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type { DispatchStatus, DispatchType } from "@/generated/prisma/client";
import type {
  DispatchWithDetails,
  CreateDispatchInput,
  UpdateDispatchInput,
  DispatchFilters,
} from "./dispatch.types";

// ── Computed detail shape passed from service ──

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

// ── BC header summary fields computed by service ──

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
      include: dispatchInclude,
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
        date: input.date,
        contactId: input.contactId,
        periodId: input.periodId,
        description: input.description,
        notes: input.notes ?? null,
        // BC-only header fields
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
        // totalAmount stored as 0 for DRAFT — updated at POST time
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
          ...(data.date !== undefined && { date: data.date }),
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

        // Re-fetch with updated details
        const refreshed = await tx.dispatch.findFirst({
          where: { id, ...scope },
          include: dispatchInclude,
        });
        return refreshed!;
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
}

// ── Convert Prisma Decimal fields to plain numbers in the return value ──

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
    displayCode: "", // populated by service layer
  } as unknown as DispatchWithDetails;
}
