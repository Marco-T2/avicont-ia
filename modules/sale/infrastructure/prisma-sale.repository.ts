import "server-only";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { toNoonUtc } from "@/lib/date-utils";
import { prisma } from "@/lib/prisma";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";
import { Sale } from "@/modules/sale/domain/sale.entity";
import { SaleDetail } from "@/modules/sale/domain/sale-detail.entity";
import type { SaleStatus } from "@/modules/sale/domain/value-objects/sale-status";
import type {
  SaleFilters,
  SaleRepository,
} from "@/modules/sale/domain/ports/sale.repository";

/**
 * Prisma directo adapter for `SaleRepository` (POC #11.0a A3 Ciclo 3 — §13
 * emergente Opción β locked Marco). Mirror legacy sale.repository bit-exact via
 * Prisma queries directas — NO wrap-thin shim. Legacy post-A3-C7 atomic delete
 * commit ad36da2.
 *
 * Constructor flexible: `db = prisma` para reads pre-UoW; tx-bound dentro de
 * `SaleUnitOfWork.run` (Ciclo 6) — paridad con `PrismaReceivablesRepository`.
 *
 * `getNextSequenceNumberTx` mirror legacy `MAX+1` SIN row lock (D-Sale-Repo#2
 * Opción A locked Marco — fidelidad regla #1; `@@unique([organizationId,
 * sequenceNumber])` actúa como red de seguridad).
 *
 * `saveTx` / `updateTx` aplican `toNoonUtc(sale.date)` en write boundary
 * (mirror legacy `:160,194,349`). El dominio (`Sale`) trata `date` como día
 * de calendario; la normalización a 12:00 UTC es preparación para storage
 * (boundary concern), no responsabilidad del entity (POC #11.0a A3 audit
 * H-01/H-02 — fidelidad legacy regla #1).
 */

type DbClient = Pick<PrismaClient, "sale" | "saleDetail">;

const saleInclude = {
  details: { orderBy: { order: "asc" as const } },
} as const;

export class PrismaSaleRepository implements SaleRepository {
  constructor(private readonly db: DbClient = prisma) {}

  async findById(organizationId: string, id: string): Promise<Sale | null> {
    const row = await this.db.sale.findFirst({
      where: { id, organizationId },
      include: saleInclude,
    });
    return row ? hydrateSaleFromRow(row) : null;
  }

