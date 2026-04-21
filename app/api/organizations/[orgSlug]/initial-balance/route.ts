import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { InitialBalanceService } from "@/features/accounting/initial-balance/initial-balance.service";
import { serializeStatement } from "@/features/accounting/financial-statements/money.utils";
import { initialBalanceQuerySchema } from "@/features/accounting/initial-balance/initial-balance.validation";
import { exportInitialBalancePdf } from "@/features/accounting/initial-balance/exporters/initial-balance-pdf.exporter";
import { exportInitialBalanceXlsx } from "@/features/accounting/initial-balance/exporters/initial-balance-xlsx.exporter";

// Node.js runtime required by pdfmake + exceljs (Buffer/streams)
export const runtime = "nodejs";

const service = new InitialBalanceService();

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
