import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { UsersService } from "@/features/shared/users.service";
import { JournalService } from "@/features/accounting";
import { updateJournalEntrySchema } from "@/features/accounting/accounting.validation";
import { formatCorrelativeNumber } from "@/features/accounting/correlative.utils";

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
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

    const entry = await service.getById(orgId, entryId);

    const displayNumber = formatCorrelativeNumber(
      entry.voucherType.prefix,
      entry.date,
      entry.number,
    );

    return Response.json({ ...entry, displayNumber });
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
    const member = await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const { justification, ...rest } = body;
    const input = updateJournalEntrySchema.parse(rest);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const entry = await service.updateEntry(orgId, entryId, {
      ...input,
      updatedById: user.id,
    }, member.role, justification);

    const displayNumber = formatCorrelativeNumber(
      entry.voucherType.prefix,
      entry.date,
      entry.number,
    );

    return Response.json({ ...entry, displayNumber });
  } catch (error) {
    return handleError(error);
  }
}
