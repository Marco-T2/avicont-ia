import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { toNoonUtc } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { Purchase, type PurchaseType } from "@/modules/purchase/domain/purchase.entity";
import { PurchaseDetail } from "@/modules/purchase/domain/purchase-detail.entity";
import type { PurchaseStatus } from "@/modules/purchase/domain/value-objects/purchase-status";
import type {
  PurchaseFilters,
  PurchaseRepository,
} from "@/modules/purchase/domain/ports/purchase.repository";

/**
 * Prisma directo adapter for `PurchaseRepository` (POC #11.0b A3 Ciclo 3 — §13
 * emergente Opción β locked Marco mirror sale C3). Mirror legacy
 * purchase.repository bit-exact via Prisma queries directas — NO wrap-thin
 * shim. Legacy post-A3-C8 atomic delete commit 4aa8480.
 *
 * Constructor flexible: `db = prisma` para reads pre-UoW; tx-bound dentro de
 * `PurchaseUnitOfWork.run` (Ciclo 6) — paridad con `PrismaSaleRepository`.
 *
 * `getNextSequenceNumberTx` mirror legacy `MAX+1` SIN row lock (audit-4 D-A3-1
 * scoped por `purchaseType` — fidelidad regla #1; `@@unique([organizationId,
 * purchaseType, sequenceNumber])` actúa como red de seguridad).
 *
 * `saveTx` / `updateTx` aplican `toNoonUtc(purchase.date)` SOLO en header
 * write boundary (mirror legacy `:190,253`); detail.fecha persiste raw
 * (legacy `:432`).
 *
 * Hidratación: `payable: null` siempre — `PayableSummary` se hidrata en use
 * cases separados via `PayableRepository` (paralelo sale `receivable: null`).
 */

type DbClient = Pick<PrismaClient, "purchase" | "purchaseDetail">;

const purchaseInclude = {
  details: { orderBy: { order: "asc" as const } },
} as const;

