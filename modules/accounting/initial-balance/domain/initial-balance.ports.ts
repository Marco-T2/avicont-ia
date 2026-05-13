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
   * Returns all initial-balance rows for a given Chart of Accounts (CA).
   * Rows are signed-net: DEUDORA = debit − credit; ACREEDORA = credit − debit.
   */
  getInitialBalanceFromCA(orgId: string): Promise<InitialBalanceRow[]>;

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
   * Returns the opening date for the CA: min(je.date) of POSTED CA entries.
   * Returns null if no CA vouchers found.
   */
  getCADate(orgId: string): Promise<Date | null>;
}
