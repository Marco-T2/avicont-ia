import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeIvaBookService } from "@/modules/iva-books/presentation/composition-root";

const service = makeIvaBookService();

/**
 * PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/void
 *
 * Anula explícitamente una entrada del Libro de Compras IVA (status → VOIDED).
 * Solo modifica `status` — compras NO tienen estadoSIN.
 *
 * Respuestas:
 * - 200: IvaPurchaseBookDTO con status = VOIDED
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org
 * - 404: entrada no encontrada (hex `IvaBookNotFound`)
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

    const result = await service.voidPurchase({ organizationId: orgId, userId, id });

    return Response.json(result.entry);
  } catch (error) {
    return handleError(error);
  }
}
