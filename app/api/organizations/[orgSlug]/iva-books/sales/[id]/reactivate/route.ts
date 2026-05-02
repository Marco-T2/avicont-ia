import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeIvaBookService } from "@/modules/iva-books/presentation/composition-root";

const service = makeIvaBookService();

/**
 * PATCH /api/organizations/[orgSlug]/iva-books/sales/[id]/reactivate
 *
 * Reactiva una entrada VOIDED del Libro de Ventas IVA (status → ACTIVE).
 * Regenera el asiento contable CON IVA e IT (buildSaleEntryLines IVA path).
 * CRÍTICO: estadoSIN NO se toca — es un eje ortogonal al lifecycle interno.
 *          `status` (Avicont) y `estadoSIN` (SIN) son independientes por diseño.
 *
 * Respuestas:
 * - 200: IvaSalesBookDTO con status = ACTIVE, estadoSIN intacto
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org o rol insuficiente
 * - 404: entrada no encontrada (hex `IvaBookNotFound`)
 * - 422: la entrada ya está ACTIVE (hex `IvaBookReactivateNonVoided` guard idempotencia, ValidationError)
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { orgSlug, id } = await params;
    const { session, orgId } = await requirePermission(
      "reports",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const result = await service.reactivateSale({
      organizationId: orgId,
      userId,
      id,
    });

    return Response.json(result.entry);
  } catch (error) {
    return handleError(error);
  }
}
