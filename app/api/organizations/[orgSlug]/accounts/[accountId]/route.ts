import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { AccountsService } from "@/features/accounting/server";
import { updateAccountSchema } from "@/features/accounting/server";

const service = new AccountsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; accountId: string }> },
) {
  try {
    const { orgSlug, accountId } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

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
    const { orgSlug, accountId } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

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
    const { orgSlug, accountId } = await params;
    const { orgId } = await requirePermission("accounting-config", "write", orgSlug);

    const account = await service.deactivate(orgId, accountId);

    return Response.json(account);
  } catch (error) {
    return handleError(error);
  }
}
