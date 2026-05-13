import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  InitialBalanceService,
  makeInitialBalanceService,
  initialBalanceQuerySchema,
  exportInitialBalancePdf,
  exportInitialBalanceXlsx,
} from "@/modules/accounting/initial-balance/presentation/server";
import { serializeStatement } from "@/modules/accounting/financial-statements/presentation/server";

// Node.js runtime required by pdfmake + exceljs (Buffer/streams)
export const runtime = "nodejs";

const service = makeInitialBalanceService();

/**
 * GET /api/organizations/[orgSlug]/initial-balance
 *
 * Genera el Balance Inicial para la organización a partir del
 * Comprobante de Apertura (CA) contabilizado.
 *
 * Query params:
 * - format (opcional): "json" | "pdf" | "xlsx" — por defecto "json"
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const query = initialBalanceQuerySchema.parse({
      format: searchParams.get("format") ?? undefined,
    });

    const statement = await service.generate(orgId);

    if (query.format === "pdf") {
      const { buffer } = await exportInitialBalancePdf(statement);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="balance-inicial-${orgSlug}.pdf"`,
        },
      });
    }

    if (query.format === "xlsx") {
      const buffer = await exportInitialBalanceXlsx(statement);
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="balance-inicial-${orgSlug}.xlsx"`,
        },
      });
    }

    return Response.json(serializeStatement(statement));
  } catch (error) {
    return handleError(error);
  }
}
