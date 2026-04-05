import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { DispatchService } from "@/features/dispatch";
import {
  createDispatchSchema,
  dispatchFiltersSchema,
} from "@/features/dispatch";
import { UsersService } from "@/features/shared/users.service";

const dispatchService = new DispatchService();
const usersService = new UsersService();

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
    const filters = dispatchFiltersSchema.parse({
      dispatchType: searchParams.get("dispatchType") ?? undefined,
      status: searchParams.get("status") ?? undefined,
      contactId: searchParams.get("contactId") ?? undefined,
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      periodId: searchParams.get("periodId") ?? undefined,
    });

    const dispatches = await dispatchService.list(orgId, filters);

    return Response.json(dispatches);
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
    const input = createDispatchSchema.parse(body);

    const user = await usersService.resolveByClerkId(userId);
    const dispatch = await dispatchService.create(orgId, { ...input, createdById: user.id });

    return Response.json(dispatch, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
