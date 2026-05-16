import Decimal from "decimal.js";

import type { Prisma } from "@/generated/prisma/client";

import { toNoonUtc } from "@/lib/date-utils";

import type {
  AccountNature,
  AccountType,
} from "../application/cc-line.builder";
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

  // ── (c) CC source — per-account INGRESO/GASTO with nature (C-2) ─────────

  async aggregateResultAccountsByYear(
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
        AND a.type IN ('INGRESO','GASTO')
        AND a."isDetail"         = true
      GROUP BY a.id, a.code, a.nature, a.type, a.subtype
      HAVING SUM(jl.debit) <> 0 OR SUM(jl.credit) <> 0;
    `;
    return rows.map(this.mapAggregatedRow);
  }

  // ── (f) CA source — C-3 three-step delta-from-prior-CA ──────────────────

  async aggregateBalanceSheetAccountsForCA(
    organizationId: string,
    year: number,
  ): Promise<YearAggregatedLine[]> {
    const yearEnd = toNoonUtc(`${year}-12-31`);

    // Step 1 — find most-recent prior CA strictly before year-12-31.
    const prevCARows = await this.tx.$queryRaw<
      Array<{ prev_ca_date: Date }>
    >`
      SELECT je2.date AS prev_ca_date
      FROM journal_entries je2
      JOIN voucher_types vt2 ON vt2.id = je2."voucherTypeId"
      WHERE je2."organizationId" = ${organizationId}
        AND je2.status            = 'POSTED'
        AND vt2.code              = 'CA'
        AND je2.date              < ${yearEnd}
      ORDER BY je2.date DESC, je2."createdAt" DESC
      LIMIT 1;
    `;
    const prevCAdate = prevCARows[0]?.prev_ca_date ?? null;

    // Step 2 — delta aggregation: je.date in (prevCAdate, year-12-31].
    // If prevCAdate null → inception fallback via -infinity (open lower).
    const deltaRows = prevCAdate
      ? await this.tx.$queryRaw<
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
            a.id                                              AS account_id,
            a.code                                            AS code,
            a.nature                                          AS nature,
            a.type                                            AS type,
            a.subtype                                         AS subtype,
            COALESCE(SUM(jl.debit),  0)::numeric(18,2)::text  AS debit_total,
            COALESCE(SUM(jl.credit), 0)::numeric(18,2)::text  AS credit_total
          FROM journal_lines jl
          JOIN journal_entries je ON je.id = jl."journalEntryId"
          JOIN accounts        a  ON a.id  = jl."accountId"
          WHERE je."organizationId" = ${organizationId}
            AND je.status            IN ('POSTED','LOCKED')
            AND je.date              > ${prevCAdate}
            AND je.date             <= ${yearEnd}
            AND a.type IN ('ACTIVO','PASIVO','PATRIMONIO')
            AND a."isDetail"         = true
          GROUP BY a.id, a.code, a.nature, a.type, a.subtype;
        `
      : await this.tx.$queryRaw<
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
            a.id                                              AS account_id,
            a.code                                            AS code,
            a.nature                                          AS nature,
            a.type                                            AS type,
            a.subtype                                         AS subtype,
            COALESCE(SUM(jl.debit),  0)::numeric(18,2)::text  AS debit_total,
            COALESCE(SUM(jl.credit), 0)::numeric(18,2)::text  AS credit_total
          FROM journal_lines jl
          JOIN journal_entries je ON je.id = jl."journalEntryId"
          JOIN accounts        a  ON a.id  = jl."accountId"
          WHERE je."organizationId" = ${organizationId}
            AND je.status            IN ('POSTED','LOCKED')
            AND je.date             <= ${yearEnd}
            AND a.type IN ('ACTIVO','PASIVO','PATRIMONIO')
            AND a."isDetail"         = true
          GROUP BY a.id, a.code, a.nature, a.type, a.subtype;
        `;

    // Inception path — no prevCA to merge, return delta unchanged.
    if (!prevCAdate) {
      return deltaRows.map(this.mapAggregatedRow);
    }

    // Step 3 — prevCA per-account contribution.
    const prevCAContribRows = await this.tx.$queryRaw<
      Array<{
        account_id: string;
        code: string;
        nature: AccountNature;
        type: AccountType;
        subtype: string | null;
        prev_debit_total: string;
        prev_credit_total: string;
      }>
    >`
      SELECT
        a.id                                              AS account_id,
        a.code                                            AS code,
        a.nature                                          AS nature,
        a.type                                            AS type,
        a.subtype                                         AS subtype,
        COALESCE(SUM(jl.debit),  0)::numeric(18,2)::text  AS prev_debit_total,
        COALESCE(SUM(jl.credit), 0)::numeric(18,2)::text  AS prev_credit_total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      JOIN accounts        a  ON a.id  = jl."accountId"
      JOIN voucher_types   vt ON vt.id = je."voucherTypeId"
      WHERE je."organizationId" = ${organizationId}
        AND je.status            IN ('POSTED','LOCKED')
        AND vt.code              = 'CA'
        AND je.date              = ${prevCAdate}
        AND a.type IN ('ACTIVO','PASIVO','PATRIMONIO')
        AND a."isDetail"         = true
      GROUP BY a.id, a.code, a.nature, a.type, a.subtype;
    `;

    // In-memory merge — sum delta + prevCA per accountId.
    const merged = new Map<string, YearAggregatedLine>();
    for (const r of deltaRows) {
      merged.set(r.account_id, this.mapAggregatedRow(r));
    }
    for (const r of prevCAContribRows) {
      const existing = merged.get(r.account_id);
      if (existing) {
        merged.set(r.account_id, {
          ...existing,
          debit: existing.debit.plus(new Decimal(r.prev_debit_total)),
          credit: existing.credit.plus(new Decimal(r.prev_credit_total)),
        });
      } else {
        merged.set(r.account_id, {
          accountId: r.account_id,
          code: r.code,
          nature: r.nature,
          type: r.type,
          subtype: r.subtype,
          debit: new Decimal(r.prev_debit_total),
          credit: new Decimal(r.prev_credit_total),
        });
      }
    }
    return Array.from(merged.values());
  }

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

  async reReadCcExistsForYearTx(
    organizationId: string,
    year: number,
  ): Promise<boolean> {
    const row = await this.tx.journalEntry.findFirst({
      where: {
        organizationId,
        status: "POSTED",
        voucherType: { code: "CC" },
        date: {
          gte: toNoonUtc(`${year}-01-01`),
          lte: toNoonUtc(`${year}-12-31`),
        },
      },
      select: { id: true },
    });
    return row !== null;
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
