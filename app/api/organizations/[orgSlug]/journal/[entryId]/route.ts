import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/modules/permissions/application/server";
import { UsersService } from "@/modules/users/application/users.service";
import {
  makeJournalsService,
  updateJournalEntrySchema,
  exportVoucherQuerySchema,
} from "@/modules/accounting/presentation/server";

// PDF exporter usa pdfmake (Buffer/streams nativos) — requiere runtime Node.js.
export const runtime = "nodejs";

const usersService = new UsersService();
const journalsService = makeJournalsService();
const service = journalsService;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string; entryId: string }> },
) {
  try {
    const { orgSlug, entryId } = await params;
    const { orgId } = await requirePermission("journal", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const query = exportVoucherQuerySchema.parse({
      format: searchParams.get("format") ?? undefined,
      exchangeRate: searchParams.get("exchangeRate") ?? undefined,
      ufvRate: searchParams.get("ufvRate") ?? undefined,
    });

    if (query.format === "pdf") {
      const buffer = await service.exportVoucherPdf(orgId, entryId, {
        exchangeRate: query.exchangeRate,
        ufvRate: query.ufvRate,
      });
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="comprobante-${entryId}.pdf"`,
        },
      });
    }

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

    const result = await journalsService.updateEntry(
      orgId,
      entryId,
      { ...input, updatedById: user.id },
      { userId: user.id, role, justification },
    );

    return Response.json(result.journal.toSnapshot());
  } catch (error) {
    return handleError(error);
  }
}
