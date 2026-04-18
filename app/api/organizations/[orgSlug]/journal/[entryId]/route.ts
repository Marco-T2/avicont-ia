import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
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
    const { orgSlug, entryId } = await params;
    const { orgId } = await requirePermission("journal", "read", orgSlug);

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
    const { orgSlug, entryId } = await params;
    const { session, orgId, role } = await requirePermission(
      "journal",
      "write",
      orgSlug,
    );
    const clerkUserId = session.userId;

    const body = await request.json();
    const { justification, ...rest } = body;
    const input = updateJournalEntrySchema.parse(rest);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const entry = await service.updateEntry(orgId, entryId, {
      ...input,
      updatedById: user.id,
    }, role, justification);

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
