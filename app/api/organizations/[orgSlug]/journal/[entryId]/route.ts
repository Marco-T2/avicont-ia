import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { UsersService } from "@/features/shared/users.service";
import { JournalService } from "@/features/accounting/server";
import {
  updateJournalEntrySchema,
  exportVoucherQuerySchema,
} from "@/features/accounting/server";
import { formatCorrelativeNumber } from "@/features/accounting/server";

// PDF exporter usa pdfmake (Buffer/streams nativos) — requiere runtime Node.js.
export const runtime = "nodejs";

const usersService = new UsersService();
const service = new JournalService();

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