export class PrismaPurchaseRepository implements PurchaseRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async findById(organizationId: string, id: string): Promise<Purchase | null> {
    const row = await this.db.purchase.findFirst({
      where: { id, organizationId },
      include: purchaseInclude,
    });
    return row ? hydratePurchaseFromRow(row) : null;
  }

  async findAll(
    organizationId: string,
    filters?: PurchaseFilters,
  ): Promise<Purchase[]> {
    const rows = await this.db.purchase.findMany({
      where: {
        organizationId,
        ...(filters?.purchaseType ? { purchaseType: filters.purchaseType } : {}),
        ...(filters?.status ? { status: filters.status as PurchaseStatus } : {}),
        ...(filters?.contactId ? { contactId: filters.contactId } : {}),
        ...(filters?.dateFrom || filters?.dateTo
          ? {
              date: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
      },
      include: purchaseInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(hydratePurchaseFromRow);
  }

  async findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<Purchase | null> {
    return this.findById(organizationId, id);
  }

  async saveTx(purchase: Purchase): Promise<Purchase> {
    const row = await this.db.purchase.create({
      data: {
        id: purchase.id,
        organizationId: purchase.organizationId,
        purchaseType: purchase.purchaseType,
        status: purchase.status,
        sequenceNumber: purchase.sequenceNumber ?? 0,
        date: toNoonUtc(purchase.date),
        contactId: purchase.contactId,
        periodId: purchase.periodId,
        description: purchase.description,
        referenceNumber: purchase.referenceNumber,
        notes: purchase.notes,
        totalAmount: new Prisma.Decimal(purchase.totalAmount.value),
        ruta: purchase.ruta,
        farmOrigin: purchase.farmOrigin,
        chickenCount: purchase.chickenCount,
        shrinkagePct:
          purchase.shrinkagePct !== null
            ? new Prisma.Decimal(purchase.shrinkagePct)
            : null,
        totalGrossKg:
          purchase.totalGrossKg !== null
            ? new Prisma.Decimal(purchase.totalGrossKg)
            : null,
        totalNetKg:
          purchase.totalNetKg !== null
            ? new Prisma.Decimal(purchase.totalNetKg)
            : null,
        totalShrinkKg:
          purchase.totalShrinkKg !== null
            ? new Prisma.Decimal(purchase.totalShrinkKg)
            : null,
        totalShortageKg:
          purchase.totalShortageKg !== null
            ? new Prisma.Decimal(purchase.totalShortageKg)
            : null,
        totalRealNetKg:
          purchase.totalRealNetKg !== null
            ? new Prisma.Decimal(purchase.totalRealNetKg)
            : null,
        journalEntryId: purchase.journalEntryId,
        payableId: purchase.payableId,
        createdById: purchase.createdById,
        details: {
          create: purchase.details.map((d) => buildDetailCreate(d)),
        },
      },
      include: purchaseInclude,
    });
    return hydratePurchaseFromRow(row);
  }

  async updateTx(
    purchase: Purchase,
    options: { replaceDetails: boolean },
  ): Promise<Purchase> {
    await this.db.purchase.update({
      where: { id: purchase.id, organizationId: purchase.organizationId },
      data: {
        status: purchase.status,
        sequenceNumber: purchase.sequenceNumber ?? 0,
        date: toNoonUtc(purchase.date),
        contactId: purchase.contactId,
        description: purchase.description,
        referenceNumber: purchase.referenceNumber,
        notes: purchase.notes,
        totalAmount: new Prisma.Decimal(purchase.totalAmount.value),
        ruta: purchase.ruta,
        farmOrigin: purchase.farmOrigin,
        chickenCount: purchase.chickenCount,
        shrinkagePct:
          purchase.shrinkagePct !== null
            ? new Prisma.Decimal(purchase.shrinkagePct)
            : null,
        totalGrossKg:
          purchase.totalGrossKg !== null
            ? new Prisma.Decimal(purchase.totalGrossKg)
            : null,
        totalNetKg:
          purchase.totalNetKg !== null
            ? new Prisma.Decimal(purchase.totalNetKg)
            : null,
        totalShrinkKg:
          purchase.totalShrinkKg !== null
            ? new Prisma.Decimal(purchase.totalShrinkKg)
            : null,
        totalShortageKg:
          purchase.totalShortageKg !== null
            ? new Prisma.Decimal(purchase.totalShortageKg)
            : null,
        totalRealNetKg:
          purchase.totalRealNetKg !== null
            ? new Prisma.Decimal(purchase.totalRealNetKg)
            : null,
        journalEntryId: purchase.journalEntryId,
        payableId: purchase.payableId,
      },
    });

    if (options.replaceDetails) {
      await this.db.purchaseDetail.deleteMany({
        where: { purchaseId: purchase.id },
      });
      if (purchase.details.length > 0) {
        await this.db.purchaseDetail.createMany({
          data: purchase.details.map((d) => ({
            purchaseId: purchase.id,
            ...buildDetailCreate(d),
          })),
        });
      }
    }

    const refreshed = await this.db.purchase.findFirstOrThrow({
      where: { id: purchase.id, organizationId: purchase.organizationId },
      include: purchaseInclude,
    });
    return hydratePurchaseFromRow(refreshed);
  }

  async deleteTx(organizationId: string, id: string): Promise<void> {
    await this.db.purchase.delete({ where: { id, organizationId } });
  }

  async getNextSequenceNumberTx(
    organizationId: string,
    purchaseType: PurchaseType,
  ): Promise<number> {
    const last = await this.db.purchase.findFirst({
      where: { organizationId, purchaseType },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
  }
}

function buildDetailCreate(
  d: PurchaseDetail,
): Prisma.PurchaseDetailUncheckedCreateWithoutPurchaseInput {
  return {
    description: d.description,
    lineAmount: new Prisma.Decimal(d.lineAmount.value),
    order: d.order,
    fecha: d.fecha ?? null,
    docRef: d.docRef ?? null,
    chickenQty: d.chickenQty ?? null,
    pricePerChicken:
      d.pricePerChicken !== undefined
        ? new Prisma.Decimal(d.pricePerChicken)
        : null,
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
      d.realNetWeight !== undefined
        ? new Prisma.Decimal(d.realNetWeight)
        : null,
    quantity:
      d.quantity !== undefined ? new Prisma.Decimal(d.quantity) : null,
    expenseAccountId: d.expenseAccountId ?? null,
  };
}

type PurchaseRow = Prisma.PurchaseGetPayload<{
  include: { details: { orderBy: { order: "asc" } } };
}>;

function hydratePurchaseFromRow(row: PurchaseRow): Purchase {
  return Purchase.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    purchaseType: row.purchaseType,
    status: row.status,
    sequenceNumber: row.sequenceNumber,
    date: row.date,
    contactId: row.contactId,
    periodId: row.periodId,
    description: row.description,
    referenceNumber: row.referenceNumber,
    notes: row.notes,
    totalAmount: MonetaryAmount.of(row.totalAmount.toString()),
    ruta: row.ruta,
    farmOrigin: row.farmOrigin,
    chickenCount: row.chickenCount,
    shrinkagePct: row.shrinkagePct ? Number(row.shrinkagePct) : null,
    totalGrossKg: row.totalGrossKg ? Number(row.totalGrossKg) : null,
    totalNetKg: row.totalNetKg ? Number(row.totalNetKg) : null,
    totalShrinkKg: row.totalShrinkKg ? Number(row.totalShrinkKg) : null,
    totalShortageKg: row.totalShortageKg ? Number(row.totalShortageKg) : null,
    totalRealNetKg: row.totalRealNetKg ? Number(row.totalRealNetKg) : null,
    journalEntryId: row.journalEntryId,
    payableId: row.payableId,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    details: row.details.map((d) =>
      PurchaseDetail.fromPersistence({
        id: d.id,
        purchaseId: d.purchaseId,
        description: d.description,
        lineAmount: MonetaryAmount.of(d.lineAmount.toString()),
        order: d.order,
        quantity: d.quantity ? d.quantity.toNumber() : undefined,
        unitPrice: d.unitPrice ? d.unitPrice.toNumber() : undefined,
        expenseAccountId: d.expenseAccountId ?? undefined,
        fecha: d.fecha ?? undefined,
        docRef: d.docRef ?? undefined,
        chickenQty: d.chickenQty ?? undefined,
        pricePerChicken: d.pricePerChicken ? d.pricePerChicken.toNumber() : undefined,
        productTypeId: d.productTypeId ?? undefined,
        detailNote: d.detailNote ?? undefined,
        boxes: d.boxes ?? undefined,
        grossWeight: d.grossWeight ? d.grossWeight.toNumber() : undefined,
        tare: d.tare ? d.tare.toNumber() : undefined,
        netWeight: d.netWeight ? d.netWeight.toNumber() : undefined,
        shrinkage: d.shrinkage ? d.shrinkage.toNumber() : undefined,
        shortage: d.shortage ? d.shortage.toNumber() : undefined,
        realNetWeight: d.realNetWeight ? d.realNetWeight.toNumber() : undefined,
      }),
    ),
    payable: null,
  });
}
