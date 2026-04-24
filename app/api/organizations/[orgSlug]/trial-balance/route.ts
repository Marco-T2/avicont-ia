import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import { TrialBalanceService, TrialBalanceRepository } from "@/features/accounting/trial-balance/server";
import { serializeStatement } from "@/features/accounting/financial-statements/server";
import { trialBalanceQuerySchema } from "@/features/accounting/trial-balance/server";
import { exportTrialBalancePdf } from "@/features/accounting/trial-balance/server";
import { exportTrialBalanceXlsx } from "@/features/accounting/trial-balance/server";
import type { Role } from "@/features/permissions";

// Node.js runtime required by pdfmake + exceljs (Buffer/streams)
export const runtime = "nodejs";

const service = new TrialBalanceService();
const repo = new TrialBalanceRepository();

/**
 * GET /api/organizations/[orgSlug]/trial-balance
 *
 * Genera el Balance de Comprobación de Sumas y Saldos para un rango de fechas.
 *
 * Query params:
 * - dateFrom (YYYY-MM-DD): requerido
 * - dateTo   (YYYY-MM-DD): requerido
 * - format (opcional): "json" | "pdf" | "xlsx" — por defecto "json"
 *
 * Respuestas:
 * - 200: Reporte serializado (Decimals como strings en JSON; Buffer en PDF/XLSX)
 * - 400: Params inválidos (Zod) o formato no soportado
 * - 401: Sin sesión Clerk
 * - 403: Rol no permitido (viewer / member)
 * - 500: Error interno
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    // 1. Auth + RBAC gate — orgId always from session (C10.E1)
    const { orgSlug } = await params;
    const { orgId, role } = await requirePermission("reports", "read", orgSlug);
    const userRole = role as Role;

    // 2. Validate query params
    const { searchParams } = new URL(request.url);
    const query = trialBalanceQuerySchema.parse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
      format: searchParams.get("format") ?? undefined,
    });

    // 3. Generate report (service performs RBAC double-check)
    const report = await service.generate(orgId, userRole, {
      dateFrom: new Date(query.dateFrom),
      dateTo: new Date(query.dateTo),
    });

    // 4. Build period label for filenames
    const periodLabel = `${query.dateFrom}_${query.dateTo}`.replace(
      /[^a-zA-Z0-9_-]/g,
      "-",
    );

    // 5. PDF response
    if (query.format === "pdf") {
      const orgMeta = await repo.getOrgMetadata(orgId);
      const orgDisplayName = orgMeta?.name ?? orgSlug;
      const { buffer } = await exportTrialBalancePdf(
        report,
        orgDisplayName,
        orgMeta?.taxId ?? undefined,
        orgMeta?.address ?? undefined,
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="sumas-y-saldos-${orgSlug}-${periodLabel}.pdf"`,
        },
      });
    }

    // 6. XLSX response
    if (query.format === "xlsx") {
      const orgMeta = await repo.getOrgMetadata(orgId);
      const orgDisplayName = orgMeta?.name ?? orgSlug;
      const buffer = await exportTrialBalanceXlsx(
        report,
        orgDisplayName,
        orgMeta?.taxId ?? undefined,
        orgMeta?.address ?? undefined,
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="sumas-y-saldos-${orgSlug}-${periodLabel}.xlsx"`,
        },
      });
    }

    // 7. JSON response (default)
    return Response.json(serializeStatement(report));
  } catch (error) {
    return handleError(error);
  }
}
