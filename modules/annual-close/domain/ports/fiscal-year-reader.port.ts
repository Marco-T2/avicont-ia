import type { FiscalYearSnapshot } from "../fiscal-year.entity";

/**
 * Outside-TX reader port for the annual-close pre-TX gate + `getSummary`
 * use case (design rev 2 §4).
 *
 * Hexagonal layer 1 — pure TS, no infra imports. Adapter (Phase 4) wraps
 * Prisma. R5 NO Prisma leak — Snapshot LOCAL primitive-typed return shapes.
 *
 * **Snapshot LOCAL types** mirror precedent EXACT
 * (`MonthlyCloseFiscalPeriod` primitive-typed, monthly-close C1 lección):
 *
 *  - `getByYear` returns FiscalYearSnapshot|null. NotFoundError path lives
 *    in the service layer via `findResultAccount` + explicit checks; the
 *    reader returns null so the orchestrator can decide between OPEN/CREATE
 *    semantics (a FY may not yet exist for OPEN years).
 *  - `countPeriodsByStatus` returns the 3-count Snapshot LOCAL.
 *  - `ccExistsForYear` is the binary CC-already-posted gate (edge-path
 *    rejection per spec REQ-2.1 + REQ-2.2 step 1).
 *  - `decemberPeriodOf` uses `@@unique([organizationId, year, month])` at
 *    `prisma/schema.prisma:441` (design rev 2 §5, S-5).
 *  - `findResultAccount` pre-TX checks for `3.2.2 Resultado de la Gestión`;
 *    null → `MissingResultAccountError` (HTTP 500, W-7).
 */

export interface FiscalYearPeriodCounts {
  closed: number;
  open: number;
  total: number;
}

export interface AnnualCloseDecemberPeriod {
  id: string;
  status: "OPEN" | "CLOSED";
}

export interface AnnualCloseResultAccount {
  id: string;
  code: string;
  nature: "DEUDORA" | "ACREEDORA";
}

export interface FiscalYearReaderPort {
  /**
   * Returns the FiscalYear row for (orgId, year). Null when no row exists —
   * common for the first-ever close of an organization. The service decides
   * whether to upsertOpen inside the TX.
   */
  getByYear(
    organizationId: string,
    year: number,
  ): Promise<FiscalYearSnapshot | null>;

  /**
   * Counts FiscalPeriod rows for (orgId, year) by status. Used by the pre-TX
   * gate (spec REQ-2.1) to detect missing months + select standard/edge path.
   */
  countPeriodsByStatus(
    organizationId: string,
    year: number,
  ): Promise<FiscalYearPeriodCounts>;

  /**
   * True iff a POSTED CC voucher dated within `${year}` already exists.
   * Pre-TX edge-path rejection per spec REQ-2.1; the TX re-checks for
   * race-safety via `YearAccountingReaderTxPort.reReadCcExistsForYearTx`.
   */
  ccExistsForYear(organizationId: string, year: number): Promise<boolean>;

  /**
   * Returns December period snapshot for (orgId, year). Null when no Dec
   * period exists (gate failure → `FiscalYearGateNotMetError`).
   *
   * Adapter uses `@@unique([organizationId, year, month])` at
   * `prisma/schema.prisma:441` (S-5 — design rev 2 §5).
   */
  decemberPeriodOf(
    organizationId: string,
    year: number,
  ): Promise<AnnualCloseDecemberPeriod | null>;

  /**
   * Returns the result-account snapshot for code `3.2.2 Resultado de la
   * Gestión`. Null → caller throws `MissingResultAccountError` (HTTP 500,
   * W-7 — chart-of-accounts seed bug, NOT user input).
   */
  findResultAccount(
    organizationId: string,
  ): Promise<AnnualCloseResultAccount | null>;
}
