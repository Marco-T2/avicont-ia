import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { AccountsService } from "@/features/accounting";
import { createAccountSchema } from "@/features/accounting/accounting.validation";

const service = new AccountsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const { searchParams } = new URL(request.url);
    const tree = searchParams.get("tree") === "true";

    const accounts = tree
      ? await service.getTree(orgId)
      : await service.list(orgId);

    return Response.json(accounts);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const input = createAccountSchema.parse(body);

    const account = await service.create(orgId, input);

    return Response.json(account, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
