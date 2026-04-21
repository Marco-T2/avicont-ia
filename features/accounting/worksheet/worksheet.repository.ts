import "server-only";
import { BaseRepository } from "@/features/shared/base.repository";
import { Prisma } from "@/generated/prisma/client";
import type { AccountType, AccountNature } from "@/generated/prisma/enums";

// ── Types ─────────────────────────────────────────────────────────────────────

export type WorksheetFiscalPeriodRow = {
  id: string;
  status: string;
  startDate: Date;
  endDate: Date;
};

export type WorksheetDateRange = {
  dateFrom: Date;
  dateTo: Date;
};

/**
 * Aggregation result per account — parallel shape to MovementAggregation from
 * financial-statements, but NOT reused from that module to keep the worksheet
 * feature folder self-contained (per design §2 note on decoupled exporters).
 */
export type WorksheetMovementAggregation = {
  accountId: string;
  totalDebit: Prisma.Decimal;
  totalCredit: Prisma.Decimal;
  nature: "DEUDORA" | "ACREEDORA";
};

/**
 * Account metadata returned by findAccountsWithDetail — extends AccountMetadata
 * shape from financial-statements.types by adding isDetail and accountType.
 */
export type WorksheetAccountMetadata = {
  id: string;
  code: string;
  name: string;
  level: number;
  type: AccountType;
  nature: "DEUDORA" | "ACREEDORA";
  isActive: boolean;
  isDetail: boolean;
  isContraAccount: boolean;
};

// Raw row returned by $queryRaw aggregations
type RawAggregationRow = {
  account_id: string;
  total_debit: string;
  total_credit: string;
  nature: "DEUDORA" | "ACREEDORA";
};

/**
 * WorksheetRepository — dual $queryRaw aggregation scoped by voucherTypeCfg.isAdjustment.
 *
 * Provides:
 * - findFiscalPeriod: resolves a fiscal period by id for filter intersection (REQ-10)
 * - aggregateByAdjustmentFlag: two parallel aggregations (Sumas vs Ajustes)
 * - findAccountsWithDetail: all active accounts including isDetail + type fields
 *
 * Provides:
 * - aggregateByAdjustmentFlag: two parallel aggregations (Sumas vs Ajustes)
 * - findAccountsWithDetail: all active accounts including isDetail + type fields
 *
 * All queries are scoped by organizationId (multi-tenant, NFR-3).
 */
export class WorksheetRepository extends BaseRepository {
  /**
   * Finds a fiscal period by ID, scoped to the organization.
   * Returns null if not found. Used by service for filter intersection (REQ-10).
   */
  async findFiscalPeriod(
    orgId: string,
    periodId: string,
  ): Promise<WorksheetFiscalPeriodRow | null> {
    const scope = this.requireOrg(orgId);

    const period = await this.db.fiscalPeriod.findFirst({
      where: { id: periodId, ...scope },
      select: { id: true, status: true, startDate: true, endDate: true },
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
    range: WorksheetDateRange,
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
      type: a.type as AccountType,
      nature: a.nature as "DEUDORA" | "ACREEDORA",
      isActive: a.isActive,
      isDetail: a.isDetail,
      isContraAccount: a.isContraAccount,
    }));
  }
}
