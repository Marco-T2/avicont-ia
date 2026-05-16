import Decimal from "decimal.js";

import type { Prisma } from "@/generated/prisma/client";

import { toNoonUtc } from "@/lib/date-utils";

import type {
  AccountNature,
  AccountType,
} from "../domain/types/accounting-types";
import type { YearAggregateBalance } from "../domain/ports/year-accounting-reader.port";
import type {
  AnnualCloseFiscalYearStatus,
  AnnualClosePeriodStatus,
  YearAccountingReaderTxPort,
  YearAggregatedLine,
} from "../domain/ports/year-accounting-reader-tx.port";

/**
 * Postgres-backed INSIDE-TX year-aggregate reader for
 * `YearAccountingReaderTxPort` (design rev 2 §4 + §5, Phase 4.8 GREEN).
 *
 * Tx-bound at construction — mirror precedent EXACT. Consumer (UoW.run
 * callback) never sees the `tx` token.
 *
 * **Powers four orchestration steps + three TOCTOU re-reads (W-2)**:
 *   (a') reReadFiscalYearStatusTx / reReadPeriodStatusTx / reReadCcExistsForYearTx
 *   (b)  aggregateYearDebitCredit (C-1/C-4 — Tx re-assert).
 *   (c)  aggregateResultAccountsByYear (CC source — C-2 signed-net builder
 *        input; includes `nature`).
 *   (f)  aggregateBalanceSheetAccountsForCA (CA source — C-3 delta-from-
 *        most-recent-prior-CA + inception fallback + in-memory merge).
 *
 * **DEC-1 boundary**: every `::numeric(18,2)::text` cast → `new Decimal(str)`.
 *
 * **POSTED+LOCKED trial balance** (Phase 8.1 fix): every aggregation here
 * filters `je.status IN ('POSTED','LOCKED')` — the trial balance view treats
 * both as live. Two paths matter:
 *   1. Months 1-11 are CLOSED periods when annual-close runs → their JEs
 *      have been LOCKED by monthly-close's `lockJournalEntries`. POSTED-only
 *      filtering would silently exclude them from the year-aggregate balance
 *      gate (b) and the result-account roll-up (c).
 *   2. Step (f) `aggregateBalanceSheetAccountsForCA` runs AFTER step (d)
 *      lock-cascade on the standard path — the JUST-POSTED CC has been
 *      transitioned POSTED → LOCKED by `lockJournalEntries` on Dec. POSTED-
 *      only filtering would silently drop the CC's contribution to the result
 *      account (3.2.2), producing CA DEBE ≠ HABER.
 *   3. The prevCAdate lookup (step 1 of CA reader) targets prior-year CAs
 *      sitting in long-closed periods → their JEs are LOCKED.
 * Surfaced honest per [[invariant_collision_elevation]] — exposed by Phase 8.1
 * E2E acceptance test, bundled with the W-4 audit-trail test commit.
 *
 * **C-3 (CA source) — THREE-STEP algorithm**:
 *   1. `prevCAdate`: SELECT most-recent POSTED CA strictly before
 *      `${year}-12-31` (single row or empty). If empty → inception fallback
 *      (step 2 uses date `'-infinity'` upper-open bound, effectively all
 *      POSTED rows ≤ `${year}-12-31`).
 *   2. Delta per-account aggregation of POSTED journal_lines for
 *      ACTIVO/PASIVO/PATRIMONIO leaves with `je.date > prevCAdate AND
 *      je.date <= ${year}-12-31` (INCLUDES the just-posted CC).
 *   3. If `prevCAdate` non-null, sum the prevCA's per-account contribution
 *      (POSTED journal_lines from the CA voucher at exactly `prevCAdate`)
 *      and merge with the delta row-by-row.
 *
 * The naïve "sum from inception ≤ year-12-31" path is FORBIDDEN — it would
 * double-count prior-CA-era movements already captured in prevCA. Zero-balance
 * accounts surviving the merge are kept (the ca-line.builder applies the
 * skip-if-net-zero rule downstream — prevCA contribution may revive a
 * zero-delta account).
 */
