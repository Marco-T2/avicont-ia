import type Decimal from "decimal.js";
import type { YearAggregateBalance } from "./year-accounting-reader.port";
import type {
  AccountNature,
  AccountType,
} from "../types/accounting-types";

/**
 * INSIDE-TX year-aggregate reader (design rev 2 §4 + §5).
 *
 * Powers steps (a'), (b), (c), (f) of the close orchestration:
 *   (a') TOCTOU re-reads (W-2) — FY/Dec/CC status snapshots inside the TX.
 *   (b)  Year-balance re-assert (C-1/C-4) — same shape as NoTx, tx-bound.
 *   (c)  CC source: per-account INGRESO/GASTO aggregates with `nature` for
 *        the signed-net algorithm (C-2 — cc-line.builder consumes).
 *   (f)  CA source: delta-from-most-recent-prior-CA merged with prevCA
 *        per-account contribution (C-3 — ca-line.builder consumes).
 *
 * Hexagonal layer 1 — pure TS, no infra imports. DEC-1: `decimal.js` Decimal
 * values at the boundary; adapter casts `::numeric(18,2)::text` → `new
 * Decimal(str)`.
 *
 * **Snapshot LOCAL primitives** mirror precedent
 * (`MonthlyCloseFiscalPeriod` C1 pattern). TOCTOU re-read return shapes are
 * intentionally narrow — just the field the orchestrator compares.
 *
 * **YearAggregatedLine** is the canonical per-account aggregate row consumed
 * by the 5 annual-close-canonical-flow builders.
 */

export interface AnnualClosePeriodStatus {
  status: "OPEN" | "CLOSED";
}

export interface AnnualCloseFiscalYearStatus {
  status: "OPEN" | "CLOSED";
}

/**
 * Per-account aggregate row consumed by `cc-line.builder` (REQ-3.3) and
 * `ca-line.builder` (REQ-4.2). `nature` drives the signed-net side selection;
 * `type` lets the builders filter INGRESO/GASTO (CC) vs ACTIVO/PASIVO/PATRIMONIO
 * (CA).
 */
export interface YearAggregatedLine {
  accountId: string;
  code: string;
  nature: AccountNature;
  type: AccountType;
  subtype: string | null;
  debit: Decimal;
  credit: Decimal;
}

export interface YearAccountingReaderTxPort {
  /**
   * INSIDE-TX year-aggregate re-assert (spec REQ-2.2 step 2). Same shape
   * + semantics as the NoTx variant — distinct port to keep the tx-bound
   * adapter wiring explicit (scope-membership pattern).
   */
  aggregateYearDebitCredit(
    organizationId: string,
    year: number,
  ): Promise<YearAggregateBalance>;

  /**
   * Asiento #1 source (REQ-A.1) — INGRESO/GASTO split: GASTO leaves only.
   * Filters `je.status IN ('POSTED','LOCKED')` per FIN-1 + `a.type = 'GASTO'`
   * + `a.isDetail = true` + year + HAVING `debit<>0 OR credit<>0`.
   * Returns raw `(debit, credit)` sums per account with `nature` for the
   * signed-net algorithm in `gastos-close-line.builder`.
   */
  aggregateGastosByYear(
    organizationId: string,
    year: number,
  ): Promise<YearAggregatedLine[]>;

  /**
   * Asiento #2 source (REQ-A.2) — INGRESO leaves only. Same shape as
   * `aggregateGastosByYear` with `a.type = 'INGRESO'`. Consumed by
   * `ingresos-close-line.builder`.
   */
  aggregateIngresosByYear(
    organizationId: string,
    year: number,
  ): Promise<YearAggregatedLine[]>;

  /**
   * Asiento #4 source (REQ-A.4 + REQ-A.11) — balance-sheet aggregation at
   * year-end. Cumulative across prior years (`fp.year <= ${year}`) with
   * FIN-1 status filter + `a.type IN ('ACTIVO','PASIVO','PATRIMONIO')` +
   * `a.isDetail = true` + HAVING `debit<>0 OR credit<>0`.
   *
   * Runs INSIDE the TX AFTER asientos #1 + #2 + #3 have posted — so 3.2.2
   * is naturally excluded (zero balance via HAVING) and 3.2.1 carries the
   * period result. NO prevCAdate / delta logic — the cumulative roll-up is
   * mathematically equivalent and free of the latent FIN-1 bug that
   * `aggregateBalanceSheetAccountsForCA` carried. Consumed by
   * `balance-close-line.builder`.
   */
  aggregateBalanceSheetAtYearEnd(
    organizationId: string,
    year: number,
  ): Promise<YearAggregatedLine[]>;

  /**
   * Tx-bound result-account lookup. Used by step (c) to guard against the
   * (very unlikely) race where the chart of accounts loses `3.2.2` between
   * pre-TX and TX. Throws `MissingResultAccountError` at the caller; the
   * port returns null per snapshot convention.
   */
  findResultAccount(
    organizationId: string,
  ): Promise<{ id: string; code: string; nature: AccountNature } | null>;

  /**
   * Tx-bound accumulated-results-account lookup (REQ-A.3). Same shape as
   * `findResultAccount` but for `3.2.1 Resultados Acumulados`. TOCTOU
   * re-check inside the TX (the pre-TX gate already performed an outside-TX
   * lookup via `FiscalYearReaderPort.findAccumulatedResultsAccount`).
   * Returns null → caller throws `MissingAccumulatedResultsAccountError`.
   */
  findAccumulatedResultsAccountTx(
    organizationId: string,
  ): Promise<{ id: string; code: string; nature: AccountNature } | null>;

  // ── TOCTOU re-reads (W-2 — spec REQ-2.2 step (a')) ──────────────────────

  /**
   * Re-read FiscalYear `status` INSIDE the TX. Null when the row vanished
   * (defensive — should not happen post-upsertOpen). Status !== "OPEN" →
   * `FiscalYearAlreadyClosedError` and rollback.
   */
  reReadFiscalYearStatusTx(
    fiscalYearId: string,
  ): Promise<AnnualCloseFiscalYearStatus | null>;

  /**
   * Re-read FiscalPeriod `status` INSIDE the TX. Null when the row vanished
   * (defensive). Status mismatch vs expected (OPEN for standard path, CLOSED
   * for edge path) → typed error and rollback.
   */
  reReadPeriodStatusTx(
    periodId: string,
  ): Promise<AnnualClosePeriodStatus | null>;
}
