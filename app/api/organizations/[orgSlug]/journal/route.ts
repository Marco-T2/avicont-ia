import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { UsersService } from "@/features/users/server";
import { JournalService } from "@/features/accounting/server";
import {
  createJournalEntrySchema,
  journalFiltersSchema,
} from "@/features/accounting/server";
import { makeJournalsService } from "@/modules/accounting/presentation/composition-root";

const usersService = new UsersService();
// Legacy `service` retained for GET (`list` not migrated in C3-D).
const service = new JournalService();
const journalsService = makeJournalsService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("journal", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const filters = journalFiltersSchema.parse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      periodId: searchParams.get("periodId") ?? undefined,
      voucherTypeId: searchParams.get("voucherTypeId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const entries = await service.list(orgId, filters);

    return Response.json(entries);
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
    const { session, orgId, role } = await requirePermission(
      "journal",
      "write",
      orgSlug,
    );
    const clerkUserId = session.userId;

    const body = await request.json();
    const { postImmediately, ...rest } = body;
    const input = createJournalEntrySchema.parse(rest);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const journal = postImmediately
      ? (
          await journalsService.createAndPost(
            orgId,
            { ...input, createdById: user.id },
            { userId: user.id, role },
          )
        ).journal
      : await journalsService.createEntry(
          orgId,
          { ...input, createdById: user.id },
          { userId: user.id },
        );

    return Response.json(journal.toSnapshot(), { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