export class PrismaYearAccountingReaderTxAdapter
  implements YearAccountingReaderTxPort
{
  constructor(
    private readonly tx: Pick<
      Prisma.TransactionClient,
      "$queryRaw" | "fiscalYear" | "fiscalPeriod" | "journalEntry" | "account"
    >,
  ) {}

  // ── (b) Year-aggregate Tx re-assert (C-1/C-4) ───────────────────────────

  async aggregateYearDebitCredit(
    organizationId: string,
    year: number,
  ): Promise<YearAggregateBalance> {
    const rows = await this.tx.$queryRaw<
      Array<{ debit_total: string; credit_total: string }>
    >`
      SELECT
        COALESCE(SUM(jl.debit),  0)::numeric(18,2)::text AS debit_total,
        COALESCE(SUM(jl.credit), 0)::numeric(18,2)::text AS credit_total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      JOIN fiscal_periods  fp ON fp.id = je."periodId"
      WHERE je."organizationId" = ${organizationId}
        AND je.status            IN ('POSTED','LOCKED')
        AND fp.year              = ${year};
    `;
    const row = rows[0] ?? { debit_total: "0", credit_total: "0" };
    return {
      debit: new Decimal(row.debit_total),
      credit: new Decimal(row.credit_total),
    };
  }

  // ── annual-close-canonical-flow port methods ────────────────────────────

  /**
   * REQ-A.1 — asiento #1 source: per-account GASTO leaves with `nature`
   * for the signed-net algorithm in `gastos-close-line.builder`. FIN-1
   * preserved (POSTED ∪ LOCKED). DEC-1: text → `new Decimal(str)`.
   */
  async aggregateGastosByYear(
    organizationId: string,
    year: number,
  ): Promise<YearAggregatedLine[]> {
    const rows = await this.tx.$queryRaw<
      Array<{
        account_id: string;
        code: string;
        nature: AccountNature;
        type: AccountType;
        subtype: string | null;
        debit_total: string;
        credit_total: string;
      }>
    >`
      SELECT
        a.id                                          AS account_id,
        a.code                                        AS code,
        a.nature                                      AS nature,
        a.type                                        AS type,
        a.subtype                                     AS subtype,
        COALESCE(SUM(jl.debit),  0)::numeric(18,2)::text  AS debit_total,
        COALESCE(SUM(jl.credit), 0)::numeric(18,2)::text  AS credit_total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      JOIN accounts        a  ON a.id  = jl."accountId"
      JOIN fiscal_periods  fp ON fp.id = je."periodId"
      WHERE je."organizationId" = ${organizationId}
        AND je.status            IN ('POSTED','LOCKED')
        AND fp.year              = ${year}
        AND a.type               = 'GASTO'
        AND a."isDetail"         = true
      GROUP BY a.id, a.code, a.nature, a.type, a.subtype
      HAVING SUM(jl.debit) <> 0 OR SUM(jl.credit) <> 0;
    `;
    return rows.map(this.mapAggregatedRow);
  }

  /**
   * REQ-A.2 — asiento #2 source: per-account INGRESO leaves with `nature`
   * for the signed-net algorithm in `ingresos-close-line.builder`. FIN-1
   * preserved. DEC-1: text → `new Decimal(str)`.
   */
  async aggregateIngresosByYear(
    organizationId: string,
    year: number,
  ): Promise<YearAggregatedLine[]> {
    const rows = await this.tx.$queryRaw<
      Array<{
        account_id: string;
        code: string;
        nature: AccountNature;
        type: AccountType;
        subtype: string | null;
        debit_total: string;
        credit_total: string;
      }>
    >`
      SELECT
        a.id                                          AS account_id,
        a.code                                        AS code,
        a.nature                                      AS nature,
        a.type                                        AS type,
        a.subtype                                     AS subtype,
        COALESCE(SUM(jl.debit),  0)::numeric(18,2)::text  AS debit_total,
        COALESCE(SUM(jl.credit), 0)::numeric(18,2)::text  AS credit_total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      JOIN accounts        a  ON a.id  = jl."accountId"
      JOIN fiscal_periods  fp ON fp.id = je."periodId"
      WHERE je."organizationId" = ${organizationId}
        AND je.status            IN ('POSTED','LOCKED')
        AND fp.year              = ${year}
        AND a.type               = 'INGRESO'
        AND a."isDetail"         = true
      GROUP BY a.id, a.code, a.nature, a.type, a.subtype
      HAVING SUM(jl.debit) <> 0 OR SUM(jl.credit) <> 0;
    `;
    return rows.map(this.mapAggregatedRow);
  }

  /**
   * REQ-A.4 / REQ-A.11 — asiento #4 source: cumulative ACTIVO/PASIVO/
   * PATRIMONIO aggregation at year-end. Runs INSIDE the TX AFTER asientos
   * #1 + #2 + #3 have posted, so 3.2.2 falls out via the HAVING filter
   * (now zero) and 3.2.1 carries the period result. FIN-1 preserved. NO
   * prevCAdate logic (D-6 — the legacy `aggregateBalanceSheetAccountsForCA`
   * carried a latent FIN-1 prevCAdate bug; this method has no such bug).
   * DEC-1: text → `new Decimal(str)`.
   */
  async aggregateBalanceSheetAtYearEnd(
    organizationId: string,
    year: number,
  ): Promise<YearAggregatedLine[]> {
    const yearEnd = toNoonUtc(`${year}-12-31`);
    const rows = await this.tx.$queryRaw<
      Array<{
        account_id: string;
        code: string;
        nature: AccountNature;
        type: AccountType;
        subtype: string | null;
        debit_total: string;
        credit_total: string;
      }>
    >`
      SELECT
        a.id                                          AS account_id,
        a.code                                        AS code,
        a.nature                                      AS nature,
        a.type                                        AS type,
        a.subtype                                     AS subtype,
        COALESCE(SUM(jl.debit),  0)::numeric(18,2)::text  AS debit_total,
        COALESCE(SUM(jl.credit), 0)::numeric(18,2)::text  AS credit_total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      JOIN accounts        a  ON a.id  = jl."accountId"
      JOIN fiscal_periods  fp ON fp.id = je."periodId"
      WHERE je."organizationId" = ${organizationId}
        AND je.status            IN ('POSTED','LOCKED')
        AND fp.year             <= ${year}
        AND je.date             <= ${yearEnd}
        AND a.type IN ('ACTIVO','PASIVO','PATRIMONIO')
        AND a."isDetail"         = true
      GROUP BY a.id, a.code, a.nature, a.type, a.subtype
      HAVING SUM(jl.debit) <> 0 OR SUM(jl.credit) <> 0;
    `;
    return rows.map(this.mapAggregatedRow);
  }

  /**
   * REQ-A.3 — tx-bound TOCTOU lookup for `3.2.1 Resultados Acumulados`.
   * Mirror of `findResultAccount` with code='3.2.1'. Used by service step
   * (a') to re-check the chart of accounts inside the TX before asiento #3.
   */
  async findAccumulatedResultsAccountTx(
    organizationId: string,
  ): Promise<{ id: string; code: string; nature: AccountNature } | null> {
    const row = await this.tx.account.findFirst({
      where: { organizationId, code: "3.2.1" },
      select: { id: true, code: true, nature: true },
    });
    if (!row) return null;
    return { id: row.id, code: row.code, nature: row.nature };
  }

  // ── annual-close-canonical-flow Phase J T-30 retired ────────────────────
  // Removed from this adapter per D-6 + CAN-5.2:
  //   - aggregateResultAccountsByYear (replaced by aggregateGastosByYear +
  //     aggregateIngresosByYear).
  //   - aggregateBalanceSheetAccountsForCA (replaced by aggregateBalanceSheet
  //     AtYearEnd; latent FIN-1 prevCAdate bug obsoleted as dead code).
  //   - reReadCcExistsForYearTx (idempotency exclusively via FY.status).
  //
  // The legacy `aggregateBalanceSheetAccountsForCA` reader stays in the NoTx
  // PrismaYearAccountingReader adapter (consumed by initial-balance + equity-
  // statement modules via vt.code='CA' filter) — NO change to that path.

  // ── Tx-bound result-account lookup ──────────────────────────────────────

  async findResultAccount(
    organizationId: string,
  ): Promise<{ id: string; code: string; nature: AccountNature } | null> {
    const row = await this.tx.account.findFirst({
      where: { organizationId, code: "3.2.2" },
      select: { id: true, code: true, nature: true },
    });
    if (!row) return null;
    return { id: row.id, code: row.code, nature: row.nature };
  }

  // ── TOCTOU re-reads (W-2 — spec REQ-2.2 step a') ───────────────────────

  async reReadFiscalYearStatusTx(
    fiscalYearId: string,
  ): Promise<AnnualCloseFiscalYearStatus | null> {
    const row = await this.tx.fiscalYear.findUnique({
      where: { id: fiscalYearId },
      select: { status: true },
    });
    if (!row) return null;
    return { status: row.status };
  }

  async reReadPeriodStatusTx(
    periodId: string,
  ): Promise<AnnualClosePeriodStatus | null> {
    const row = await this.tx.fiscalPeriod.findUnique({
      where: { id: periodId },
      select: { status: true },
    });
    if (!row) return null;
    return { status: row.status };
  }

  // ── helpers ────────────────────────────────────────────────────────────

  private mapAggregatedRow(r: {
    account_id: string;
    code: string;
    nature: AccountNature;
    type: AccountType;
    subtype: string | null;
    debit_total: string;
    credit_total: string;
  }): YearAggregatedLine {
    return {
      accountId: r.account_id,
      code: r.code,
      nature: r.nature,
      type: r.type,
      subtype: r.subtype,
      debit: new Decimal(r.debit_total),
      credit: new Decimal(r.credit_total),
    };
  }
}
