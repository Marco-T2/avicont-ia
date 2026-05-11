import "server-only";

import { prisma } from "@/lib/prisma";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import type { AuditRepository, AuditRow } from "../domain/audit.repository";
import type { AuditCursor, AuditEntityType, AuditListFilters } from "../domain/audit.types";

type DbClient = Pick<PrismaClient, "$queryRaw">;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class PrismaAuditRepository implements AuditRepository {
  constructor(private readonly db: DbClient = prisma) {}

  private requireOrg(organizationId: string): string {
    if (!organizationId) throw new Error("organizationId is required");
    return organizationId;
  }

  async listFlat(
    organizationId: string,
    filters: AuditListFilters,
  ): Promise<{ rows: AuditRow[]; nextCursor: AuditCursor | null }> {
    const orgId = this.requireOrg(organizationId);
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const fetchLimit = limit + 1;

    const entityTypeParam = filters.entityType ?? null;
    const changedByIdParam = filters.changedById ?? null;
    const actionParam = filters.action ?? null;
    const cursorCreatedAt = filters.cursor?.createdAt ?? null;
    const cursorId = filters.cursor?.id ?? null;

    const rows = await this.db.$queryRaw<AuditRow[]>(
      Prisma.sql`
        WITH audit_with_parent AS (
          SELECT
            al.id, al."createdAt", al."entityType", al."entityId", al.action,
            al."changedById", al.justification, al."correlationId",
            al."oldValues", al."newValues",
            CASE al."entityType"
              WHEN 'sale_details'     THEN COALESCE(al."newValues"->>'saleId',         al."oldValues"->>'saleId')
              WHEN 'purchase_details' THEN COALESCE(al."newValues"->>'purchaseId',     al."oldValues"->>'purchaseId')
              WHEN 'journal_lines'    THEN COALESCE(al."newValues"->>'journalEntryId', al."oldValues"->>'journalEntryId')
              ELSE al."entityId"
            END AS "parentEntityId",
            CASE al."entityType"
              WHEN 'sale_details'     THEN 'sales'
              WHEN 'purchase_details' THEN 'purchases'
              WHEN 'journal_lines'    THEN 'journal_entries'
              ELSE al."entityType"
            END AS "parentEntityType"
          FROM audit_logs al
          WHERE al."organizationId" = ${orgId}
            AND al."createdAt" >= ${filters.dateFrom}
            AND al."createdAt" <= ${filters.dateTo}
            AND (${entityTypeParam}::text IS NULL OR al."entityType"  = ${entityTypeParam}::text)
            AND (${changedByIdParam}::text IS NULL OR al."changedById" = ${changedByIdParam}::text)
            AND (${actionParam}::text IS NULL OR al.action = ${actionParam}::text)
        )
        SELECT
          awp.id, awp."createdAt", awp."entityType", awp."entityId", awp.action,
          awp."changedById", awp.justification, awp."correlationId",
          awp."oldValues", awp."newValues",
          awp."parentEntityId", awp."parentEntityType",
          je."sourceType" AS "parentSourceType"
        FROM audit_with_parent awp
        LEFT JOIN journal_entries je
          ON awp."parentEntityType" = 'journal_entries'
         AND awp."parentEntityId"   = je.id
        WHERE (
          ${cursorCreatedAt}::timestamptz IS NULL
          OR awp."createdAt" <  ${cursorCreatedAt}::timestamptz
          OR (awp."createdAt" = ${cursorCreatedAt}::timestamptz AND awp.id < ${cursorId}::text)
        )
        ORDER BY awp."createdAt" DESC, awp.id DESC
        LIMIT ${fetchLimit}::int
      `,
    );

    let nextCursor: AuditCursor | null = null;
    if (rows.length > limit) {
      const last = rows[limit - 1];
      nextCursor = { createdAt: last.createdAt.toISOString(), id: last.id };
      rows.length = limit;
    }
    return { rows, nextCursor };
  }

  async getVoucherHistory(
    organizationId: string,
    parentVoucherType: AuditEntityType,
    parentVoucherId: string,
  ): Promise<AuditRow[]> {
    const orgId = this.requireOrg(organizationId);
    return this.db.$queryRaw<AuditRow[]>(
      Prisma.sql`
        WITH audit_with_parent AS (
          SELECT
            al.id, al."createdAt", al."entityType", al."entityId", al.action,
            al."changedById", al.justification, al."correlationId",
            al."oldValues", al."newValues",
            CASE al."entityType"
              WHEN 'sale_details'     THEN COALESCE(al."newValues"->>'saleId',         al."oldValues"->>'saleId')
              WHEN 'purchase_details' THEN COALESCE(al."newValues"->>'purchaseId',     al."oldValues"->>'purchaseId')
              WHEN 'journal_lines'    THEN COALESCE(al."newValues"->>'journalEntryId', al."oldValues"->>'journalEntryId')
              ELSE al."entityId"
            END AS "parentEntityId",
            CASE al."entityType"
              WHEN 'sale_details'     THEN 'sales'
              WHEN 'purchase_details' THEN 'purchases'
              WHEN 'journal_lines'    THEN 'journal_entries'
              ELSE al."entityType"
            END AS "parentEntityType"
          FROM audit_logs al
          WHERE al."organizationId" = ${orgId}
        )
        SELECT
          awp.id, awp."createdAt", awp."entityType", awp."entityId", awp.action,
          awp."changedById", awp.justification, awp."correlationId",
          awp."oldValues", awp."newValues",
          awp."parentEntityId", awp."parentEntityType",
          je."sourceType" AS "parentSourceType"
        FROM audit_with_parent awp
        LEFT JOIN journal_entries je
          ON awp."parentEntityType" = 'journal_entries'
         AND awp."parentEntityId"   = je.id
        WHERE awp."parentEntityType" = ${parentVoucherType}::text
          AND awp."parentEntityId"   = ${parentVoucherId}::text
        ORDER BY awp."createdAt" ASC, awp.id ASC
      `,
    );
  }
}
