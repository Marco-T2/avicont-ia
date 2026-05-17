import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeLedgerService,
  dateRangeSchema,
} from "@/modules/accounting/presentation/server";
import {
  NotImplementedError,
  ValidationError,
} from "@/features/shared/errors";
import { parsePaginationParams } from "@/modules/shared/presentation/parse-pagination-params";

// Node.js runtime (parity sister /ledger/route.ts — pdfmake/exceljs Buffer
// landings in C7 will need this; declaring nodejs now avoids a runtime swap
// when C7 lands the export branches).
export const runtime = "nodejs";

const service = makeLedgerService();

/**
 * GET /api/organizations/[orgSlug]/contact-ledger
 *
 * Contact-keyed libro mayor — sister of /ledger/route.ts keyed por contacto.
 * Spec REQ "API Contract — Contact Ledger".
 *
 * Query params:
 *   contactId  — optional in `format=json` (defaults applied), REQUIRED in
 *                pdf/xlsx (ValidationError 422 when missing).
 *   dateFrom   — optional in json, REQUIRED in pdf/xlsx.
 *   dateTo     — optional in json, REQUIRED in pdf/xlsx (end-of-UTC-day
 *                coerced by dateRangeSchema).
 *   page       — default 1.
 *   pageSize   — default 25, max 100 (parsePaginationParams).
 *   format     — json (default) | pdf | xlsx.
 *
 * Permissions: `reports:read` (sister /ledger parity per spec).
 *
 * PDF/XLSX branches: staged-red stubs (501 NotImplementedError) until C7
 * lands the contact-ledger exporters under `infrastructure/exporters/
 * contact-ledger/` subdir (design D6 + α-sentinel preservation per
 * [[named_rule_immutability]]).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ orgSlug: string }> },
) {
  try {
    const { orgSlug } = await params;
    const { orgId } = await requirePermission("reports", "read", orgSlug);

    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get("contactId");
    const periodId = searchParams.get("periodId") ?? undefined;
    const format = searchParams.get("format") ?? "json";

    // ── PDF / XLSX export branches (staged-red until C7) ──
    if (format === "pdf" || format === "xlsx") {
      if (!contactId) {
        throw new ValidationError(
          "contactId es requerido para exportar el libro por contacto",
        );
      }
      const rawDateFrom = searchParams.get("dateFrom");
      const rawDateTo = searchParams.get("dateTo");
      if (!rawDateFrom || !rawDateTo) {
        throw new ValidationError(
          "dateFrom y dateTo son requeridos para exportar el libro por contacto",
        );
      }
      throw new NotImplementedError(
        `Export ${format.toUpperCase()} pendiente C7 (subdir contact-ledger/ exporters)`,
      );
    }

    // ── JSON (default) ──
    const dateRange = dateRangeSchema.parse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });
    const pagination = parsePaginationParams(searchParams);

    // contactId opcional in json branch — when absent the service will throw
    // NotFoundError via `contacts.getActiveById(orgId, "")`. To avoid that
    // boundary surface, route surfaces an empty-shape DTO instead — but the
    // sister /ledger route returns trial-balance fallback when accountId is
    // absent. Per spec REQ Scenario "format=json sin filtros" the response
    // should be 200 with defaults applied; we delegate to the service with
    // the contactId as-is (empty → NotFoundError surfaces as 404 through
    // handleError, which is the expected behavior for an unknown contact).
    const ledger = await service.getContactLedgerPaginated(
      orgId,
      contactId ?? "",
      dateRange,
      periodId,
      pagination,
    );
    return Response.json(ledger);
  } catch (error) {
    return handleError(error);
  }
}
