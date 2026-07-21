import type {
  ContactLedgerExporterPort,
  ContactLedgerPdfExportOptions,
  ContactLedgerXlsxExportOptions,
} from "../../domain/ports/contact-ledger-exporter.port";
import type { ContactLedgerEntry } from "../../domain/ledger.types";
import { exportContactLedgerPdf } from "../exporters/contact-ledger/contact-ledger-pdf.exporter";
import { exportContactLedgerXlsx } from "../exporters/contact-ledger/contact-ledger-xlsx.exporter";

/**
 * Adapter for `ContactLedgerExporterPort`. Thin delegation to the EXISTING
 * pure exporter functions (left UNCHANGED). [EXPORT] cluster paydown.
 *
 * `exportPdf` unwraps `exportContactLedgerPdf`'s `{ buffer, docDef }` Result
 * down to the port's plain `Buffer` contract.
 */
export class ContactLedgerExporterAdapter implements ContactLedgerExporterPort {
  async exportPdf(
    entries: ContactLedgerEntry[],
    opts: ContactLedgerPdfExportOptions,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer> {
    const { buffer } = await exportContactLedgerPdf(
      entries,
      opts,
      orgName,
      orgNit,
      orgAddress,
      orgCity,
    );
    return buffer;
  }

  async exportXlsx(
    entries: ContactLedgerEntry[],
    opts: ContactLedgerXlsxExportOptions,
    orgName: string,
    orgNit?: string,
    orgAddress?: string,
    orgCity?: string,
  ): Promise<Buffer> {
    return exportContactLedgerXlsx(entries, opts, orgName, orgNit, orgAddress, orgCity);
  }
}
