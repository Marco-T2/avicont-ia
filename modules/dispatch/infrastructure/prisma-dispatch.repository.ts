import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { DispatchType as PrismaDispatchType, DispatchStatus as PrismaDispatchStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { toNoonUtc } from "@/lib/date-utils";
import { Dispatch, type DispatchProps } from "../domain/dispatch.entity";
import { DispatchDetail, type DispatchDetailProps } from "../domain/dispatch-detail.entity";
import { ReceivableSummary } from "../domain/value-objects/receivable-summary";
import { PaymentAllocationSummary } from "../domain/value-objects/payment-allocation-summary";
import type { DispatchType } from "../domain/value-objects/dispatch-type";
import type { DispatchStatus } from "../domain/value-objects/dispatch-status";
import type {
  DispatchRepository,
  DispatchFilters,
} from "../domain/ports/dispatch.repository";
import type {
  PaginationOptions,
  PaginatedResult,
} from "@/modules/shared/domain/value-objects/pagination";
import type { ComputedDetail } from "../domain/compute-line-amounts";
import type { BcSummary } from "../domain/compute-bc-summary";

// ── Where-builder DRY helper (shared by findAll + findPaginated) ──────────

/**
 * Builds the Prisma `where` clause shared by `findAll` and `findPaginated`.
 * Mirror of `buildJournalEntryWhere` precedent — extracted to avoid drift
 * when filter logic evolves (5 clauses today: dispatchType, status,
 * contactId, periodId, date range).
 */
function buildDispatchWhere(
  organizationId: string,
  filters?: DispatchFilters,
): Record<string, unknown> {
  const where: Record<string, unknown> = { organizationId };
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
  return where;
}

// ── Prisma include shapes ──────────────────────────────────────────────────

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

// ── Mapper: Prisma row → domain Dispatch entity ───────────────────────────

function toDomainDispatch(row: Record<string, unknown>): Dispatch {
  const details = ((row.details as unknown[]) ?? []).map((d) => {
    const det = d as Record<string, unknown>;
    return DispatchDetail.fromPersistence({
      id: det.id as string,
      dispatchId: det.dispatchId as string,
      description: det.description as string,
      boxes: det.boxes as number,
      grossWeight: Number(det.grossWeight),
      tare: Number(det.tare),
      netWeight: Number(det.netWeight),
      unitPrice: Number(det.unitPrice),
      lineAmount: Number(det.lineAmount),
      order: det.order as number,
      productTypeId: (det.productTypeId as string) ?? undefined,
      detailNote: (det.detailNote as string) ?? undefined,
      shrinkage: det.shrinkage !== null ? Number(det.shrinkage) : undefined,
      shortage: det.shortage !== null ? Number(det.shortage) : undefined,
      realNetWeight:
        det.realNetWeight !== null ? Number(det.realNetWeight) : undefined,
    });
  });

  let receivable = null;
  if (row.receivable) {
    const r = row.receivable as Record<string, unknown>;
    const allocations = ((r.allocations as unknown[]) ?? []).map((a) => {
      const alloc = a as Record<string, unknown>;
      return PaymentAllocationSummary.fromPersistence({
        id: alloc.id as string,
        paymentId: alloc.paymentId as string,
        amount: Number(alloc.amount),
        payment: alloc.payment as { id: string; date: Date; description: string },
      });
    });
    receivable = ReceivableSummary.fromPersistence({
      id: r.id as string,
      amount: Number(r.amount),
      paid: Number(r.paid),
      balance: Number(r.balance),
      status: r.status as string,
      allocations,
    });
  }

  const props: DispatchProps = {
    id: row.id as string,
    organizationId: row.organizationId as string,
    dispatchType: row.dispatchType as DispatchType,
    status: row.status as DispatchStatus,
    sequenceNumber: row.sequenceNumber as number,
    date: row.date as Date,
    contactId: row.contactId as string,
    periodId: row.periodId as string,
    description: row.description as string,
    referenceNumber: (row.referenceNumber as number | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    totalAmount: Number(row.totalAmount),
    journalEntryId: (row.journalEntryId as string | null) ?? null,
    receivableId: (row.receivableId as string | null) ?? null,
    createdById: row.createdById as string,
    createdAt: row.createdAt as Date,
    updatedAt: row.updatedAt as Date,
    details,
    receivable,
    farmOrigin: (row.farmOrigin as string | null) ?? null,
    chickenCount: (row.chickenCount as number | null) ?? null,
    shrinkagePct: row.shrinkagePct !== null ? Number(row.shrinkagePct) : null,
    avgKgPerChicken:
      row.avgKgPerChicken !== null ? Number(row.avgKgPerChicken) : null,
    totalGrossKg: row.totalGrossKg !== null ? Number(row.totalGrossKg) : null,
    totalNetKg: row.totalNetKg !== null ? Number(row.totalNetKg) : null,
    totalShrinkKg:
      row.totalShrinkKg !== null ? Number(row.totalShrinkKg) : null,
    totalShortageKg:
      row.totalShortageKg !== null ? Number(row.totalShortageKg) : null,
    totalRealNetKg:
      row.totalRealNetKg !== null ? Number(row.totalRealNetKg) : null,
  };

  return Dispatch.fromPersistence(props);
}

// ── PrismaDispatchRepository ───────────────────────────────────────────────

export class PrismaDispatchRepository implements DispatchRepository {
  private readonly db = prisma;

  async findAll(
    organizationId: string,
    filters?: DispatchFilters,
  ): Promise<Dispatch[]> {
    const where = buildDispatchWhere(organizationId, filters);
    const rows = await this.db.dispatch.findMany({
      where,
      include: dispatchInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    return rows.map((r) => toDomainDispatch(r as unknown as Record<string, unknown>));
  }

  /**
   * Paginated read — mirror `PrismaSaleRepository.findPaginated` shape.
   * `Promise.all([findMany, count])` (NOT $transaction — read-only, offset
   * pattern, page-shift under concurrent writes is expected behavior).
   * `orderBy: [{createdAt:"desc"},{id:"desc"}]` tiebreaker per AD-2 of
   * `sdd/poc-sales-unified-pagination/design`.
   */
  async findPaginated(
    organizationId: string,
    filters?: DispatchFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Dispatch>> {
    const where = buildDispatchWhere(organizationId, filters);
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    const [rows, total] = await Promise.all([
      this.db.dispatch.findMany({
        where,
        include: dispatchInclude,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
      }),
      this.db.dispatch.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: rows.map((r) =>
        toDomainDispatch(r as unknown as Record<string, unknown>),
      ),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findById(
    organizationId: string,
    id: string,
  ): Promise<Dispatch | null> {
    const row = await this.db.dispatch.findFirst({
      where: { id, organizationId },
      include: dispatchDetailInclude,
    });
    if (!row) return null;
    return toDomainDispatch(row as unknown as Record<string, unknown>);
  }

  async findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<Dispatch | null> {
    return this.findById(organizationId, id);
  }

  async saveTx(dispatch: Dispatch): Promise<Dispatch> {
    const details = dispatch.details;
    const row = await this.db.dispatch.create({
      data: {
        id: dispatch.id,
        organizationId: dispatch.organizationId,
        dispatchType: dispatch.dispatchType as PrismaDispatchType,
        status: dispatch.status as PrismaDispatchStatus,
        sequenceNumber: dispatch.sequenceNumber,
        referenceNumber: dispatch.referenceNumber,
        date: toNoonUtc(dispatch.date),
        contactId: dispatch.contactId,
        periodId: dispatch.periodId,
        description: dispatch.description,
        notes: dispatch.notes,
        farmOrigin: dispatch.farmOrigin,
        chickenCount: dispatch.chickenCount,
        shrinkagePct:
          dispatch.shrinkagePct !== null
            ? new Prisma.Decimal(dispatch.shrinkagePct)
            : null,
        avgKgPerChicken:
          dispatch.avgKgPerChicken !== null
            ? new Prisma.Decimal(dispatch.avgKgPerChicken)
            : null,
        totalGrossKg:
          dispatch.totalGrossKg !== null
            ? new Prisma.Decimal(dispatch.totalGrossKg)
            : null,
        totalNetKg:
          dispatch.totalNetKg !== null
            ? new Prisma.Decimal(dispatch.totalNetKg)
            : null,
        totalShrinkKg:
          dispatch.totalShrinkKg !== null
            ? new Prisma.Decimal(dispatch.totalShrinkKg)
            : null,
        totalShortageKg:
          dispatch.totalShortageKg !== null
            ? new Prisma.Decimal(dispatch.totalShortageKg)
            : null,
        totalRealNetKg:
          dispatch.totalRealNetKg !== null
            ? new Prisma.Decimal(dispatch.totalRealNetKg)
            : null,
        totalAmount: new Prisma.Decimal(dispatch.totalAmount),
        createdById: dispatch.createdById,
        details: {
          create: details.map((d) => ({
            id: d.id,
            productTypeId: d.productTypeId ?? null,
            detailNote: d.detailNote ?? null,
            description: d.description,
            boxes: d.boxes,
            grossWeight: new Prisma.Decimal(d.grossWeight),
            tare: new Prisma.Decimal(d.tare),
            netWeight: new Prisma.Decimal(d.netWeight),
            unitPrice: new Prisma.Decimal(d.unitPrice),
            shrinkage:
              d.shrinkage !== undefined
                ? new Prisma.Decimal(d.shrinkage)
                : null,
            shortage:
              d.shortage !== undefined
                ? new Prisma.Decimal(d.shortage)
                : null,
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
    return toDomainDispatch(row as unknown as Record<string, unknown>);
  }

  async updateTx(
    dispatch: Dispatch,
    options: {
      replaceDetails: boolean;
      computedDetails?: ComputedDetail[];
      bcSummary?: BcSummary;
    },
  ): Promise<Dispatch> {
    const data: Record<string, unknown> = {
      status: dispatch.status,
      date: toNoonUtc(dispatch.date),
      contactId: dispatch.contactId,
      description: dispatch.description,
      referenceNumber: dispatch.referenceNumber,
      notes: dispatch.notes,
      farmOrigin: dispatch.farmOrigin,
      chickenCount: dispatch.chickenCount,
      shrinkagePct:
        dispatch.shrinkagePct !== null
          ? new Prisma.Decimal(dispatch.shrinkagePct)
          : null,
      totalAmount: new Prisma.Decimal(dispatch.totalAmount),
      sequenceNumber: dispatch.sequenceNumber,
    };

    if (options.bcSummary) {
      data.avgKgPerChicken = new Prisma.Decimal(
        options.bcSummary.avgKgPerChicken,
      );
      data.totalGrossKg = new Prisma.Decimal(options.bcSummary.totalGrossKg);
      data.totalNetKg = new Prisma.Decimal(options.bcSummary.totalNetKg);
      data.totalShrinkKg = new Prisma.Decimal(
        options.bcSummary.totalShrinkKg,
      );
      data.totalShortageKg = new Prisma.Decimal(
        options.bcSummary.totalShortageKg,
      );
      data.totalRealNetKg = new Prisma.Decimal(
        options.bcSummary.totalRealNetKg,
      );
    }

    await this.db.dispatch.update({
      where: { id: dispatch.id, organizationId: dispatch.organizationId },
      data,
    });

    if (options.replaceDetails && options.computedDetails) {
      await this.db.dispatchDetail.deleteMany({
        where: { dispatchId: dispatch.id },
      });
      if (options.computedDetails.length > 0) {
        await this.db.dispatchDetail.createMany({
          data: options.computedDetails.map((d) => ({
            dispatchId: dispatch.id,
            productTypeId: d.productTypeId ?? null,
            detailNote: d.detailNote ?? null,
            description: d.description,
            boxes: d.boxes,
            grossWeight: new Prisma.Decimal(d.grossWeight),
            tare: new Prisma.Decimal(d.tare),
            netWeight: new Prisma.Decimal(d.netWeight),
            unitPrice: new Prisma.Decimal(d.unitPrice),
            shrinkage:
              d.shrinkage !== undefined
                ? new Prisma.Decimal(d.shrinkage)
                : null,
            shortage:
              d.shortage !== undefined
                ? new Prisma.Decimal(d.shortage)
                : null,
            realNetWeight:
              d.realNetWeight !== undefined
                ? new Prisma.Decimal(d.realNetWeight)
                : null,
            lineAmount: new Prisma.Decimal(d.lineAmount),
            order: d.order,
          })),
        });
      }
    }

    return this.findById(dispatch.organizationId, dispatch.id) as Promise<Dispatch>;
  }

  async deleteTx(organizationId: string, id: string): Promise<void> {
    await this.db.dispatch.delete({
      where: { id, organizationId },
    });
  }

  async getNextSequenceNumberTx(
    organizationId: string,
    dispatchType: DispatchType,
  ): Promise<number> {
    const last = await this.db.dispatch.findFirst({
      where: {
        organizationId,
        dispatchType: dispatchType as PrismaDispatchType,
      },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
  }

  async linkJournalAndReceivableTx(
    organizationId: string,
    id: string,
    journalEntryId: string,
    receivableId: string,
  ): Promise<void> {
    await this.db.dispatch.update({
      where: { id, organizationId },
      data: { journalEntryId, receivableId },
    });
  }

  async updateStatusTx(
    organizationId: string,
    id: string,
    status: DispatchStatus,
    totalAmount?: number,
    sequenceNumber?: number,
  ): Promise<Dispatch> {
    await this.db.dispatch.update({
      where: { id, organizationId },
      data: {
        status: status as PrismaDispatchStatus,
        ...(totalAmount !== undefined && {
          totalAmount: new Prisma.Decimal(totalAmount),
        }),
        ...(sequenceNumber !== undefined && { sequenceNumber }),
      },
    });
    return this.findById(organizationId, id) as Promise<Dispatch>;
  }

  async cloneToDraftTx(
    organizationId: string,
    source: Dispatch,
  ): Promise<Dispatch> {
    const details = source.details;
    const newId = crypto.randomUUID();
    const row = await this.db.dispatch.create({
      data: {
        id: newId,
        organizationId,
        dispatchType: source.dispatchType as PrismaDispatchType,
        status: "DRAFT",
        sequenceNumber: 0,
        referenceNumber: source.referenceNumber,
        date: source.date,
        contactId: source.contactId,
        periodId: source.periodId,
        description: source.description,
        notes: source.notes,
        farmOrigin: source.farmOrigin,
        chickenCount: source.chickenCount,
        shrinkagePct:
          source.shrinkagePct !== null
            ? new Prisma.Decimal(source.shrinkagePct)
            : null,
        avgKgPerChicken:
          source.avgKgPerChicken !== null
            ? new Prisma.Decimal(source.avgKgPerChicken)
            : null,
        totalGrossKg:
          source.totalGrossKg !== null
            ? new Prisma.Decimal(source.totalGrossKg)
            : null,
        totalNetKg:
          source.totalNetKg !== null
            ? new Prisma.Decimal(source.totalNetKg)
            : null,
        totalShrinkKg:
          source.totalShrinkKg !== null
            ? new Prisma.Decimal(source.totalShrinkKg)
            : null,
        totalShortageKg:
          source.totalShortageKg !== null
            ? new Prisma.Decimal(source.totalShortageKg)
            : null,
        totalRealNetKg:
          source.totalRealNetKg !== null
            ? new Prisma.Decimal(source.totalRealNetKg)
            : null,
        totalAmount: new Prisma.Decimal(0),
        journalEntryId: null,
        receivableId: null,
        createdById: source.createdById,
        details: {
          create: details.map((d) => ({
            productTypeId: d.productTypeId ?? null,
            detailNote: d.detailNote ?? null,
            description: d.description,
            boxes: d.boxes,
            grossWeight: new Prisma.Decimal(d.grossWeight),
            tare: new Prisma.Decimal(d.tare),
            netWeight: new Prisma.Decimal(d.netWeight),
            unitPrice: new Prisma.Decimal(d.unitPrice),
            shrinkage:
              d.shrinkage !== undefined
                ? new Prisma.Decimal(d.shrinkage)
                : null,
            shortage:
              d.shortage !== undefined
                ? new Prisma.Decimal(d.shortage)
                : null,
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
    return toDomainDispatch(row as unknown as Record<string, unknown>);
  }
}
