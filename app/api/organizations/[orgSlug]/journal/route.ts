import {
  requireAuth,
  requireOrgAccess,
  requireRole,
  handleError,
} from "@/features/shared/middleware";
import { JournalService } from "@/features/accounting";
import {
  createJournalEntrySchema,
  journalFiltersSchema,
} from "@/features/accounting/accounting.validation";
import { prisma } from "@/lib/prisma";

const service = new JournalService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { userId } = await requireAuth();
    const { orgSlug } = await params;
    const orgId = await requireOrgAccess(userId, orgSlug);
    await requireRole(userId, orgId, ["admin", "contador"]);

    const { searchParams } = new URL(request.url);
    const filters = journalFiltersSchema.parse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      voucherType: searchParams.get("voucherType") ?? undefined,
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
    await requireRole(clerkUserId, orgId, ["admin", "contador"]);

    const body = await request.json();
    const input = createJournalEntrySchema.parse(body);

    const user = await prisma.user.findUniqueOrThrow({
      where: { clerkUserId },
      select: { id: true },
    });

    const entry = await service.createEntry(orgId, {
      ...input,
      createdById: user.id,
    });

    return Response.json(entry, { status: 201 });
  } catch (error) {
    return handleError(error);
  }
}