  async findAll(
    organizationId: string,
    filters?: SaleFilters,
  ): Promise<Sale[]> {
    const rows = await this.db.sale.findMany({
      where: {
        organizationId,
        ...(filters?.status ? { status: filters.status as SaleStatus } : {}),
        ...(filters?.contactId ? { contactId: filters.contactId } : {}),
        ...(filters?.periodId ? { periodId: filters.periodId } : {}),
        ...(filters?.dateFrom || filters?.dateTo
          ? {
              date: {
                ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
                ...(filters.dateTo ? { lte: filters.dateTo } : {}),
              },
            }
          : {}),
      },
      include: saleInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(hydrateSaleFromRow);
  }

  async findPaginated(
    organizationId: string,
    filters?: SaleFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Sale>> {
    const where = {
      organizationId,
      ...(filters?.status ? { status: filters.status as SaleStatus } : {}),
      ...(filters?.contactId ? { contactId: filters.contactId } : {}),
      ...(filters?.periodId ? { periodId: filters.periodId } : {}),
      ...(filters?.dateFrom || filters?.dateTo
        ? {
            date: {
              ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
              ...(filters.dateTo ? { lte: filters.dateTo } : {}),
            },
          }
        : {}),
    };
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const take = pageSize;
    // Promise.all (NOT $transaction) — DbClient type Pick<PrismaClient,
    // "sale"|"saleDetail"> NO incluye `$transaction`. Read-only count + items
    // sin tx isolation aceptable para offset pagination — page-shift bajo
    // writes concurrentes es expected behavior offset pattern.
    const [rows, total] = await Promise.all([
      this.db.sale.findMany({
        where,
        include: saleInclude,
        orderBy: { createdAt: "desc" },
        skip: skip,
        take: take,
      }),
      this.db.sale.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: rows.map(hydrateSaleFromRow),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findByIdTx(
    organizationId: string,
    id: string,
  ): Promise<Sale | null> {
    return this.findById(organizationId, id);
  }

  async saveTx(sale: Sale): Promise<Sale> {
    const row = await this.db.sale.create({
      data: {
        id: sale.id,
        organizationId: sale.organizationId,
        status: sale.status,
        sequenceNumber: sale.sequenceNumber ?? 0,
        date: toNoonUtc(sale.date),
        contactId: sale.contactId,
        periodId: sale.periodId,
        description: sale.description,
        referenceNumber: sale.referenceNumber,
        notes: sale.notes,
        totalAmount: new Prisma.Decimal(sale.totalAmount.value),
        journalEntryId: sale.journalEntryId,
        receivableId: sale.receivableId,
        createdById: sale.createdById,
        details: {
          create: sale.details.map((d) => buildDetailCreate(d)),
        },
      },
      include: saleInclude,
    });
    return hydrateSaleFromRow(row);
  }

  async updateTx(
    sale: Sale,
    options: { replaceDetails: boolean },
  ): Promise<Sale> {
    await this.db.sale.update({
      where: { id: sale.id, organizationId: sale.organizationId },
      data: {
        status: sale.status,
        sequenceNumber: sale.sequenceNumber ?? 0,
        date: toNoonUtc(sale.date),
        contactId: sale.contactId,
        description: sale.description,
        referenceNumber: sale.referenceNumber,
        notes: sale.notes,
        totalAmount: new Prisma.Decimal(sale.totalAmount.value),
        journalEntryId: sale.journalEntryId,
        receivableId: sale.receivableId,
      },
    });

    if (options.replaceDetails) {
      await this.db.saleDetail.deleteMany({ where: { saleId: sale.id } });
      if (sale.details.length > 0) {
        await this.db.saleDetail.createMany({
          data: sale.details.map((d) => ({
            saleId: sale.id,
            ...buildDetailCreate(d),
          })),
        });
      }
    }

    const refreshed = await this.db.sale.findFirstOrThrow({
      where: { id: sale.id, organizationId: sale.organizationId },
      include: saleInclude,
    });
    return hydrateSaleFromRow(refreshed);
  }

  async deleteTx(organizationId: string, id: string): Promise<void> {
    await this.db.sale.delete({ where: { id, organizationId } });
  }

  async getNextSequenceNumberTx(organizationId: string): Promise<number> {
    const last = await this.db.sale.findFirst({
      where: { organizationId },
      orderBy: { sequenceNumber: "desc" },
      select: { sequenceNumber: true },
    });
    return (last?.sequenceNumber ?? 0) + 1;
  }
}

function buildDetailCreate(
  d: SaleDetail,
): Prisma.SaleDetailUncheckedCreateWithoutSaleInput {
  return {
    description: d.description,
    lineAmount: new Prisma.Decimal(d.lineAmount.value),
    order: d.order,
    quantity:
      d.quantity !== undefined ? new Prisma.Decimal(d.quantity) : null,
    unitPrice:
      d.unitPrice !== undefined ? new Prisma.Decimal(d.unitPrice) : null,
    incomeAccountId: d.incomeAccountId,
  };
}

type SaleRow = Prisma.SaleGetPayload<{
  include: { details: { orderBy: { order: "asc" } } };
}>;

function hydrateSaleFromRow(row: SaleRow): Sale {
  return Sale.fromPersistence({
    id: row.id,
    organizationId: row.organizationId,
    status: row.status,
    sequenceNumber: row.sequenceNumber,
    date: row.date,
    contactId: row.contactId,
    periodId: row.periodId,
    description: row.description,
    referenceNumber: row.referenceNumber,
    notes: row.notes,
    totalAmount: MonetaryAmount.of(row.totalAmount.toString()),
    journalEntryId: row.journalEntryId,
    receivableId: row.receivableId,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    details: row.details.map((d) =>
      SaleDetail.fromPersistence({
        id: d.id,
        saleId: d.saleId,
        description: d.description,
        lineAmount: MonetaryAmount.of(d.lineAmount.toString()),
        order: d.order,
        quantity: d.quantity ? d.quantity.toNumber() : undefined,
        unitPrice: d.unitPrice ? d.unitPrice.toNumber() : undefined,
        incomeAccountId: d.incomeAccountId,
      }),
    ),
    receivable: null,
  });
}
