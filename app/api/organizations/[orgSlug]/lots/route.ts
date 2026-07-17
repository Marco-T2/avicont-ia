import { requireAuth, handleError } from "@/modules/shared/presentation/middleware";
import {
  requireOrgAccess,
  makeOrganizationsService,
} from "@/modules/organizations/presentation/server";
import { makeLotService } from "@/modules/lot/presentation/server";
import { createLotSchema } from "@/modules/lot/presentation/validation";

const service = makeLotService();
const orgService = makeOrganizationsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    // REQ-204 / D-8: org-wide flat list. UI client-side filters by
    // farmName (REQ-205); no server-side ?farmId query post-collapse.
    const lots = await service.list(organizationId);

    return Response.json(lots);
  } catch (error) {
    return handleError(error);
  }
}

/**
 * D-2 defense-in-depth: `memberId` is resolved server-side from the
 * Clerk session (NOT accepted in the request body). Prevents a
 * client from creating a lot assigned to another member. REQ-201.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const organizationId = await requireOrgAccess(userId, orgSlug);

    const body = await request.json();
    const input = createLotSchema.parse(body);

    const member = await orgService.getMemberByClerkUserId(
      organizationId,
      userId,
    );

    const lot = await service.create(organizationId, {
      ...input,
      memberId: member.id,
    });

    return Response.json(lot, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
