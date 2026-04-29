/**
 * Pure builders for sale journal entries — mirrors legacy `sale.utils.ts:76`
 * (fidelidad regla #1). Used by the sale-hex `post` and `createAndPost` use
 * cases to compose the `EntryLineTemplate[]` passed to
 * `JournalEntryFactoryPort.generateForSale` (Ciclo 5b).
 *
 * Two paths:
 *   - Sin IVA (or `ivaBook.dfCfIva === 0`): debit CxC + 1 credit per detail.
 *   - Con IVA (Bolivia SIN convention): 5-6 lines (debit CxC, credit ingreso
 *     neto, credit IVA débito fiscal "2.1.6", optional credit exentos
 *     residual, debit IT, credit IT por pagar).
 */

/** Código de cuenta Débito Fiscal IVA (ventas). Fijo Bolivia SIN. */
export const IVA_DEBITO_FISCAL = "2.1.6";

export interface EntryLineTemplate {
  accountCode: string;
  debit: number;
  credit: number;
  contactId?: string;
  description?: string;
}

export interface IvaBookForEntry {
  baseIvaSujetoCf: number;
  dfCfIva: number;
  importeTotal: number;
  exentos?: number;
}

export interface SaleEntrySettings {
  cxcAccountCode: string;
  itExpenseAccountCode: string;
  itPayableAccountCode: string;
}

export interface SaleEntryDetail {
  lineAmount: number;
  incomeAccountCode: string;
  description?: string;
}

export function buildSaleEntryLines(
  totalAmount: number,
  details: SaleEntryDetail[],
  settings: SaleEntrySettings,
  contactId: string,
  ivaBook?: IvaBookForEntry,
): EntryLineTemplate[] {
  if (ivaBook !== undefined && ivaBook.dfCfIva > 0) {
    const { baseIvaSujetoCf, dfCfIva, importeTotal } = ivaBook;
    const primaryAccount = details[0]?.incomeAccountCode ?? "4.1.1";

    const exentosExplicit = ivaBook.exentos;
    const exentos =
      exentosExplicit !== undefined
        ? exentosExplicit
        : Math.round((importeTotal - baseIvaSujetoCf) * 100) / 100;

    if (exentosExplicit !== undefined) {
      const residual = Math.abs(
        baseIvaSujetoCf + exentosExplicit - importeTotal,
      );
      if (residual > 0.005) {
        throw new Error(
          `[buildSaleEntryLines] Invariante de balance violado: ` +
            `base(${baseIvaSujetoCf}) + exentos(${exentosExplicit}) = ` +
            `${baseIvaSujetoCf + exentosExplicit} ≠ importeTotal(${importeTotal}). ` +
            `Diferencia: ${residual.toFixed(4)}`,
        );
      }
    }

    const ingresoNeto = Math.round((baseIvaSujetoCf - dfCfIva) * 100) / 100;
    const itAmount = Math.round(importeTotal * 0.03 * 100) / 100;

    const lines: EntryLineTemplate[] = [
      {
        accountCode: settings.cxcAccountCode,
        debit: importeTotal,
        credit: 0,
        contactId,
      },
      { accountCode: primaryAccount, debit: 0, credit: ingresoNeto },
      { accountCode: IVA_DEBITO_FISCAL, debit: 0, credit: dfCfIva },
    ];

    if (exentos > 0) {
      lines.push({ accountCode: primaryAccount, debit: 0, credit: exentos });
    }

    if (itAmount > 0) {
      lines.push({
        accountCode: settings.itExpenseAccountCode,
        debit: itAmount,
        credit: 0,
      });
      lines.push({
        accountCode: settings.itPayableAccountCode,
        debit: 0,
        credit: itAmount,
      });
    }

    return lines;
  }

  const debitLine: EntryLineTemplate = {
    accountCode: settings.cxcAccountCode,
    debit: totalAmount,
    credit: 0,
    contactId,
  };

  const creditLines: EntryLineTemplate[] = details.map((d) => ({
    accountCode: d.incomeAccountCode,
    debit: 0,
    credit: d.lineAmount,
    description: d.description,
  }));

  return [debitLine, ...creditLines];
}
