import type { Prisma } from "@/generated/prisma/client";
import type {
  TypedPatrimonyMovements,
  EquityAccountMetadata,
} from "../equity-statement.types";

/**
 * Companion DTO for org-level metadata consumed by the service.
 * Moved from features/accounting/equity-statement/equity-statement.repository.ts:20
 * to domain/ports/ at C0 (canonical home per REQ-003).
 */
export type EquityOrgMetadata = {
  name: string;
  taxId: string | null;
  /** Dirección sin ciudad. */
  address: string | null;
  /** Ciudad — renderizada en línea propia debajo de Dirección. */
  city: string | null;
};

/**
 * Domain query port for equity statement data access.
 * 6-method interface (AXIS-DISTINCT vs TB 3-method TrialBalanceQueryPort).
 * Implemented by: infrastructure/prisma-equity-statement.repo.ts (C2).
 * REQ-003: port lives in domain/ports/, not in application/.
 * REQ-004: ONE implementation per port (Prisma adapter).
 */
export interface EquityStatementQueryPort {
  /**
   * Balance of all patrimony accounts at a given cutoff date (POSTED JournalLines).
   * Returns Map<accountId, Decimal> with net balance per account.
   */
  getPatrimonioBalancesAt(
    orgId: string,
    cutoff: Date,
  ): Promise<Map<string, Prisma.Decimal>>;

  /**
   * Typed patrimony movements within [dateFrom, dateTo].
   * Returns Map<PatrimonyVoucherCode, Map<accountId, Decimal>>.
   */
  getTypedPatrimonyMovements(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<TypedPatrimonyMovements>;

  /**
   * Net delta from CA-voucher (apertura) JournalLines within [dateFrom, dateTo].
   * Returns Map<accountId, Decimal> — merged into initialByColumn pre-invariant check.
   */
  getAperturaPatrimonyDelta(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<Map<string, Prisma.Decimal>>;

  /**
   * All patrimony accounts for the org with metadata for column mapping.
   */
  findPatrimonioAccounts(orgId: string): Promise<EquityAccountMetadata[]>;

  /**
   * Org-level metadata (name, taxId, address) for report header.
   */
  getOrgMetadata(orgId: string): Promise<EquityOrgMetadata | null>;

  /**
   * Returns true if there is a CLOSED FiscalPeriod matching [dateFrom, dateTo].
   * preliminary = !isClosedPeriodMatch(...)
   */
  isClosedPeriodMatch(
    orgId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<boolean>;
}
