/**
 * Pure builders for sale journal entries — mirrors legacy `sale.utils.ts:76`
 * (fidelidad regla #1). Used by the sale-hex `post` and `createAndPost` use
 * cases to compose the `EntryLineTemplate[]` passed to
 * `JournalEntryFactoryPort.generateForSale` (Ciclo 5b).
 *
 * Single path: debit CxC + 1 credit per detail (2-line journal entries).
 * IVA path retired in lcv-feature-retirement (RND 102100000011 — Bolivia SIN
 * replaced LCV with RCV starting December 2021).
 *
 * **Money math**: pure number arithmetic at the `EntryLineTemplate.debit/credit: number`
 * boundary (SHAPE-A — number DTO preserved). IVA path with Decimal-internal
 * arithmetic retired in lcv-feature-retirement.
 */

export interface EntryLineTemplate {
  accountCode: string;
  debit: number;
  credit: number;
  contactId?: string;
  description?: string;
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
): EntryLineTemplate[] {
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
