import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";

const service = new IvaBooksService();

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
 * - 404: entrada no encontrada
 */
export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; id: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, id } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const entry = await service.voidSale(orgId, userId, id);

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}
