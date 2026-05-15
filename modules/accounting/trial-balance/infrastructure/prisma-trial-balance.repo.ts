import { BaseRepository } from "@/features/shared/base.repository";
import Decimal from "decimal.js";
import type { TrialBalanceQueryPort } from "../domain/ports/trial-balance-query.port";
import type {
  TrialBalanceMovement,
  TrialBalanceAccountMetadata,
  TrialBalanceOrgMetadata,
} from "../domain/trial-balance.types";

// Raw row returned by $queryRaw
type RawAggregationRow = {
  account_id: string;
  total_debit: string;
  total_credit: string;
};

/**
 * PrismaTrialBalanceRepo — single $queryRaw aggregation with NO isAdjustment filter.
 *
 * Implements TrialBalanceQueryPort. Lifted from features/accounting/trial-balance/
 * trial-balance.repository.ts as part of poc-accounting-trial-balance-hex (OLEADA 6).
 *
 * Provides:
 * - aggregateAllVouchers: ALL POSTED vouchers in range, regardless of isAdjustment.
 *   This is the #1 differentiator from WorksheetRepository (REQ-1).
 * - findAccounts: all active accounts, ordered by code ASC.
 * - getOrgMetadata: org name, taxId, address for export headers.
 *
 * All queries are scoped by organizationId (multi-tenant, NFR-3).
 */
export class PrismaTrialBalanceRepo extends BaseRepository implements TrialBalanceQueryPort {
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
      // DEC-1 boundary normalization: convert Prisma's inlined Decimal2 to
      // top-level decimal.js so `instanceof Decimal` in the serializer matches.
      totalDebit: new Decimal(r.total_debit),
      totalCredit: new Decimal(r.total_credit),
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
        nature: true,
      },
      orderBy: { code: "asc" },
    });

    return accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      isDetail: a.isDetail,
      nature: a.nature as "DEUDORA" | "ACREEDORA",
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
