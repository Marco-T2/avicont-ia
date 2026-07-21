import type { LedgerEntry } from "../ledger.types";

/**
 * Outbound port for rendering the Libro Mayor (single-account ledger) as
 * PDF/XLSX. Extracted as part of the [EXPORT] cluster paydown: `LedgerService`
 * (and, before this port, `route.ts` directly) used to call the pure exporter
 * functions in `infrastructure/exporters/ledger/*` straight from
 * presentation/application (R4/R2 violations). The port lets application
 * depend on an abstraction; the concrete pdfmake/exceljs rendering lives in
 * `infrastructure/adapters/ledger-exporter.adapter.ts`, a thin delegation to
 * the EXISTING pure exporter functions (left unchanged — zero risk to
 * rendering logic).
 *
 * Mirrors `modules/payment/domain/ports/shortcut-source-query.port.ts` (D4
 * precedent): narrow, single-purpose port; plain-DTO parameter shapes owned
 * by this file (NOT imported from infrastructure) so the port stays
 * infra-free at the type level.
 *
 * `exportPdf` returns a plain `Buffer` — the underlying exporter function
 * (`exportLedgerPdf`) still returns `{ buffer, docDef }` for
 * testing/inspection (unchanged), but no production caller ever used
 * `docDef` (route.ts only destructured `{ buffer }`), so the adapter unwraps
 * it at the boundary.
 */

export interface LedgerPdfExportOptions {
  accountCode: string;
  accountName: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  openingBalance: string;
  logoDataUrl?: string;
}

export interface LedgerXlsxExportOptions {
  accountCode: string;
  accountName: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  openingBalance: string;
}

export interface LedgerExporterPort {
  exportPdf(
    entries: LedgerEntry[],
    opts: LedgerPdfExportOptions,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer>;

  exportXlsx(
    entries: LedgerEntry[],
    opts: LedgerXlsxExportOptions,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer>;
}
