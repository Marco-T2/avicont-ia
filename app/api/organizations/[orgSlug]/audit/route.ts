import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeAuditService,
  auditListQuerySchema,
  parseCursor,
} from "@/modules/audit/presentation/server";
import {
  AUDIT_DATE_RANGE_INVALID,
  ValidationError,
} from "@/features/shared/errors";
import { endOfMonth, startOfMonth } from "@/lib/date-utils";

/**
 * GET /api/organizations/[orgSlug]/audit
 *
 * Lista paginada de eventos de auditoría agrupados por comprobante (REQ-AUDIT.1).
 *
 * Query params:
 *   - dateFrom / dateTo (ISO): ambos opcionales; si ambos faltan → default mes
 *     en curso (TZ America/La_Paz). Si solo uno falta → 422 AUDIT_DATE_RANGE_INVALID.
 *   - entityType, changedById, action, cursor, limit (todos opcionales).
 *
 * Respuestas:
 *   - 200: { groups: AuditGroup[], nextCursor: AuditCursor | null }
 *   - 400: VALIDATION_ERROR (Zod)
 *   - 401: UnauthorizedError
 *   - 403: FORBIDDEN (rol sin audit:read o user no es miembro del orgSlug)
 *   - 422: AUDIT_DATE_RANGE_INVALID | AUDIT_CURSOR_INVALID
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("audit", "read", orgSlug);

    const url = new URL(request.url);
    const raw = Object.fromEntries(url.searchParams);
    const parsed = auditListQuerySchema.parse(raw);

    // Rango obligatorio: ambos o ninguno. Si solo uno → 422.
    const hasFrom = parsed.dateFrom !== undefined;
    const hasTo = parsed.dateTo !== undefined;
    if (hasFrom !== hasTo) {
      throw new ValidationError(
        "Debe enviar ambos dateFrom y dateTo, o ninguno",
        AUDIT_DATE_RANGE_INVALID,
      );
    }
    if (hasFrom && hasTo && parsed.dateFrom! > parsed.dateTo!) {
      throw new ValidationError(
        "dateFrom no puede ser posterior a dateTo",
        AUDIT_DATE_RANGE_INVALID,
      );
    }

    const now = new Date();
    const filters = {
      dateFrom: parsed.dateFrom ?? startOfMonth(now),
      dateTo: parsed.dateTo ?? endOfMonth(now),
      entityType: parsed.entityType,
      changedById: parsed.changedById,
      action: parsed.action,
      cursor: parsed.cursor ? parseCursor(parsed.cursor) : undefined,
      limit: parsed.limit ?? 50,
    };

    const result = await makeAuditService().listGrouped(orgId, filters);
    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
