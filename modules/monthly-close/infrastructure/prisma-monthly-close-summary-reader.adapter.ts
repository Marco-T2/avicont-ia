import type { PrismaClient } from "@/generated/prisma/client";
import { Money } from "@/modules/shared/domain/value-objects/money";
import type {
  MonthlyCloseSummaryReaderPort,
  MonthlyClosePostedCounts,
  MonthlyCloseVoucherTypeSummary,
} from "../domain/ports/monthly-close-summary-reader.port";
import type { MonthlyClosePeriodBalance } from "../domain/ports/accounting-reader.port";

/**
 * Cross-module Prisma direct adapter para `MonthlyCloseSummaryReaderPort` —
 * outside-scope read-only outside-tx use case completion. Mirror
 * `PrismaDraftDocumentsReaderAdapter` precedent EXACT
 * `Pick<PrismaClient, tables>` ctor + `PrismaAccountingReaderAdapter` precedent
 * EXACT raw SQL `$queryRaw` JOIN bit-perfect Decimal aggregation
 * `COALESCE(SUM)::numeric(18,2)` cast.
 *
 * §17 carve-out: cross-module Prisma access (`dispatch` + `payment` +
 * `journalEntry` + `journalEntry.voucherType` + `journalEntry.lines` + raw
 * SQL `journal_lines` + `journal_entries`) — adapter consume Prisma concretes
 * outside accounting/journals-hub modules. Driver-anchored: legacy
 * `MonthlyCloseRepository` ya agregaba estos reads en mismo class boundary
 * (single concern: summary reads), consumer-driven hex monthly-close OWNS port.
 *
 * Money VO 5ta cementación cross-POC matures (sale + payment + payables +
 * monthly-close C1 tx-bound + C2.5 NoTx variant axis-distinct only) — Decimal
 * string `numeric(18,2)` cast → `Money.of(string)` factory boundary canonical.
 *
 * `getJournalSummaryByVoucherType` JS number `+= Number(line.debit)`
 * float arithmetic legacy parity Lock #4 (a) regla #1 fidelidad preservation —
 * Riesgo H NEW DEFER §13 D1 scope POC.
 */
export class PrismaMonthlyCloseSummaryReaderAdapter
  implements MonthlyCloseSummaryReaderPort
{
  constructor(
    private readonly db: Pick<
      PrismaClient,
      "dispatch" | "payment" | "journalEntry" | "$queryRaw"
    >,
  ) {}

  async countPostedByPeriod(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyClosePostedCounts> {
    const [dispatches, payments, journalEntries] = await Promise.all([
      this.db.dispatch.count({
        where: { organizationId, periodId, status: "POSTED" },
      }),
      this.db.payment.count({
        where: { organizationId, periodId, status: "POSTED" },
      }),
      this.db.journalEntry.count({
        where: { organizationId, periodId, status: "POSTED" },
      }),
    ]);
    return { dispatches, payments, journalEntries };
  }

  async getJournalSummaryByVoucherType(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyCloseVoucherTypeSummary[]> {
    const entries = await this.db.journalEntry.findMany({
      where: { organizationId, periodId, status: "POSTED" },
      select: {
        voucherType: { select: { code: true, name: true } },
        lines: { select: { debit: true } },
      },
    });

    const map = new Map<string, MonthlyCloseVoucherTypeSummary>();

    for (const entry of entries) {
      const key = entry.voucherType.code;
      const existing = map.get(key);
      const entryDebitTotal = entry.lines.reduce(
        (sum, line) => sum + Number(line.debit),
        0,
      );

      if (existing) {
        existing.count += 1;
        existing.totalDebit += entryDebitTotal;
      } else {
        map.set(key, {
          code: entry.voucherType.code,
          name: entry.voucherType.name,
          count: 1,
          totalDebit: entryDebitTotal,
        });
      }
    }

    return Array.from(map.values());
  }

  async sumDebitCreditNoTx(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyClosePeriodBalance> {
    const rows = await this.db.$queryRaw<
      Array<{ debit_total: string; credit_total: string }>
    >`
      SELECT
        COALESCE(SUM(jl.debit),  0)::numeric(18,2) AS debit_total,
        COALESCE(SUM(jl.credit), 0)::numeric(18,2) AS credit_total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      WHERE je."organizationId" = ${organizationId}
        AND je."periodId"       = ${periodId}
        AND je.status            = 'POSTED';
    `;

    const row = rows[0] ?? { debit_total: "0", credit_total: "0" };
    return {
      debit: Money.of(row.debit_total),
      credit: Money.of(row.credit_total),
    };
  }
}
