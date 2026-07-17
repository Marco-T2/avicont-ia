// RBAC-EXCEPTION: Auth-only via requireOrgAccess; farms/lots/expenses/mortality
// NOT in frozen Resource union. Consistent with sibling mortality + lots routes.
import { requireAuth, handleError } from "@/modules/shared/presentation/middleware";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import {
  makeMortalityService,
  updateMortalitySchema,
  mortalityLogIdSchema,
} from "@/modules/mortality/presentation/server";

const service = makeMortalityService();

/**
 * Updates count/cause/date of an existing MortalityLog. Service
 * recomputes `aliveCountForUpdate = lot.initialCount - (totalAllLogs
 * - oldLogCount)` and rejects with MortalityCountExceedsAlive when
 * the new count breaks INV-01. Spec REQ-105.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; logId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, logId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    mortalityLogIdSchema.parse(logId);

    const body = await request.json();
    const input = updateMortalitySchema.parse(body);

    const updated = await service.update(orgId, logId, input);

    return Response.json(updated.toJSON());
  } catch (error) {
    return handleError(error);
  }
}

/**
 * Hard-deletes the log. Throws MortalityNotFound if id missing.
 * Lot.aliveCount recovers naturally on the next read (getSummary
 * recomputes from remaining logs). Spec REQ-106.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; logId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, logId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    mortalityLogIdSchema.parse(logId);

    await service.delete(orgId, logId);

    return Response.json({ success: true });
  } catch (error) {
    return handleError(error);
  }
}
