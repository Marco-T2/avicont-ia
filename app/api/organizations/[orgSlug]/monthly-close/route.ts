import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeMonthlyCloseService,
  closeRequestSchema,
} from "@/modules/monthly-close/presentation/server";
import { UsersService } from "@/features/users/server";

const service = makeMonthlyCloseService();
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

    const result = await service.close(
      orgId,
      parsed.periodId,
      user.id,
      parsed.justification,
    );

    return Response.json(result);
  } catch (error) {
    return handleError(error);
  }
}
