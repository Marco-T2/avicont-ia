import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { BaseRepository } from "@/features/shared/base.repository";
import type {
  AuditAction,
  AuditCursor,
  AuditEntityType,
  AuditListFilters,
} from "./audit.types";

/**
 * Forma cruda emitida por los queries del repository. El service la consume y
 * la enriquece con `classification` + display names antes de devolver a la UI.
 */
export interface AuditRow {
  id: string;
  createdAt: Date;
  entityType: AuditEntityType;
  entityId: string;
  action: AuditAction;
  changedById: string | null;
  justification: string | null;
  correlationId: string | null;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
  /** Tipo del voucher lógico — mismo que entityType para cabeceras; mapeado para detail rows. */
  parentEntityType: AuditEntityType;
  /** Id del voucher lógico — mismo que entityId para cabeceras; resuelto desde JSONB FK para detail rows. */
  parentEntityId: string;
  /** sourceType del padre si el parent es journal_entries; null en el resto de casos. */
  parentSourceType: string | null;
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export class AuditRepository extends BaseRepository {
  /**
   * Lista paginada agrupada por voucher lógico. Devuelve rows crudas ordenadas
   * createdAt DESC, id DESC. El cursor se devuelve cuando hay > limit rows.
   */
  async listFlat(
    organizationId: string,
    filters: AuditListFilters,
  ): Promise<{ rows: AuditRow[]; nextCursor: AuditCursor | null }> {
    const limit = Math.min(filters.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const fetchLimit = limit + 1;

    const entityTypeParam = filters.entityType ?? null;
    const changedByIdParam = filters.changedById ?? null;
    const actionParam = filters.action ?? null;
    const cursorCreatedAt = filters.cursor?.createdAt ?? null;
    const cursorId = filters.cursor?.id ?? null;

    const rows = await this.scopedQueryRaw<AuditRow>(
      organizationId,
      (orgId) => Prisma.sql`
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

  /**
   * Timeline completo de un voucher — cabecera + detail rows (resueltas por
   * JSONB FK). Orden createdAt ASC con tiebreak id ASC. Sin paginación: la
   * cardinalidad es acotada (1 cabecera + N líneas × M ediciones).
   */
  async getVoucherHistory(
    organizationId: string,
    parentVoucherType: AuditEntityType,
    parentVoucherId: string,
  ): Promise<AuditRow[]> {
    return this.scopedQueryRaw<AuditRow>(
      organizationId,
      (orgId) => Prisma.sql`
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

  /**
   * Wrapper interno — el único punto del módulo donde aparece `$queryRaw`.
   *
   * Garantías:
   *   1. `requireOrg()` lanza si `organizationId` es vacío (BaseRepository).
   *   2. El builder recibe el orgId ya validado y lo debe usar como primer
   *      `${}` dentro del `Prisma.sql` — binding automático via tagged template.
   *
   * El feature-boundaries.test.ts verifica por grep que no exista ningún
   * `$queryRaw` en features/audit/ fuera de este método.
   */
  protected async scopedQueryRaw<T>(
    organizationId: string,
    builder: (orgId: string) => Prisma.Sql,
  ): Promise<T[]> {
    const scope = this.requireOrg(organizationId);
    const sql = builder(scope.organizationId);
    return this.db.$queryRaw<T[]>(sql);
  }
}
