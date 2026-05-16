import type { Prisma } from "@/generated/prisma/client";
import { FINALIZED_JE_STATUSES_SQL } from "@/modules/accounting/shared/infrastructure/journal-status.sql";
import { Money } from "@/modules/shared/domain/value-objects/money";
import type {
  AccountingReaderPort,
  MonthlyClosePeriodBalance,
} from "../domain/ports/accounting-reader.port";

/**
 * Cross-module Prisma direct tx-bound adapter para `AccountingReaderPort` —
 * `sumDebitCredit` raw SQL JOIN `journal_lines + journal_entries POSTED`
 * INSIDE-TX para atomicity snapshot consistency under lock cascade. Mirror
 * legacy `features/monthly-close/monthly-close.repository.ts:108-131` shape
 * EXACT (`COALESCE(SUM)::numeric(18,2)` cast bit-perfect Decimal aggregation).
 *
 * Tx-bound at construction (mirror `PrismaFiscalPeriodsTxRepo` +
 * `PrismaAccountBalancesRepo` + `PrismaJournalEntriesRepository` precedent
 * 3+ evidencias supersede absoluto): `Prisma.TransactionClient` recibido en
 * constructor, consumer (UoW.run callback) NO ve tx token.
 *
 * Money VO 4ta cementación cross-POC matures (sale + payment + payables +
 * monthly-close) — Snapshot LOCAL `MonthlyClosePeriodBalance {debit: Money,
 * credit: Money}` VO-typed reuse coherente domain pure NO Prisma leak R5.
 * Decimal string (non-negative SUM aggregation) → `Money.of(string)` factory
 * boundary canonical conversion.
 *
 * §17 carve-out: cross-module Prisma access accounting tables (`journal_lines`,
 * `journal_entries`) via `$queryRaw` raw SQL JOIN — adapter consume Prisma
 * concretes outside accounting module. Driver-anchored: raw SQL needed para
 * `SUM` aggregation con `COALESCE NUMERIC(18,2)` cast — no equivalente
 * accounting hex factory consume, monthly-close-specific use case (NOT
 * compartido cross-module). Single use case justifica adapter local
 * monthly-close/infrastructure (NO refactor accounting/infrastructure).
 */
export class PrismaAccountingReaderAdapter implements AccountingReaderPort {
  constructor(private readonly tx: Prisma.TransactionClient) {}

  async sumDebitCredit(
    organizationId: string,
    periodId: string,
  ): Promise<MonthlyClosePeriodBalance> {
    const rows = await this.tx.$queryRaw<
      Array<{ debit_total: string; credit_total: string }>
    >`
      SELECT
        COALESCE(SUM(jl.debit),  0)::numeric(18,2) AS debit_total,
        COALESCE(SUM(jl.credit), 0)::numeric(18,2) AS credit_total
      FROM journal_lines jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      WHERE je."organizationId" = ${organizationId}
        AND je."periodId"       = ${periodId}
        AND je.status            ${FINALIZED_JE_STATUSES_SQL};
    `;

    const row = rows[0] ?? { debit_total: "0", credit_total: "0" };
    return {
      debit: Money.of(row.debit_total),
      credit: Money.of(row.credit_total),
    };
  }
}
