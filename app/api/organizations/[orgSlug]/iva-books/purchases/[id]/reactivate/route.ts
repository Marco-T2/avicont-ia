import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
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
 * PATCH /api/organizations/[orgSlug]/iva-books/purchases/[id]/reactivate
 *
 * Reactiva una entrada VOIDED del Libro de Compras IVA (status → ACTIVE).
 * Regenera el asiento contable CON IVA e IT (buildPurchaseEntryLines IVA path).
 *
 * Respuestas:
 * - 200: IvaPurchaseBookDTO con status = ACTIVE
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org o rol insuficiente
 * - 404: entrada no encontrada
 * - 409: la entrada ya está ACTIVE (guard idempotencia)
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

    const entry = await service.reactivatePurchase(orgId, userId, id);

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}
