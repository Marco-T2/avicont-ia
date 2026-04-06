import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { MonthlyCloseService } from "@/features/monthly-close";
import { UsersService } from "@/features/shared/users.service";

const service = new MonthlyCloseService();
const usersService = new UsersService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin"]);

    const { periodId } = await request.json();
    const user = await usersService.resolveByClerkId(userId);
    const result = await service.close(orgId, periodId, user.id);

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
