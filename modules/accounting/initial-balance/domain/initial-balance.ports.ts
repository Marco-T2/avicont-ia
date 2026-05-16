import type { InitialBalanceRow, InitialBalanceOrgHeader } from "./initial-balance.types";

/**
 * InitialBalanceQueryPort — outbound port for initial balance data queries.
 *
 * **IB-D2**: 4-method port — WIDER than WS/TB (3-method). All 4 methods fired
 * in parallel via `Promise.all` in the service layer.
 *
 * **IB-D3**: Single-port architecture (1 adapter — PrismaInitialBalanceRepo).
 * NO secondary port. Implemented by PrismaInitialBalanceRepo in infrastructure layer.
 * Consumed by InitialBalanceService in application layer.
 *
 * **FLAT path**: `domain/initial-balance.ports.ts` (NOT nested like WS `domain/ports/*.ts`).
 * Axis-distinct from WS — IB uses flat domain layout.
 */
export interface InitialBalanceQueryPort {
  /**
   * Returns initial-balance rows for the organization. Rows are signed-net:
   * DEUDORA = debit − credit; ACREEDORA = credit − debit.
   *
   * **Legacy semantics (post Phase 6.4 narrowing — spec REQ-6.0)**: returns
   * lines from the MOST-RECENT POSTED CA voucher only. Prior to Phase 6.4
   * this method aggregated lines from ALL CAs (which caused multi-year
   * corruption when multiple CAs existed — annual-close C-3 root cause).
   * Year-scoped callers MUST use `getInitialBalanceFromCAForYear`.
   */
  getInitialBalanceFromCA(orgId: string): Promise<InitialBalanceRow[]>;

  /**
   * Year-scoped variant of `getInitialBalanceFromCA`. Returns lines from
   * the POSTED CA voucher dated within `[year-01-01, year-12-31]`. NEW for
   * annual-close (spec REQ-6.0).
   */
  getInitialBalanceFromCAForYear(
    orgId: string,
    year: number,
  ): Promise<InitialBalanceRow[]>;

  /**
   * Returns organization header metadata needed for PDF/XLSX export layout.
   */
  getOrgMetadata(orgId: string): Promise<InitialBalanceOrgHeader | null>;

  /**
   * Returns the count of POSTED CA vouchers for the organization.
   * Used to set `multipleCA` flag (caCount > 1).
   */
  countCAVouchers(orgId: string): Promise<number>;

  /**
   * Year-scoped variant of `countCAVouchers`. Returns the count of POSTED
   * CA vouchers dated within `[year-01-01, year-12-31]`. NEW for annual-close
   * (spec REQ-6.1). Typically 0 or 1.
   */
  countCAVouchersForYear(orgId: string, year: number): Promise<number>;

  /**
   * Returns the opening date for the CA: min(je.date) of POSTED CA entries.
   * Returns null if no CA vouchers found.
   */
  getCADate(orgId: string): Promise<Date | null>;

  /**
   * Year-scoped variant of `getCADate`. Returns the date of the POSTED CA
   * voucher dated within `[year-01-01, year-12-31]` (or null). NEW for
   * annual-close (spec REQ-6.1).
   */
  getCADateForYear(orgId: string, year: number): Promise<Date | null>;
}
