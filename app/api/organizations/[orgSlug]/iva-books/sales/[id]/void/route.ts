import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { makeIvaBookService } from "@/modules/iva-books/presentation/composition-root";

const service = makeIvaBookService();

/**
 * PATCH /api/organizations/[orgSlug]/iva-books/sales/[id]/void
 *
 * Anula explícitamente una entrada del Libro de Ventas IVA (status → VOIDED).
 * CRÍTICO: estadoSIN NO se toca — es un eje ortogonal al lifecycle interno.
 *          `status` (Avicont) y `estadoSIN` (SIN) son independientes por diseño.
 *
 * Respuestas:
 * - 200: IvaSalesBookDTO con status = VOIDED, estadoSIN intacto
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

    const result = await service.voidSale({ organizationId: orgId, userId, id });

    return Response.json(result.entry);
  } catch (error) {
    return handleError(error);
  }
}
