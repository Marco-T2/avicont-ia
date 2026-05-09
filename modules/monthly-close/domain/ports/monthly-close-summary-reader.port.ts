import type { MonthlyClosePeriodBalance } from "./accounting-reader.port";

/**
 * Read-only port for monthly-close summary reads — outside-scope outside-tx
 * use case axis-distinct (deferred C2.5 per `monthly-close-unit-of-work.ts:16`).
 * Mirror `DraftDocumentsReaderPort` precedent EXACT single-port-multi-method
 * outside-scope aggregating shape — 5ta evidencia matures cumulative cross-
 * module outside-scope read-only port pattern (FiscalPeriodReader +
 * DraftDocuments + sale IvaBookReader + iva-books SaleReader + monthly-close
 * SummaryReader NEW).
 *
 * **Snapshot LOCAL `MonthlyClosePostedCounts`** primitive-typed mirror
 * `MonthlyCloseDraftCounts` precedent EXACT (single method aggregating 3
 * entity counts POSTED — driver shape único `Promise.all` legacy
 * `monthly-close.repository.ts:23-53` `countByStatus` 3 callsites
 * dispatch+payment+journalEntry POSTED).
 *
 * **Snapshot LOCAL `MonthlyCloseVoucherTypeSummary`** primitive-typed
 * `totalDebit: number` legacy parity Lock #4 float arithmetic preservation
 * regla #1 fidelidad — Riesgo H NEW DEFER §13 D1 (legacy
 * `monthly-close.repository.ts:240-243` `+= Number(line.debit)` accumulated
 * JS number — float drift potential acumulado many entries; defer scope POC).
 *
 * **`sumDebitCreditNoTx` axis-distinct NoTx variant** Money VO mirror C1
 * `AccountingReaderPort.sumDebitCredit` tx-bound consistency tx-bound/NoTx
 * axis-distinct only — 1ra ev POC monthly-close NoTx variant Money VO
 * consistency. R5 NO Prisma leak — port retorna Money VO domain pure.
 */
export interface MonthlyClosePostedCounts {
  dispatches: number;
  payments: number;
  journalEntries: number;
}

export interface MonthlyCloseVoucherTypeSummary {
  code: string;
  name: string;
  count: number;
  totalDebit: number;
}

export interface MonthlyCloseSummaryReaderPort {
  countPostedByPeriod(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyClosePostedCounts>;

  getJournalSummaryByVoucherType(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyCloseVoucherTypeSummary[]>;

  sumDebitCreditNoTx(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyClosePeriodBalance>;
}
