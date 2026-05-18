// RBAC-EXCEPTION: Auth-only via requireOrgAccess; farms/lots/expenses/mortality
// NOT in frozen Resource union. Consistent with existing
// /expenses/[expenseId] DELETE and prior /lots/[lotId] PATCH (deactivate).
import { requireAuth, handleError } from "@/features/shared/middleware";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { makeLotService } from "@/modules/lot/presentation/server";
import {
  deactivateLotSchema,
  updateLotSchema,
} from "@/modules/lot/presentation/validation";

const service = makeLotService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; lotId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, lotId } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const summary = await service.getSummary(organizationId, lotId);

    return Response.json(summary);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH dispatches on payload shape (discriminator: presence of
 * `endDate` ↔ deactivate vs `name|barnNumber|farmName` ↔ update).
 * Both share the same route because the previous version
 * (close-only) already lived here; keeping a single endpoint avoids
 * client URL churn (REQ-203, D-4 step 3/3).
 *
 * Body must satisfy ONE of:
 *  - { endDate } → service.deactivate
 *  - { name?, barnNumber?, farmName? } (at least one) → service.update
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; lotId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, lotId } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const body = await request.json();

    if (body && typeof body === "object" && "endDate" in body) {
      const input = deactivateLotSchema.parse(body);
      const lot = await service.deactivate(organizationId, lotId, input);
      return Response.json(lot);
    }

    const input = updateLotSchema.parse(body);
    const lot = await service.update(organizationId, lotId, input);
    return Response.json(lot);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; lotId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, lotId } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    await service.delete(organizationId, lotId);

    return Response.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
