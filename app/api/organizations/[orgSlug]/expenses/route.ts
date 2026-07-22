import { requireAuth, handleError } from "@/modules/shared/presentation/middleware";
import { requireOrgAccess } from "@/modules/organizations/presentation/server";
import { makeUsersService } from "@/modules/users/presentation/composition-root";
import {
  makeExpenseService,
  createExpenseSchema,
} from "@/modules/expense/presentation/server";

const usersService = makeUsersService();
const service = makeExpenseService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    const { searchParams } = new URL(request.url);
    const lotId = searchParams.get("lotId") ?? undefined;

    const entities = lotId
      ? await service.listByLot(orgId, lotId)
      : await service.list(orgId);

    return Response.json(entities.map((e) => e.toSnapshot()));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);

    const body = await request.json();
    const input = createExpenseSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const expense = await service.create(orgId, {
      ...input,
      createdById: user.id,
    });

    return Response.json(expense.toSnapshot(), { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
