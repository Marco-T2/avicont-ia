import Decimal from "decimal.js";

import type { DraftDocumentsReaderPort } from "@/modules/monthly-close/domain/ports/draft-documents-reader.port";

import type {
  FiscalYearPeriodCounts,
  FiscalYearReaderPort,
} from "../domain/ports/fiscal-year-reader.port";
import type { YearAccountingReaderPort } from "../domain/ports/year-accounting-reader.port";
import type { AnnualCloseUnitOfWork } from "./annual-close-unit-of-work";

/**
 * AnnualCloseSummary DTO (design rev 2 §4).
 *
 * Year-aggregate read-only snapshot consumed by the UI accordion (REQ-7.x)
 * and the API `/annual-close/summary` endpoint (deferred). Inline service
 * file mirror cumulative-precedent (sale `PostSaleResult`, monthly-close
 * `MonthlyCloseSummary` — 4+ evidencias supersede absoluto).
 *
 * `balance.{debit,credit}` are 2-decimal strings (mirror monthly-close
 * `moneyToFixed` precedent — bit-perfect when SQL aggregation
 * `::numeric(18,2)` cast guarantees ≤2 decimals input). `balance.balanced`
 * sourced via `Decimal.equals` (W-6 — no `money.utils.eq` tolerance).
 *
 * **C-1 invariant**: `balance.*` is year-aggregate (sum across all 12 months),
 * NEVER per-period sums. Sourced via `YearAccountingReaderPort.aggregateYear
 * DebitCreditNoTx` exactly once per `getSummary` call.
 */
export interface AnnualCloseSummary {
  year: number;
  fiscalYearStatus: "OPEN" | "CLOSED" | "NOT_INITIALIZED";
  periods: FiscalYearPeriodCounts;
  decemberStatus: "OPEN" | "CLOSED" | "NOT_FOUND";
  ccExists: boolean;
  gateAllowed: boolean;
  gateReason?: string;
  balance: {
    debit: string;
    credit: string;
    balanced: boolean;
  };
}

export interface AnnualCloseServiceDeps {
  fiscalYearReader: FiscalYearReaderPort;
  yearAccountingReader: YearAccountingReaderPort;
  draftDocuments: DraftDocumentsReaderPort;
  uow: AnnualCloseUnitOfWork;
}

const TWO = 2;

/**
 * Format a `decimal.js` Decimal to a fixed-places decimal string bit-perfect.
 * Mirror of monthly-close `moneyToFixed` precedent EXACT — SQL aggregation
 * `::numeric(18,2)` cast guarantees ≤2 decimals input, so we only ever pad
 * with zeros (NO float drift via `Number()` parse).
 */
function decimalToFixed(d: Decimal, places = TWO): string {
  const s = d.toString();
  const dotIdx = s.indexOf(".");
  if (dotIdx === -1) return `${s}.${"0".repeat(places)}`;
  const decPart = s.slice(dotIdx + 1);
  if (decPart.length >= places) {
    return `${s.slice(0, dotIdx)}.${decPart.slice(0, places)}`;
  }
  return `${s.slice(0, dotIdx)}.${decPart.padEnd(places, "0")}`;
}

/**
 * Decide the gate state for the close button + tooltip reason. Mirrors the
 * pre-TX gate dispatch from spec REQ-2.1 step 5 (standard | edge), but does
 * NOT enforce drafts, justification, or result-account checks — those belong
 * to `close()`, not the read-only `getSummary`.
 */
function decideGate(args: {
  fiscalYearStatus: "OPEN" | "CLOSED" | "NOT_INITIALIZED";
  periods: FiscalYearPeriodCounts;
  decemberStatus: "OPEN" | "CLOSED" | "NOT_FOUND";
  ccExists: boolean;
}): { allowed: boolean; reason?: string } {
  if (args.fiscalYearStatus === "CLOSED") {
    return { allowed: false, reason: "La gestión ya está cerrada." };
  }
  if (args.periods.total !== 12) {
    return {
      allowed: false,
      reason: `Faltan períodos del año (${args.periods.total}/12).`,
    };
  }
  if (args.decemberStatus === "NOT_FOUND") {
    return {
      allowed: false,
      reason: "No existe el período de diciembre para la gestión.",
    };
  }
  if (args.ccExists) {
    return {
      allowed: false,
      reason:
        "Ya existe un Comprobante de Cierre (CC) registrado para esta gestión.",
    };
  }
  // Standard path: months 1-11 CLOSED AND Dec OPEN.
  if (args.periods.closed === 11 && args.decemberStatus === "OPEN") {
    return { allowed: true };
  }
  // Edge path: all 12 CLOSED AND no CC yet.
  if (args.periods.closed === 12 && args.decemberStatus === "CLOSED") {
    return { allowed: true };
  }
  // Otherwise: months still open.
  const openMonths = args.periods.open;
  return {
    allowed: false,
    reason: `Quedan ${openMonths} mes(es) sin cerrar antes de poder cerrar la gestión.`,
  };
}

