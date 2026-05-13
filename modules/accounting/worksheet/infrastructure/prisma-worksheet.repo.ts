import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";
import type { WorksheetQueryPort } from "../domain/ports/worksheet-query.port";
import type {
  WorksheetMovementAggregation,
  WorksheetAccountMetadata,
} from "../domain/types";

// Raw row returned by $queryRaw aggregations
type RawAggregationRow = {
  account_id: string;
  total_debit: string;
  total_credit: string;
  nature: "DEUDORA" | "ACREEDORA";
};

/**
 * PrismaWorksheetRepo — dual $queryRaw aggregation scoped by voucherTypeCfg.isAdjustment.
 *
 * Implements WorksheetQueryPort. Lifted from features/accounting/worksheet/
 * worksheet.repository.ts as part of poc-accounting-worksheet-hex (OLEADA 6).
 *
 * WS-D1: WorksheetMovementAggregation + WorksheetAccountMetadata are imported from
 * domain/types.ts (NOT self-defined here). Canonical source is domain/types.ts.
 *
 * Provides:
 * - findFiscalPeriod: resolves a fiscal period by id for filter intersection.
 *   Return type NARROWED to { startDate, endDate } | null (port only needs dates;
 *   service uses .startDate and .endDate only — narrowing is safe per design §3).
 * - aggregateByAdjustmentFlag: two parallel aggregations (Sumas vs Ajustes).
 * - findAccountsWithDetail: all active accounts including isDetail + type fields.
 *
 * All queries are scoped by organizationId (multi-tenant, NFR-3).
 */
export class PrismaWorksheetRepo extends BaseRepository implements WorksheetQueryPort {
  /**
   * Finds a fiscal period by ID, scoped to the organization.
   * Returns { startDate, endDate } | null — NARROWED from full FiscalPeriodRow.
   * Service uses only startDate + endDate; port exposes only what domain/service needs.
   */
  async findFiscalPeriod(
    orgId: string,
    periodId: string,
  ): Promise<{ startDate: Date; endDate: Date } | null> {
    const scope = this.requireOrg(orgId);

    const period = await this.db.fiscalPeriod.findFirst({
      where: { id: periodId, ...scope },
      select: { startDate: true, endDate: true },
    });

    return period;
  }

  /**
   * Aggregates POSTED journal lines in the given date range, filtering vouchers
   * by their isAdjustment flag.
   *
   * - isAdjustment=false → Sumas del Mayor (CI, CE, CD, CT, CA, CN, CM, CB)
   * - isAdjustment=true  → Ajustes (CJ only in current schema)
   *
   * One $queryRaw per call — no N+1. Caller uses Promise.all for both flags.
   */
  async aggregateByAdjustmentFlag(
    orgId: string,
    range: { dateFrom: Date; dateTo: Date },
    isAdjustment: boolean,
  ): Promise<WorksheetMovementAggregation[]> {
    this.requireOrg(orgId);

    const rows = await this.db.$queryRaw<RawAggregationRow[]>`
      SELECT
        jl."accountId"  AS account_id,
        SUM(jl.debit)   AS total_debit,
        SUM(jl.credit)  AS total_credit,
        a.nature
      FROM journal_lines     jl
      JOIN journal_entries   je  ON je.id  = jl."journalEntryId"
      JOIN accounts          a   ON a.id   = jl."accountId"
      JOIN voucher_types     vtc ON vtc.id = je."voucherTypeId"
      WHERE
        je."organizationId"  = ${orgId}
        AND je.status        = 'POSTED'
        AND vtc."isAdjustment" = ${isAdjustment}
        AND je.date         >= ${range.dateFrom}
        AND je.date         <= ${range.dateTo}
      GROUP BY jl."accountId", a.nature
    `;

    return rows.map((r) => ({
      accountId: r.account_id,
      totalDebit: new Prisma.Decimal(r.total_debit),
      totalCredit: new Prisma.Decimal(r.total_credit),
      nature: r.nature,
    }));
  }

  /**
   * Returns all active accounts for the organization, including the isDetail
   * and type fields needed by the worksheet builder for visibility filtering
   * and column routing.
   *
   * Ordered by code ASC for consistent output.
   */
  async findAccountsWithDetail(orgId: string): Promise<WorksheetAccountMetadata[]> {
    const scope = this.requireOrg(orgId);

    const accounts = await this.db.account.findMany({
      where: { ...scope, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        level: true,
        type: true,
        nature: true,
        isActive: true,
        isDetail: true,
        isContraAccount: true,
      },
      orderBy: { code: "asc" },
    });

    return accounts.map((a) => ({
      id: a.id,
      code: a.code,
      name: a.name,
      level: a.level,
      type: a.type,
      nature: a.nature as "DEUDORA" | "ACREEDORA",
      isActive: a.isActive,
      isDetail: a.isDetail,
      isContraAccount: a.isContraAccount,
    }));
  }
}
