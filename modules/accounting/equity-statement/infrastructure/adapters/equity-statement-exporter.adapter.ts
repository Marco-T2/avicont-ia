import type { EquityStatementExporterPort } from "../../domain/ports/equity-statement-exporter.port";
import type { EquityStatement } from "../../domain/equity-statement.types";
import { exportEquityStatementPdf } from "../exporters/equity-statement-pdf.exporter";
import { exportEquityStatementXlsx } from "../exporters/equity-statement-xlsx.exporter";

/**
 * Adapter for `EquityStatementExporterPort`. Thin delegation to the
 * EXISTING pure exporter functions (left UNCHANGED). [EXPORT] cluster
 * paydown. `exportPdf` unwraps the `{ buffer, docDef }` Result to a plain
 * `Buffer`.
 */
export class EquityStatementExporterAdapter implements EquityStatementExporterPort {
  async exportPdf(
    statement: EquityStatement,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer> {
    const { buffer } = await exportEquityStatementPdf(statement, orgName, orgNit, orgAddress, orgCity);
    return buffer;
  }

  async exportXlsx(
    statement: EquityStatement,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
  ): Promise<Buffer> {
    return exportEquityStatementXlsx(statement, orgName, orgNit, orgAddress);
  }
}
