/**
 * GET /api/organizations/[orgSlug]/iva-books/sales/export
 *
 * Exporta el Libro de Ventas IVA como archivo XLSX compatible con la
 * plantilla oficial SIN Bolivia (24 columnas).
 *
 * Query params:
 * - periodId (requerido): ID del período fiscal a exportar
 * - status (opcional): ACTIVE | VOIDED — por defecto solo ACTIVE
 *
 * Respuestas:
 * - 200: Buffer XLSX con Content-Disposition attachment
 * - 400: periodId faltante
 * - 401: sin sesión Clerk
 * - 403: sin acceso a la org o rol insuficiente
 * - 500: error interno
 *
 * IMPORTANTE: runtime = "nodejs" — exceljs usa Buffer/streams nativos
 * y NO funciona en Edge runtime.
 */

// Node.js runtime: exceljs requiere Buffer/streams — NO Edge compatible
export const runtime = "nodejs";

import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/shared/permissions.server";
import { IvaBooksService, exportIvaBookExcel } from "@/features/accounting/iva-books/server";
import { listQuerySchema } from "@/features/accounting/iva-books";

const service = new IvaBooksService();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const query = listQuerySchema.parse({
      fiscalPeriodId: searchParams.get("periodId") ?? searchParams.get("fiscalPeriodId") ?? undefined,
      status: searchParams.get("status") ?? undefined,
    });

    const entries = await service.listSalesByPeriod(orgId, query);

    // Etiqueta segura para el nombre de archivo (solo alfanumérico y guiones)
    const periodLabel = (query.fiscalPeriodId ?? "sin-periodo")
      .replace(/[^a-zA-Z0-9\-_]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "");

    const buffer = await exportIvaBookExcel("sales", entries, periodLabel);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="LibroVentas_${periodLabel}.xlsx"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
