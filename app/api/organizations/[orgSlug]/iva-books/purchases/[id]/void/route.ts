import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { IvaBooksService } from "@/features/accounting/iva-books/iva-books.service";
import { IvaBooksRepository } from "@/features/accounting/iva-books/iva-books.repository";
import { SaleService } from "@/features/sale/sale.service";
import { PurchaseService } from "@/features/purchase/purchase.service";

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
