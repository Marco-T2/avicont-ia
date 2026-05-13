import type {
  TrialBalanceMovement,
  TrialBalanceAccountMetadata,
  TrialBalanceOrgMetadata,
} from "../trial-balance.types";

/**
 * Outbound port for trial-balance data access.
 * 3-method narrow surface — implemented by PrismaTrialBalanceRepo (infrastructure).
 */
export interface TrialBalanceQueryPort {
  /**
   * Aggregates POSTED journal lines for ALL voucher types in the date range.
   * Intentionally omits any isAdjustment filter — every voucher type contributes
   * to Sumas y Saldos (REQ-1).
   */
  aggregateAllVouchers(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<TrialBalanceMovement[]>;

  /**
   * Returns all active accounts for the org, ordered by code ASC.
   * Includes isDetail flag for visibility predicate (REQ-2).
   */
  findAccounts(orgId: string): Promise<TrialBalanceAccountMetadata[]>;

  /**
   * Fetches org metadata for exporter headers.
   */
  getOrgMetadata(orgId: string): Promise<TrialBalanceOrgMetadata | null>;
}