/**
 * Annual-close application service — orchestrator puro.
 *
 * Composition: ports + UoW; NO infrastructure imports (R5). Mirror
 * monthly-close service shape EXACT (cumulative-precedent: 13 service-class
 * evidencias supersede absoluto + 4 deps interface evidencias + 4 inline
 * DTO evidencias + 4 spread `correlationId` UoW.run evidencias).
 *
 * **Phase 3.3** ships `getSummary` only. The load-bearing `close()` method
 * lands in Phase 3.4-3.7 (separate paired RED+GREEN cycles).
 *
 * **R3 cross-module port REUSE** (design rev 2 §4): `draftDocuments` is
 * imported from `@/modules/monthly-close/domain/ports/`. Composition under
 * §17 carve-out — see composition root JSDoc when it lands in Phase 5.
 */
export class AnnualCloseService {
  constructor(private readonly deps: AnnualCloseServiceDeps) {}

  /**
   * Year-aggregate read-only snapshot. Drives the UI accordion + future
   * `/annual-close/summary` endpoint. Pre-TX semantics — NO uow.run.
   *
   * Composition (design rev 2 §4):
   *   1. fiscalYearReader.getByYear        → FiscalYearStatus | NOT_INITIALIZED
   *   2. fiscalYearReader.countPeriodsByStatus → {closed, open, total}
   *   3. fiscalYearReader.decemberPeriodOf → Dec status | NOT_FOUND
   *   4. fiscalYearReader.ccExistsForYear  → boolean (CC already posted)
   *   5. yearAccountingReader.aggregateYearDebitCreditNoTx → year-aggregate
   *      balance (C-1 — single query, NOT per-period). UNCONDITIONAL.
   *   6. decideGate(...) → standard|edge|blocked + reason string.
   */
  async getSummary(
    organizationId: string,
    year: number,
  ): Promise<AnnualCloseSummary> {
    const [fy, periods, dec, ccExists, balance] = await Promise.all([
      this.deps.fiscalYearReader.getByYear(organizationId, year),
      this.deps.fiscalYearReader.countPeriodsByStatus(organizationId, year),
      this.deps.fiscalYearReader.decemberPeriodOf(organizationId, year),
      this.deps.fiscalYearReader.ccExistsForYear(organizationId, year),
      this.deps.yearAccountingReader.aggregateYearDebitCreditNoTx(
        organizationId,
        year,
      ),
    ]);

    const fiscalYearStatus: "OPEN" | "CLOSED" | "NOT_INITIALIZED" =
      fy === null ? "NOT_INITIALIZED" : fy.status;
    const decemberStatus: "OPEN" | "CLOSED" | "NOT_FOUND" =
      dec === null ? "NOT_FOUND" : dec.status;

    const balanced = balance.debit.equals(balance.credit);
    const { allowed, reason } = decideGate({
      fiscalYearStatus,
      periods,
      decemberStatus,
      ccExists,
    });

    return {
      year,
      fiscalYearStatus,
      periods,
      decemberStatus,
      ccExists,
      gateAllowed: allowed,
      gateReason: reason,
      balance: {
        debit: decimalToFixed(balance.debit, TWO),
        credit: decimalToFixed(balance.credit, TWO),
        balanced,
      },
    };
  }

  /**
   * STUB — Phase 3.4 RED scaffolding. The full orchestration lands in
   * Phase 3.7 GREEN (per design rev 2 §4 "Close orchestration" — 12 steps).
   * Method signature is locked here so RED tests compile under tsc; runtime
   * still throws to keep RED legitimate.
   */
  async close(
    _organizationId: string,
    _year: number,
    _userId: string,
    _justification: string,
  ): Promise<AnnualCloseResult> {
    throw new Error("AnnualCloseService.close — Phase 3.7 GREEN pending");
  }
}

/**
 * Result of a successful annual close (design rev 2 §4). Inline service file
 * mirror precedent EXACT (4+ evidencias cumulative — sale `PostSaleResult`,
 * monthly-close `CloseResult`).
 */
export interface AnnualCloseResult {
  fiscalYearId: string;
  year: number;
  status: "CLOSED";
  closedAt: Date;
  correlationId: string;
  closingEntryId: string;
  openingEntryId: string;
  yearPlus1: { periodIds: string[] };
  decClose?: {
    locked: {
      dispatches: number;
      payments: number;
      journalEntries: number;
      sales: number;
      purchases: number;
    };
  };
}
