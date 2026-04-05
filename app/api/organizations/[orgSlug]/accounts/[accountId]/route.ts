import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { AccountsService } from "@/features/accounting";
import { updateAccountSchema } from "@/features/accounting/accounting.validation";

const service = new AccountsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; accountId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, accountId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const account = await service.getById(orgId, accountId);

    return Response.json(account);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; accountId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, accountId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const input = updateAccountSchema.parse(body);

    const account = await service.update(orgId, accountId, input);

    return Response.json(account);
  } catch (error) {
    return handleError(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; accountId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, accountId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const account = await service.deactivate(orgId, accountId);

    return Response.json(account);
  } catch (error) {
    return handleError(error);
  }
}
