import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { OrgSettingsService } from "@/features/org-settings";
import { updateOrgSettingsSchema } from "@/features/org-settings";

const orgSettingsService = new OrgSettingsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin"]);

    const settings = await orgSettingsService.getOrCreate(orgId);

    return Response.json(settings);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin"]);

    const body = await request.json();
    const input = updateOrgSettingsSchema.parse(body);

    const settings = await orgSettingsService.update(orgId, input);

    return Response.json(settings);
  } catch (error) {
    return handleError(error);
  }
}
