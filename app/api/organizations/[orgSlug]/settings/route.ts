import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { OrgSettingsService } from "@/features/org-settings/server";
import { updateOrgSettingsSchema } from "@/features/org-settings";

const orgSettingsService = new OrgSettingsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

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
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const body = await request.json();
    const input = updateOrgSettingsSchema.parse(body);

    const settings = await orgSettingsService.update(orgId, input);

    return Response.json(settings);
  } catch (error) {
    return handleError(error);
  }
}
