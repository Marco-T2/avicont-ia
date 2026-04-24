import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { HubService } from "@/features/dispatch/server";
import { SaleService } from "@/features/sale/server";
import { DispatchService } from "@/features/dispatch/server";
import { hubQuerySchema } from "@/features/dispatch/server";

/**
 * Module-level instantiation — same pattern as iva-books/sales/route.ts.
 *
 * HubService uses constructor interface injection (SaleServiceForHub /
 * DispatchServiceForHub). Both real services satisfy the interfaces
 * structurally: totalAmount is typed as MonetaryAmount (Decimal | number | string)
 * and normalised to string inside the mappers — no cast needed.
 */
const hubService = new HubService(
  new SaleService(),
  new DispatchService(),
);

/**
 * GET /api/organizations/[orgSlug]/dispatches-hub
 *
 * Returns merged Sales + Dispatches as a unified HubItem list.
 *
 * Query params:
 * - type?       : "VENTA_GENERAL" | "NOTA_DESPACHO" | "BOLETA_CERRADA"
 * - status?     : "DRAFT" | "POSTED" | "LOCKED" | "VOIDED"
 * - contactId?  : string
 * - periodId?   : string
 * - dateFrom?   : ISO date string
 * - dateTo?     : ISO date string
 * - limit?      : number (default 50, max 200)
 * - offset?     : number (default 0)
 *
 * Responses:
 * - 200: { items: HubItem[]; total: number }
 * - 400: invalid query params (Zod)
 * - 401: unauthenticated
 * - 403: no org access or insufficient role
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("sales", "read", orgSlug);

    const { searchParams } = new URL(request.url);

    // Zod parse — throws ZodError on invalid input (caught by handleError)
    const filters = hubQuerySchema.parse({
      type: searchParams.get("type") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      contactId: searchParams.get("contactId") ?? undefined,
      periodId: searchParams.get("periodId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
      offset: searchParams.get("offset") ?? undefined,
    });

    const result = await hubService.listHub(orgId, filters);

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
