import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
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
 * `features/purchase/purchase.repository.ts` bit-exact via Prisma queries
 * directas — NO wrap-thin shim.
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

  async saveTx(_purchase: Purchase): Promise<Purchase> {
    // RED honesty scaffold — Cycle 3 pending (POC #11.0b A3 Ciclo 3).
    throw new Error("Not implemented yet — pending Cycle 3 (POC #11.0b A3 Ciclo 3)");
  }

  async updateTx(
    _purchase: Purchase,
    _options: { replaceDetails: boolean },
  ): Promise<Purchase> {
    // RED honesty scaffold — Cycle 4 pending (POC #11.0b A3 Ciclo 3).
    throw new Error("Not implemented yet — pending Cycle 4 (POC #11.0b A3 Ciclo 3)");
  }

  async deleteTx(_organizationId: string, _id: string): Promise<void> {
    // RED honesty scaffold — Cycle 5 pending (POC #11.0b A3 Ciclo 3).
    throw new Error("Not implemented yet — pending Cycle 5 (POC #11.0b A3 Ciclo 3)");
  }

  async getNextSequenceNumberTx(
    _organizationId: string,
    _purchaseType: PurchaseType,
  ): Promise<number> {
    // RED honesty scaffold — Cycle 6 pending (POC #11.0b A3 Ciclo 3).
    throw new Error("Not implemented yet — pending Cycle 6 (POC #11.0b A3 Ciclo 3)");
  }
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
