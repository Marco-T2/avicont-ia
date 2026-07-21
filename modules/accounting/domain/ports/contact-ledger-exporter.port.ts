import type { ContactLedgerEntry } from "../ledger.types";

/**
 * Outbound port for rendering the Libro Mayor por Contacto (CxC/CxP ledger)
 * as PDF/XLSX. Sister of `ledger-exporter.port.ts` — see that file's header
 * for the full rationale ([EXPORT] cluster paydown, D4 precedent).
 *
 * Kept as its OWN port (not folded into `LedgerExporterPort`) per the locked
 * design: one narrow port per report family. `LedgerService` implements
 * `getContactLedgerPaginated` alongside `getAccountLedgerPaginated`, so the
 * SAME service class ends up depending on both ports — that is expected
 * (D2 in ledger.service.ts already keeps both report families on one
 * service class; the port split just mirrors that at the export boundary).
 */

export interface ContactLedgerPdfExportOptions {
  contactName: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  openingBalance: string;
  logoDataUrl?: string;
}

export interface ContactLedgerXlsxExportOptions {
  contactName: string;
  dateFrom: string; // YYYY-MM-DD
  dateTo: string; // YYYY-MM-DD
  openingBalance: string;
}

export interface ContactLedgerExporterPort {
  exportPdf(
    entries: ContactLedgerEntry[],
    opts: ContactLedgerPdfExportOptions,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer>;

  exportXlsx(
    entries: ContactLedgerEntry[],
    opts: ContactLedgerXlsxExportOptions,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer>;
}
