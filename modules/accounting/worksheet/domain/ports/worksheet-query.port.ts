import type { WorksheetMovementAggregation, WorksheetAccountMetadata } from "../types";

/**
 * WorksheetQueryPort — outbound port for worksheet data queries.
 *
 * WS-D2: Single-port architecture (3 methods). NO secondary port.
 * Implemented by PrismaWorksheetRepo in infrastructure layer.
 * Consumed by WorksheetService in application layer.
 *
 * Design §3: findFiscalPeriod return type NARROWED to { startDate; endDate } | null
 * (port exposes only what domain/service needs). PrismaWorksheetRepo maps before returning.
 */
export interface WorksheetQueryPort {
  /**
   * Finds a fiscal period by ID, scoped to the organization.
   * Returns null if not found. Used by service for filter intersection (REQ-10).
   * Return type narrowed to dates only (port does not expose full row shape).
   */
  findFiscalPeriod(
    orgId: string,
    fiscalPeriodId: string,
  ): Promise<{ startDate: Date; endDate: Date } | null>;

  /**
   * Aggregates voucher movements by adjustment flag, scoped to org and date range.
   * Two calls (isAdjustment=false for Sumas, isAdjustment=true for Ajustes).
   */
  aggregateByAdjustmentFlag(
    orgId: string,
    range: { dateFrom: Date; dateTo: Date },
    isAdjustment: boolean,
  ): Promise<WorksheetMovementAggregation[]>;

  /**
   * Finds all active accounts with detail metadata for building the worksheet grid.
   */
  findAccountsWithDetail(orgId: string): Promise<WorksheetAccountMetadata[]>;
}
