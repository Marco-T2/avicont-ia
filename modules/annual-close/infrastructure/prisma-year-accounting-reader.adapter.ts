import Decimal from "decimal.js";

import type { PrismaClient } from "@/generated/prisma/client";

import type {
  YearAccountingReaderPort,
  YearAggregateBalance,
} from "../domain/ports/year-accounting-reader.port";

/**
 * Postgres-backed outside-TX year-aggregate reader for `YearAccountingReaderPort`
 * (design rev 2 §4 + §5, Phase 4.6 GREEN).
 *
 * Powers the pre-TX C-1 + C-4 balance gate in `AnnualCloseService.close` +
 * the read-only `getSummary` use case. Mirror
 * `PrismaMonthlyCloseSummaryReaderAdapter.sumDebitCreditNoTx` precedent
 * EXACT: `Pick<PrismaClient, "$queryRaw">` ctor + raw SQL JOIN +
 * `::numeric(18,2)::text` cast → `new Decimal(str)` at the DEC-1 boundary.
 *
 * **C-1 + C-4 invariant** — single \$queryRaw with `fp.year = ${year}`. NOT
 * per-period sums. UNCONDITIONAL (no Dec-status branching) — the gate
 * evaluates on edge path too (all 12 CLOSED, C-4).
 *
 * **DEC-1 boundary**: the `::numeric(18,2)::text` cast emits a Postgres
 * decimal as a TS `string` (no float drift via implicit Number coerce).
 * `new Decimal(str)` keeps the bit-perfect value into the domain.
 */
export class PrismaYearAccountingReaderAdapter
  implements YearAccountingReaderPort
{
  constructor(private readonly db: Pick<PrismaClient, "$queryRaw">) {}

  async aggregateYearDebitCreditNoTx(
    organizationId: string,
    year: number,
  ): Promise<YearAggregateBalance> {
    const rows = await this.db.$queryRaw<
      Array<{ debit_total: string; credit_total: string }>
    >`
      SELECT
        COALESCE(SUM(jl.debit),  0)::numeric(18,2)::text AS debit_total,
        COALESCE(SUM(jl.credit), 0)::numeric(18,2)::text AS credit_total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      JOIN fiscal_periods  fp ON fp.id = je."periodId"
      WHERE je."organizationId" = ${organizationId}
        AND je.status            = 'POSTED'
        AND fp.year              = ${year};
    `;

    const row = rows[0] ?? { debit_total: "0", credit_total: "0" };
    return {
      debit: new Decimal(row.debit_total),
      credit: new Decimal(row.credit_total),
    };
  }
}
