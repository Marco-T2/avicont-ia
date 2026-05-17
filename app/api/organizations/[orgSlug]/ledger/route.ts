import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeAccountsService,
  makeLedgerService,
  dateRangeSchema,
  exportLedgerPdf,
  exportLedgerXlsx,
} from "@/modules/accounting/presentation/server";
import { ValidationError } from "@/features/shared/errors";
import { parsePaginationParams } from "@/modules/shared/presentation/parse-pagination-params";
import { JournalRepository } from "@/modules/accounting/infrastructure/prisma-journal-entries.repo";
import { fetchLogoAsDataUrl } from "@/modules/accounting/infrastructure/exporters/logo-fetcher";

// Node.js runtime requerido por pdfmake + exceljs (Buffer/streams).
export const runtime = "nodejs";

const service = makeLedgerService();
const accountsService = makeAccountsService();
// Acceso directo al repo SÓLO para getOrgMetadata (paridad con el route
// handler de trial-balance que importa PrismaTrialBalanceRepo del mismo modo
// para el mismo fin). Resto del flujo pasa por services.
const journalRepo = new JournalRepository();

/**
 * pageSize "infinito" para el export — el doc §8 pide TODAS las páginas en
 * el PDF/XLSX, no la actual. La schema de presentation cap a 100 a nivel
 * HTTP, pero el service acepta cualquier int; este path es server-only.
 */
const EXPORT_PAGE_SIZE = 1_000_000;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    const periodId = searchParams.get("periodId") ?? undefined;
    const format = searchParams.get("format") ?? "json";

    // ── PDF / XLSX export branches ──
    // Per doc §8: el PDF/XLSX trae TODAS las filas del rango (NO la página
    // actual). Llamamos getAccountLedgerPaginated con pageSize gigante para
    // obtener TODAS las filas Y el openingBalance acumulado del historial
    // previo al rango (que sólo el camino paginado expone — ver getAccountLedger
    // JSDoc para la asimetría).
    if (format === "pdf" || format === "xlsx") {
      if (!accountId) {
        throw new ValidationError(
          "accountId es requerido para exportar el Libro Mayor",
        );
      }
      const rawDateFrom = searchParams.get("dateFrom");
      const rawDateTo = searchParams.get("dateTo");
      if (!rawDateFrom || !rawDateTo) {
        throw new ValidationError(
          "dateFrom y dateTo son requeridos para exportar el Libro Mayor",
        );
      }

      const dateRange = dateRangeSchema.parse({
        dateFrom: rawDateFrom,
        dateTo: rawDateTo,
      });

      // Para el export usamos `getAccountLedgerPaginated` con pageSize
      // arbitrariamente grande: necesitamos (a) TODAS las filas del rango
      // (doc §8: el PDF/XLSX trae todas las páginas, no la actual) Y (b) el
      // `openingBalance` calculado con cortes históricos previos (acumulado
      // anterior al rango), que sólo el camino paginado expone. La paginated
      // method con page=1+pageSize=EXPORT_PAGE_SIZE es equivalente a una
      // sola página gigante con opening real.
      const [account, ledgerPage, orgMeta] = await Promise.all([
        accountsService.getById(orgId, accountId),
        service.getAccountLedgerPaginated(
          orgId,
          accountId,
          dateRange,
          periodId,
          { page: 1, pageSize: EXPORT_PAGE_SIZE },
        ),
        journalRepo.getOrgMetadata(orgId),
      ]);
      const entries = ledgerPage.items;
      const openingBalance = ledgerPage.openingBalance;

      const periodLabel = `${rawDateFrom}_${rawDateTo}`.replace(
        /[^a-zA-Z0-9_-]/g,
        "-",
      );
      const orgDisplayName = orgMeta?.name ?? orgSlug;

      if (format === "pdf") {
        // Fetch logo solo en path PDF (XLSX no lo embebe). Tolerante a fallas:
        // si la URL es null o el fetch rompe, devuelve undefined y el exporter
        // renderiza sin logo.
        const logoDataUrl = await fetchLogoAsDataUrl(orgMeta?.logoUrl);

        const { buffer } = await exportLedgerPdf(
          entries,
          {
            accountCode: account.code,
            accountName: account.name,
            dateFrom: rawDateFrom,
            dateTo: rawDateTo,
            openingBalance,
            logoDataUrl,
          },
          orgDisplayName,
          orgMeta?.taxId ?? undefined,
          orgMeta?.address ?? undefined,
          orgMeta?.city ?? undefined,
        );
        return new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": "application/pdf",
            // inline → renderiza en pestaña nueva (visor nativo del browser)
            "Content-Disposition": `inline; filename="libro-mayor-${orgSlug}-${periodLabel}.pdf"`,
          },
        });
      }

      // format === "xlsx"
      const buffer = await exportLedgerXlsx(
        entries,
        {
          accountCode: account.code,
          accountName: account.name,
          dateFrom: rawDateFrom,
          dateTo: rawDateTo,
          openingBalance,
        },
        orgDisplayName,
        orgMeta?.taxId ?? undefined,
        orgMeta?.address ?? undefined,
        orgMeta?.city ?? undefined,
      );
      return new Response(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="libro-mayor-${orgSlug}-${periodLabel}.xlsx"`,
        },
      });
    }

    // ── JSON (default) ──
    if (accountId) {
      const dateRange = dateRangeSchema.parse({
        dateFrom: searchParams.get("dateFrom") ?? undefined,
        dateTo: searchParams.get("dateTo") ?? undefined,
      });
      const pagination = parsePaginationParams(searchParams);

      // D-Route LOCKED: always paginated when accountId present, defaults
      // applied per design §4.1. API contract changes from LedgerEntry[] to
      // LedgerPaginatedDto — sole consumer ledger-page-client.tsx rewritten
      // atomic same commit per [[mock_hygiene_commit_scope]].
      const ledger = await service.getAccountLedgerPaginated(
        orgId,
        accountId,
        dateRange,
        periodId,
        pagination,
      );
      return Response.json(ledger);
    }

    if (!periodId) {
      throw new ValidationError("periodId es requerido para el balance de comprobación");
    }

    const trialBalance = await service.getTrialBalance(orgId, periodId);
    return Response.json(trialBalance);
  } catch (error) {
    return handleError(error);
  }
}
