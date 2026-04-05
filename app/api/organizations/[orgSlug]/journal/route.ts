import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { UsersService } from "@/features/shared/users.service";
import { JournalService } from "@/features/accounting";
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
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["owner", "admin", "contador"]);

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
    const { userId: clerkUserId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(clerkUserId, orgSlug);
    await requireRole(clerkUserId, orgId, ["owner", "admin", "contador"]);

    const body = await request.json();
    const input = createJournalEntrySchema.parse(body);

    const user = await usersService.resolveByClerkId(clerkUserId);

    const entry = await service.createEntry(orgId, {
      ...input,
      createdById: user.id,
    });

    const displayNumber = formatCorrelativeNumber(
      entry.voucherType.code,
      entry.date,
      entry.number,
    );

    return Response.json({ ...entry, displayNumber }, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
