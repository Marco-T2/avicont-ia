import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { UsersService } from "@/features/shared/users.service";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import { createFiscalPeriodSchema } from "@/features/fiscal-periods";

const usersService = new UsersService();
const service = new FiscalPeriodsService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("accounting-config", "read", orgSlug);

    const periods = await service.list(orgId);

    return Response.json(periods);
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission(
      "period",
      "write",
      orgSlug,
    );
    const clerkUserId = session.userId;

    const body = await request.json();
    const input = createFiscalPeriodSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const period = await service.create(orgId, {
      ...input,
      createdById: user.id,
    });

    return Response.json(period, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
