import { handleError } from "@/features/shared/middleware";
import { requirePermission } from "@/features/permissions/server";
import {
  makeLedgerService,
  dateRangeSchema,
  exportContactLedgerPdf,
  exportContactLedgerXlsx,
} from "@/modules/accounting/presentation/server";
import { ValidationError } from "@/features/shared/errors";
import { parsePaginationParams } from "@/modules/shared/presentation/parse-pagination-params";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import { JournalRepository } from "@/modules/accounting/infrastructure/prisma-journal-entries.repo";
import { fetchLogoAsDataUrl } from "@/modules/accounting/infrastructure/exporters/logo-fetcher";

// Node.js runtime (parity sister /ledger/route.ts — pdfmake/exceljs Buffer
// landings necesitan Buffer/streams).
export const runtime = "nodejs";

const service = makeLedgerService();
const contactsService = makeContactsService();
// Acceso directo al repo SÓLO para getOrgMetadata (paridad sister /ledger/route.ts).
// Resto del flujo pasa por services.
const journalRepo = new JournalRepository();

/**
 * pageSize "infinito" para el export — paridad sister /ledger/route.ts:
 * el PDF/XLSX trae TODAS las filas del rango (NO la página actual). El
 * service acepta cualquier int; este path es server-only.
 */
const EXPORT_PAGE_SIZE = 1_000_000;

/**
 * GET /api/organizations/[orgSlug]/contact-ledger
 *
 * Contact-keyed libro mayor — sister of /ledger/route.ts keyed por contacto.
 * Spec REQ "API Contract — Contact Ledger" + "PDF Export" + "XLSX Export".
 *
 * Query params:
 *   contactId  — optional en `format=json` (defaults aplicados), REQUIRED en
 *                pdf/xlsx (ValidationError 422 cuando missing).
 *   dateFrom   — optional en json, REQUIRED en pdf/xlsx.
 *   dateTo     — optional en json, REQUIRED en pdf/xlsx (end-of-UTC-day
 *                coerced por dateRangeSchema).
 *   page       — default 1.
 *   pageSize   — default 25, max 100 (parsePaginationParams).
 *   format     — json (default) | pdf | xlsx.
 *
 * Permissions: `reports:read` (sister /ledger parity per spec).
 *
 * PDF response: `inline` Content-Disposition (renderiza en pestaña nueva).
 * XLSX response: `attachment` Content-Disposition con filename incluyendo
 *                slug del contacto y rango fecha (paridad sister).
 *
 * Exporters viven en subdir `infrastructure/exporters/contact-ledger/` per
 * design D6 + [[named_rule_immutability]] — preserva α17 sentinel inmutable.
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

    // ── PDF / XLSX export branches ──
    // Paridad sister /ledger/route.ts: getContactLedgerPaginated con pageSize
    // gigante para obtener TODAS las filas + openingBalance acumulado del
    // historial previo al rango.
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

      const dateRange = dateRangeSchema.parse({
        dateFrom: rawDateFrom,
        dateTo: rawDateTo,
      });

      const [contact, ledgerPage, orgMeta] = await Promise.all([
        contactsService.getActiveById(orgId, contactId),
        service.getContactLedgerPaginated(
          orgId,
          contactId,
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
      const contactSlug = contact.name
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .toLowerCase();
      const orgDisplayName = orgMeta?.name ?? orgSlug;

      if (format === "pdf") {
        // Fetch logo solo en path PDF (XLSX no lo embebe). Tolerante a fallas.
        const logoDataUrl = await fetchLogoAsDataUrl(orgMeta?.logoUrl);

        const { buffer } = await exportContactLedgerPdf(
          entries,
          {
            contactName: contact.name,
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
            // inline → renderiza en pestaña nueva (paridad sister).
            "Content-Disposition": `inline; filename="libro-mayor-${contactSlug}-${periodLabel}.pdf"`,
          },
        });
      }

      // format === "xlsx"
      const buffer = await exportContactLedgerXlsx(
        entries,
        {
          contactName: contact.name,
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
          "Content-Disposition": `attachment; filename="libro-mayor-${contactSlug}-${periodLabel}.xlsx"`,
        },
      });
    }

    // ── JSON (default) ──
    const dateRange = dateRangeSchema.parse({
      dateFrom: searchParams.get("dateFrom") ?? undefined,
      dateTo: searchParams.get("dateTo") ?? undefined,
    });
    const pagination = parsePaginationParams(searchParams);

    // contactId opcional en json branch — paridad C4: el service surfacea
    // NotFoundError via contacts.getActiveById("") cuando está empty.
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
