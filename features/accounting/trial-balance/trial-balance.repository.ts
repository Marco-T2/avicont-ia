import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrialBalanceMovement = {
  accountId: string;
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
};

export type TrialBalanceAccountMetadata = {
  id: string;
  code: string;
  name: string;
  isDetail: boolean;
};

export type TrialBalanceOrgMetadata = {
  name: string;
  taxId: string | null;
  address: string | null;
};

// Raw row returned by $queryRaw
type RawAggregationRow = {
  account_id: string;
  total_debit: string;
  total_credit: string;
};

/**
 * TrialBalanceRepository — single $queryRaw aggregation with NO isAdjustment filter.
 *
 * Provides:
 * - aggregateAllVouchers: ALL POSTED vouchers in range, regardless of isAdjustment.
 *   This is the #1 differentiator from WorksheetRepository (REQ-1).
 * - findAccounts: all active accounts, ordered by code ASC.
 * - getOrgMetadata: org name, taxId, address for export headers.
 *
 * All queries are scoped by organizationId (multi-tenant, NFR-3).
 */
export class TrialBalanceRepository extends BaseRepository {
  /**
   * Aggregates POSTED journal lines for ALL voucher types in the date range.
   *
   * Intentionally omits any `vtc."isAdjustment"` filter — every voucher type
   * (CI, CE, CD, CT, CA, CJ, and any future types) contributes to Sumas y Saldos (REQ-1).
   *
   * Returns Prisma.Decimal — not raw strings (REQ-11, C12.E1).
   */
  async aggregateAllVouchers(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<TrialBalanceMovement[]> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawAggregationRow[]>`
      SELECT
        jl."accountId"  AS account_id,
        SUM(jl.debit)   AS total_debit,
        SUM(jl.credit)  AS total_credit
      FROM journal_lines   jl
      JOIN journal_entries je ON je.id = jl."journalEntryId"
      WHERE
        je."organizationId" = ${orgId}
        AND je.status        = 'POSTED'
        AND je.date         >= ${dateFrom}
        AND je.date         <= ${dateTo}
      GROUP BY jl."accountId"
    `;

    return rows.map((r) => ({
      accountId: r.account_id,
      totalDebit: new Prisma.Decimal(r.total_debit),
      totalCredit: new Prisma.Decimal(r.total_credit),
    }));
  }

  /**
   * Returns all active accounts for the org, ordered by code ASC.
   * Includes isDetail flag for visibility predicate (REQ-2).
   */
  async findAccounts(orgId: string): Promise<TrialBalanceAccountMetadata[]> {
    const scope = this.requireOrg(orgId);

    const accounts = await this.db.account.findMany({
      where: { ...scope, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        isDetail: true,
      },
      orderBy: { code: "asc" },
    });

    return accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      isDetail: a.isDetail,
    }));
  }

  /**
   * Fetches org metadata for exporter headers.
   * The Organization model only has `name` (no taxId/address columns in schema v1).
   * taxId and address are returned as null — graceful omission in exporter headers.
   */
  async getOrgMetadata(orgId: string): Promise<TrialBalanceOrgMetadata | null> {
    const org = await this.db.organization.findUnique({
      where: { id: orgId },
      select: {
        name: true,
      },
    });

    if (!org) return null;

    return {
      name: org.name,
      taxId: null,
      address: null,
    };
  }
}
