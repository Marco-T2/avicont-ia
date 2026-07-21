import type { WorksheetExporterPort } from "../../domain/ports/worksheet-exporter.port";
import type { WorksheetReport } from "../../domain/worksheet.types";
import { exportWorksheetPdf } from "../exporters/worksheet-pdf.exporter";
import { exportWorksheetXlsx } from "../exporters/worksheet-xlsx.exporter";

/**
 * Adapter for `WorksheetExporterPort`. Thin delegation to the EXISTING pure
 * exporter functions (left UNCHANGED). [EXPORT] cluster paydown.
 * `exportPdf` unwraps the `{ buffer, docDef }` Result to a plain `Buffer`.
 * `exportXlsx` mirrors the narrower `exportWorksheetXlsx(report, orgName)`
 * signature exactly (no orgNit/orgAddress/orgCity).
 */
export class WorksheetExporterAdapter implements WorksheetExporterPort {
  async exportPdf(
    report: WorksheetReport,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer> {
    const { buffer } = await exportWorksheetPdf(report, orgName, orgNit, orgAddress, orgCity);
    return buffer;
  }

  async exportXlsx(report: WorksheetReport, orgName: string): Promise<Buffer> {
    return exportWorksheetXlsx(report, orgName);
  }
}
