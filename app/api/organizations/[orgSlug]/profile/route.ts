import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { OrgProfileService } from "@/features/org-profile/server";
import { updateOrgProfileSchema } from "@/features/org-profile";

const orgProfileService = new OrgProfileService();

/**
 * GET /api/organizations/[orgSlug]/profile
 *
 * Returns the OrgProfile row (lazy getOrCreate — first call inserts an
 * all-defaults row). REQ-OP.1, REQ-OP.6.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission(
      "accounting-config",
      "write",
      orgSlug,
    );

    const profile = await orgProfileService.getOrCreate(orgId);
    return Response.json(profile);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * PATCH /api/organizations/[orgSlug]/profile
 *
 * Partial update — only fields present in the body are written.
 * REQ-OP.1, REQ-OP.2, REQ-OP.6, REQ-OP.7.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission(
      "accounting-config",
      "write",
      orgSlug,
    );

    const body = await request.json();
    const input = updateOrgProfileSchema.parse(body);

    const profile = await orgProfileService.update(orgId, input);
    return Response.json(profile);
  } catch (error) {
    return handleError(error);
  }
}
