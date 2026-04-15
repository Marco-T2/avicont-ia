import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";

const service = new IvaBooksService();

/**
 * PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/void
 *
 * Anula explícitamente una entrada del Libro de Compras IVA (status → VOIDED).
 * Solo modifica `status` — compras no tienen estadoSIN.
 *
 * Respuestas:
 * - 200: IvaPurchaseBookDTO con status = VOIDED
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

    const entry = await service.voidPurchase(orgId, userId, id);

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}
