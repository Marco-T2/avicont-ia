import type { TrialBalanceExporterPort } from "../../domain/ports/trial-balance-exporter.port";
import type { TrialBalanceReport } from "../../domain/trial-balance.types";
import { exportTrialBalancePdf } from "../exporters/trial-balance-pdf.exporter";
import { exportTrialBalanceXlsx } from "../exporters/trial-balance-xlsx.exporter";

/**
 * Adapter for `TrialBalanceExporterPort`. Thin delegation to the EXISTING
 * pure exporter functions (left UNCHANGED). [EXPORT] cluster paydown.
 * `exportPdf` unwraps the `{ buffer, docDef }` Result to a plain `Buffer`.
 */
export class TrialBalanceExporterAdapter implements TrialBalanceExporterPort {
  async exportPdf(
    report: TrialBalanceReport,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer> {
    const { buffer } = await exportTrialBalancePdf(report, orgName, orgNit, orgAddress, orgCity);
    return buffer;
  }

  async exportXlsx(
    report: TrialBalanceReport,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
  ): Promise<Buffer> {
    return exportTrialBalanceXlsx(report, orgName, orgNit, orgAddress);
  }
}
