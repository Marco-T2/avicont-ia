import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { MonthlyCloseService } from "@/features/monthly-close/server";
import { UsersService } from "@/features/shared/users.service";
import { closeRequestSchema } from "@/features/monthly-close/monthly-close.validation";

const service = new MonthlyCloseService();
const usersService = new UsersService();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission("period", "close", orgSlug);

    const body = await request.json();
    const parsed = closeRequestSchema.parse(body); // throws ZodError → handleError maps to 400

    const user = await usersService.resolveByClerkId(session.userId);

    const result = await service.close({
      organizationId: orgId,
      periodId: parsed.periodId,
      userId: user.id,
      justification: parsed.justification,
    });

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
