import type { InitialBalanceExporterPort } from "../../domain/ports/initial-balance-exporter.port";
import type { InitialBalanceStatement } from "../../domain/initial-balance.types";
import { exportInitialBalancePdf } from "../exporters/initial-balance-pdf.exporter";
import { exportInitialBalanceXlsx } from "../exporters/initial-balance-xlsx.exporter";

/**
 * Adapter for `InitialBalanceExporterPort`. Thin delegation to the EXISTING
 * pure exporter functions (left UNCHANGED). [EXPORT] cluster paydown.
 * `exportPdf` unwraps the `{ buffer, docDef }` Result to a plain `Buffer`.
 */
export class InitialBalanceExporterAdapter implements InitialBalanceExporterPort {
  async exportPdf(statement: InitialBalanceStatement): Promise<Buffer> {
    const { buffer } = await exportInitialBalancePdf(statement);
    return buffer;
  }

  async exportXlsx(statement: InitialBalanceStatement): Promise<Buffer> {
    return exportInitialBalanceXlsx(statement);
  }
}
