import type {
  LedgerExporterPort,
  LedgerPdfExportOptions,
  LedgerXlsxExportOptions,
} from "../../domain/ports/ledger-exporter.port";
import type { LedgerEntry } from "../../domain/ledger.types";
import { exportLedgerPdf } from "../exporters/ledger/ledger-pdf.exporter";
import { exportLedgerXlsx } from "../exporters/ledger/ledger-xlsx.exporter";

/**
 * Adapter for `LedgerExporterPort`. Thin delegation to the EXISTING pure
 * exporter functions (`exportLedgerPdf`/`exportLedgerXlsx`, left UNCHANGED —
 * zero risk to rendering logic). [EXPORT] cluster paydown.
 *
 * `exportPdf` unwraps `exportLedgerPdf`'s `{ buffer, docDef }` Result down
 * to the port's plain `Buffer` contract — no production caller ever used
 * `docDef` (route.ts only destructured `{ buffer }`).
 */
export class LedgerExporterAdapter implements LedgerExporterPort {
  async exportPdf(
    entries: LedgerEntry[],
    opts: LedgerPdfExportOptions,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer> {
    const { buffer } = await exportLedgerPdf(entries, opts, orgName, orgNit, orgAddress, orgCity);
    return buffer;
  }

  async exportXlsx(
    entries: LedgerEntry[],
    opts: LedgerXlsxExportOptions,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer> {
    return exportLedgerXlsx(entries, opts, orgName, orgNit, orgAddress, orgCity);
  }
}
