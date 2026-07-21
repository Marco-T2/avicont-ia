import type { WorksheetReport } from "../worksheet.types";

/**
 * Outbound port for rendering the Hoja de Trabajo (12-column worksheet) as
 * PDF/XLSX. [EXPORT] cluster paydown — see
 * `modules/accounting/domain/ports/ledger-exporter.port.ts` for the full
 * rationale (D4 precedent, docDef-drop reasoning).
 *
 * `exportXlsx` takes only `orgName` (2 params total) — mirrors the
 * underlying `exportWorksheetXlsx(report, orgName)` signature exactly,
 * which is narrower than its PDF sibling (no orgNit/orgAddress/orgCity).
 * This asymmetry is preserved as-is (behaviour-preserving refactor;
 * `worksheet/route.ts`'s XLSX branch already passes `orgSlug`, not the
 * resolved org display name — an existing quirk this port does not change).
 *
 * `exportPdf` returns a plain `Buffer` — the underlying exporter function
 * (`exportWorksheetPdf`) still returns `{ buffer, docDef }` for
 * testing/inspection (unchanged); no production caller used `docDef`.
 */
export interface WorksheetExporterPort {
  exportPdf(
    report: WorksheetReport,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer>;

  exportXlsx(report: WorksheetReport, orgName: string): Promise<Buffer>;
}
