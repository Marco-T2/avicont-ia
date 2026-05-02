import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeIvaBookService } from "@/modules/iva-books/presentation/composition-root";

const service = makeIvaBookService();

/**
 * PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate
 *
 * Reactiva una entrada VOIDED del Libro de Compras IVA (status → ACTIVE).
 * Regenera el asiento contable CON IVA e IT (buildPurchaseEntryLines IVA path).
 *
 * Respuestas:
 * - 200: IvaPurchaseBookDTO con status = ACTIVE
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

    const result = await service.reactivatePurchase({
      organizationId: orgId,
      userId,
      id,
    });

    return Response.json(result.entry);
  } catch (error) {
    return handleError(error);
  }
}
