import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { MonthlyCloseService } from "@/features/monthly-close/server";
import { UsersService } from "@/features/shared/users.service";

const service = new MonthlyCloseService();
const usersService = new UsersService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission(
      "period",
      "close",
      orgSlug,
    );
    const userId = session.userId;

    const { periodId } = await request.json();
    const user = await usersService.resolveByClerkId(userId);
    const result = await service.close(orgId, periodId, user.id);

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
