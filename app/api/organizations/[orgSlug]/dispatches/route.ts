import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { DispatchService } from "@/features/dispatch/server";
import {
  createDispatchSchema,
  dispatchFiltersSchema,
} from "@/features/dispatch";
import { UsersService } from "@/features/users/server";

const dispatchService = new DispatchService();
const usersService = new UsersService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("dispatches", "read", orgSlug);

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
    const { orgSlug } = await params;
    const { session, orgId } = await requirePermission(
      "dispatches",
      "write",
      orgSlug,
    );
    const userId = session.userId;

    const body = await request.json();
    const { postImmediately, ...rest } = body;
    const input = createDispatchSchema.parse(rest);

    const user = await usersService.resolveByClerkId(userId);
    const dispatch = postImmediately
      ? await dispatchService.createAndPost(orgId, { ...input, createdById: user.id }, user.id)
      : await dispatchService.create(orgId, { ...input, createdById: user.id });

    return Response.json(dispatch, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
