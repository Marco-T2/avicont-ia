import { handleError } from "@/modules/shared/presentation/middleware";
import { requirePermission } from "@/modules/permissions/application/server";
import { makeUsersService } from "@/modules/users/presentation/composition-root";
import {
  makeJournalsService,
  statusTransitionSchema,
} from "@/modules/accounting/presentation/server";

const usersService = makeUsersService();
const journalsService = makeJournalsService();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; entryId: string }> },
) {
  try {
    const { orgSlug, entryId } = await params;
    const { session, orgId, role } = await requirePermission(
      "journal",
      "write",
      orgSlug,
    );
    const clerkUserId = session.userId;

    const body = await request.json();
    const { status, justification } = statusTransitionSchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const result = await journalsService.transitionStatus(
      orgId,
      entryId,
      status,
      { userId: user.id, role, justification },
    );

    return Response.json(result.journal.toSnapshot());
  } catch (error) {
    return handleError(error);
  }
}
