/**
 * GET /api/organizations/[orgSlug]/iva-books/purchases/export
 *
 * Exporta el Libro de Compras IVA como archivo XLSX compatible con la
 * plantilla oficial SIN Bolivia (23 columnas).
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
import { requirePermission } from "@/features/permissions/server";
import { exportIvaBookExcel } from "@/features/accounting/iva-books/server";
import { listQuerySchema } from "@/features/accounting/iva-books";
import { makeIvaBookService } from "@/modules/iva-books/presentation/composition-root";

import { entriesToDto } from "./entity-to-dto";

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

    // POC #11.0c A4-c C2 GREEN cutover hex (P3 mapper bridge lockeada Marco):
    // hex `listPurchasesByPeriod` retorna `IvaPurchaseBookEntry[]` (domain),
    // legacy `exportIvaBookExcel` obliga `IvaPurchaseBookDTO[]` — `entriesToDto`
    // bridge archivo dedicado per route (P3.3 lock).
    const entries = await makeIvaBookService().listPurchasesByPeriod(orgId, query);
    const dtos = entriesToDto(entries);

    // Etiqueta segura para el nombre de archivo (solo alfanumérico y guiones)
    const periodLabel = (query.fiscalPeriodId ?? "sin-periodo")
      .replace(/[^a-zA-Z0-9\-_]/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-|-$/g, "");

    const buffer = await exportIvaBookExcel("purchases", dtos, periodLabel);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="LibroCompras_${periodLabel}.xlsx"`,
      },
    });
  } catch (error) {
    return handleError(error);
  }
}
