import "server-only";
import { prisma } from "@/lib/prisma";
import type {
  PaymentWithRelationsReaderPort,
  PaymentWithRelationsSnapshot,
} from "../../domain/ports/payment-with-relations-reader.port";
import type { PaymentFilters } from "../../domain/payment.repository";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";
import {
  paymentInclude,
  toPaymentWithRelations,
} from "../mappers/payment-with-relations.mapper";

/**
 * Prisma reader adapter for the payment envelope. Implements the read-side
 * port consumed by the presentation `PaymentService` Adapter via
 * composition-root chain canonical R4 exception path EXACT mirror α-A3.B
 * (paired C1b-α `89e6441` precedent — functional move INTO infrastructure
 * + barrel re-export through composition-root.ts canonical exception).
 *
 * Returns `PaymentWithRelationsSnapshot` (domain-internal port boundary
 * type — see port file). Mapper output is structurally equivalent at runtime;
 * TypeScript cast bridges the type-system boundary between domain Snapshot
 * and the underlying envelope shape produced by `toPaymentWithRelations`.
 */
export class PrismaPaymentWithRelationsReaderAdapter
  implements PaymentWithRelationsReaderPort
{
  async findAllWithRelations(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<PaymentWithRelationsSnapshot[]> {
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
    const rows = await prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(
      (row) =>
        toPaymentWithRelations(row) as unknown as PaymentWithRelationsSnapshot,
    );
  }

  async findPaginatedWithRelations(
    organizationId: string,
    filters?: PaymentFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<PaymentWithRelationsSnapshot>> {
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
      prisma.payment.findMany({
        where,
        include: paymentInclude,
        orderBy: { createdAt: "desc" },
        skip: skip,
        take: take,
      }),
      prisma.payment.count({ where }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return {
      items: rows.map(
        (row) =>
          toPaymentWithRelations(row) as unknown as PaymentWithRelationsSnapshot,
      ),
      total,
      page,
      pageSize,
      totalPages,
    };
  }

  async findByIdWithRelations(
    organizationId: string,
    id: string,
  ): Promise<PaymentWithRelationsSnapshot | null> {
    const row = await prisma.payment.findFirst({
      where: { id, organizationId },
      include: paymentInclude,
    });
    return row
      ? (toPaymentWithRelations(row) as unknown as PaymentWithRelationsSnapshot)
      : null;
  }
}
