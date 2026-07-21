import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import type {
  AuditCloseEventReaderPort,
  AuditCloseEventView,
} from "@/modules/audit/domain/ports/audit-close-event-reader.port";

/**
 * Prisma directo adapter for `AuditCloseEventReaderPort` (audit-pure-read
 * Group B). Mirror the legacy close-event page / audit-trail route
 * `prisma.auditLog.findMany` query, tenant-scoped with
 * `{ organizationId, correlationId }` where (paridad
 * `PrismaSaleContactReaderAdapter`) and explicit select projection so the
 * view stays a clean DTO — `Json?` columns coerced to
 * `Record<string, unknown> | null` (paridad `AuditRow`), no Prisma types leak.
 *
 * Constructor flexible: `db = prisma` default — paridad con
 * `PrismaAuditRepository` / `PrismaUserNameResolver`.
 */

type DbClient = Pick<PrismaClient, "auditLog">;

export class PrismaAuditCloseEventReaderAdapter
  implements AuditCloseEventReaderPort
{
  constructor(private readonly db: DbClient = prisma) {}

  async listByCorrelation(
    organizationId: string,
    correlationId: string,
  ): Promise<AuditCloseEventView[]> {
    const rows = await this.db.auditLog.findMany({
      where: { organizationId, correlationId },
      orderBy: [{ entityType: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        organizationId: true,
        entityType: true,
        entityId: true,
        action: true,
        oldValues: true,
        newValues: true,
        changedById: true,
        justification: true,
        correlationId: true,
        createdAt: true,
      },
    });

    return rows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      entityType: row.entityType,
      entityId: row.entityId,
      action: row.action,
      oldValues: (row.oldValues ?? null) as Record<string, unknown> | null,
      newValues: (row.newValues ?? null) as Record<string, unknown> | null,
      changedById: row.changedById,
      justification: row.justification,
      correlationId: row.correlationId,
      createdAt: row.createdAt,
    }));
  }
}
