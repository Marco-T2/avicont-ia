import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { UsersService } from "@/features/shared/users.service";
import { JournalService } from "@/features/accounting";
import { updateJournalEntrySchema } from "@/features/accounting/accounting.validation";

const usersService = new UsersService();
const service = new JournalService();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ orgSlug: string; entryId: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug, entryId } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["admin", "contador"]);

    const entry = await service.getById(orgId, entryId);

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; entryId: string }> },
) {
  try {
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug, entryId } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    await requireRole(clerkUserId, orgId, ["admin", "contador"]);

    const body = await request.json();
    const input = updateJournalEntrySchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const entry = await service.updateEntry(orgId, entryId, {
      ...input,
      updatedById: user.id,
    });

    return Response.json(entry);
  } catch (error) {
    return handleError(error);
  }
}
