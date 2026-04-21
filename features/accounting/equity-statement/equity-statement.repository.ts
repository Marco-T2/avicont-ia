import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";
import type { EquityAccountMetadata } from "./equity-statement.types";

export type EquityOrgMetadata = {
  name: string;
  taxId: string | null;
  address: string | null;
};

type RawBalanceRow = {
  account_id: string;
  total_debit: string;
  total_credit: string;
  nature: "DEUDORA" | "ACREEDORA";
};

export class EquityStatementRepository extends BaseRepository {
  /**
   * Aggregates POSTED JournalLines up to (cutoff) and returns signed-net balance
   * per accountId for accounts with type=PATRIMONIO.
   *
   * Sign convention (same as balance-sheet):
   *   DEUDORA:   balance = debit − credit
   *   ACREEDORA: balance = credit − debit
   *
   * Returns Map<accountId, Decimal>. Zero balances are omitted.
   */
  async getPatrimonioBalancesAt(
    orgId: string,
    cutoff: Date,
  ): Promise<Map<string, Prisma.Decimal>> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawBalanceRow[]>`
      SELECT
        jl."accountId"  AS account_id,
        SUM(jl.debit)   AS total_debit,
        SUM(jl.credit)  AS total_credit,
        a.nature
      FROM journal_lines   jl
      JOIN journal_entries je ON je.id  = jl."journalEntryId"
      JOIN accounts        a  ON a.id   = jl."accountId"
      WHERE
        je."organizationId" = ${orgId}
        AND je.status       = 'POSTED'
        AND je.date        <= ${cutoff}
        AND a.type          = 'PATRIMONIO'
      GROUP BY jl."accountId", a.nature
    `;

    const map = new Map<string, Prisma.Decimal>();
    for (const r of rows) {
      const debit  = new Prisma.Decimal(r.total_debit);
      const credit = new Prisma.Decimal(r.total_credit);
      const signed =
        r.nature === "DEUDORA" ? debit.minus(credit) : credit.minus(debit);
      if (!signed.isZero()) map.set(r.account_id, signed);
    }
    return map;
  }

  /** Active PATRIMONIO accounts ordered by code. */
  async findPatrimonioAccounts(orgId: string): Promise<EquityAccountMetadata[]> {
    const scope = this.requireOrg(orgId);
    const accounts = await this.db.account.findMany({
      where: { ...scope, isActive: true, type: "PATRIMONIO" },
      select: { id: true, code: true, name: true, nature: true },
      orderBy: { code: "asc" },
    });
    return accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      nature: a.nature as "DEUDORA" | "ACREEDORA",
    }));
  }

  /** Org metadata for export headers (same contract as TrialBalanceRepository). */
  async getOrgMetadata(orgId: string): Promise<EquityOrgMetadata | null> {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: { name: true },
    });
    if (!org) return null;
    return { name: org.name, taxId: null, address: null };
  }

  /**
   * Returns true when the range [dateFrom, dateTo] matches exactly a CLOSED FiscalPeriod.
   * preliminary = !isClosedPeriodMatch(...)
   */
  async isClosedPeriodMatch(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<boolean> {
    const scope = this.requireOrg(orgId);
    const period = await this.db.fiscalPeriod.findFirst({
      where: { ...scope, status: "CLOSED", startDate: dateFrom, endDate: dateTo },
      select: { id: true },
    });
    return period !== null;
  }
}
