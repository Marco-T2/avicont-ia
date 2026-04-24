import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { IvaBooksService, IvaBooksRepository } from "@/features/accounting/iva-books/server";
import { SaleService } from "@/features/sale/server";
import { PurchaseService } from "@/features/purchase/server";

const service = new IvaBooksService(
  new IvaBooksRepository(),
  new SaleService(),
  new PurchaseService(),
);

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
    const { orgSlug, id } = await params;
    const { session, orgId } = await requirePermission(
      "reports",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const entry = await service.voidPurchase(orgId, userId, id);

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}
