import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { UsersService } from "@/features/shared/users.service";
import { JournalService } from "@/features/accounting/server";
import {
  createJournalEntrySchema,
  journalFiltersSchema,
} from "@/features/accounting/accounting.validation";
import { formatCorrelativeNumber } from "@/features/accounting/correlative.utils";

const usersService = new UsersService();
const service = new JournalService();

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

    const entry = postImmediately
      ? await service.createAndPost(
          orgId,
          { ...input, createdById: user.id },
          { userId: user.id, role },
        )
      : await service.createEntry(orgId, { ...input, createdById: user.id });

    const displayNumber = formatCorrelativeNumber(
      entry.voucherType.prefix,
      entry.date,
      entry.number,
    );

    return Response.json({ ...entry, displayNumber }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
