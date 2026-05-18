/**
 * Pure builder for purchase journal entries — mirrors legacy
 * `purchase.utils.ts:112-238` (fidelidad regla #1). Used by purchase-hex
 * `post` and `createAndPost` use cases (A2) to compose
 * `EntryLineTemplate[]` passed to `JournalEntryFactoryPort.generateForPurchase`.
 *
 * Three paths (by purchaseType), all 2-line entries:
 *   FLETE: debit fleteExpense + credit cxp.
 *   POLLO_FAENADO: debit polloFaenadoCOGS + credit cxp.
 *   COMPRA_GENERAL/SERVICIO: N debits per detail + 1 credit cxp.
 *
 * IVA path retired in lcv-feature-retirement (RND 102100000011 — Bolivia SIN
 * replaced LCV with RCV starting December 2021).
 *
 * **Money math**: pure number arithmetic at the
 * `EntryLineTemplate.debit/credit: number` boundary (SHAPE-A — number DTO
 * preserved). IVA path with Decimal-internal arithmetic (roundHalfUp,
 * exentos/gastoNeto) retired in lcv-feature-retirement.
 */

import type { PurchaseType } from "./purchase.entity";

export interface EntryLineTemplate {
  accountCode: string;
  debit: number;
  credit: number;
  description?: string;
  contactId?: string;
}

export interface PurchaseOrgSettings {
  cxpAccountCode: string;
  fleteExpenseAccountCode: string;
  polloFaenadoCOGSAccountCode: string;
}

export interface PurchaseDetailForEntry {
  lineAmount: number;
  expenseAccountCode?: string | null;
  description?: string;
}

export function buildPurchaseEntryLines(
  purchaseType: PurchaseType,
  totalAmount: number,
  details: PurchaseDetailForEntry[],
  settings: PurchaseOrgSettings,
  contactId: string,
): EntryLineTemplate[] {
  const cxpAccountCode = settings.cxpAccountCode;

  if (purchaseType === "FLETE") {
    return [
      { accountCode: settings.fleteExpenseAccountCode, debit: totalAmount, credit: 0 },
      { accountCode: cxpAccountCode, debit: 0, credit: totalAmount, contactId },
    ];
  }

  if (purchaseType === "POLLO_FAENADO") {
    return [
      { accountCode: settings.polloFaenadoCOGSAccountCode, debit: totalAmount, credit: 0 },
      { accountCode: cxpAccountCode, debit: 0, credit: totalAmount, contactId },
    ];
  }

  const debitLines: EntryLineTemplate[] = details.map((d) => ({
    accountCode: d.expenseAccountCode!,
    debit: d.lineAmount,
    credit: 0,
    description: d.description,
  }));

  const creditLine: EntryLineTemplate = {
    accountCode: cxpAccountCode,
    debit: 0,
    credit: totalAmount,
    contactId,
  };

  return [...debitLines, creditLine];
}
