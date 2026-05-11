import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeAuditService,
  voucherHistoryParamsSchema,
} from "@/modules/audit/presentation/server";

/**
 * GET /api/organizations/[orgSlug]/audit/[entityType]/[entityId]
 *
 * Timeline completo de un voucher (REQ-AUDIT.2). Sólo acepta los 5 entityType
 * de cabecera — si llega `sale_details` u otro detail entityType responde 400.
 * La UI siempre linkea al detail desde la cabecera (nunca al revés).
 *
 * Respuestas:
 *   - 200: { events: AuditEvent[] } ordenados createdAt ASC, tiebreak id ASC.
 *   - 400: VALIDATION_ERROR (entityType fuera de los 5 permitidos, o entityId vacío).
 *   - 401: UnauthorizedError
 *   - 403: FORBIDDEN
 */
export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ orgSlug: string; entityType: string; entityId: string }>;
  },
) {
  try {
    const raw = await params;
    const { orgId } = await requirePermission("audit", "read", raw.orgSlug);

    const { entityType, entityId } = voucherHistoryParamsSchema.parse(raw);

    const events = await makeAuditService().getVoucherHistory(
      orgId,
      entityType,
      entityId,
    );
    return Response.json({ events });
  } catch (error) {
    return handleError(error);
  }
}
