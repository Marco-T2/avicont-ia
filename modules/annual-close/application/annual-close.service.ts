import Decimal from "decimal.js";

import type { DraftDocumentsReaderPort } from "@/modules/monthly-close/domain/ports/draft-documents-reader.port";

import type {
  FiscalYearPeriodCounts,
  FiscalYearReaderPort,
} from "../domain/ports/fiscal-year-reader.port";
import type { YearAccountingReaderPort } from "../domain/ports/year-accounting-reader.port";
import type { AnnualCloseUnitOfWork } from "./annual-close-unit-of-work";
import { Year } from "../domain/value-objects/year";
import {
  BalanceNotZeroError,
  DraftEntriesInDecemberError,
  FiscalYearAlreadyClosedError,
  FiscalYearGateNotMetError,
  JustificationTooShortError,
  MissingAccumulatedResultsAccountError,
  MissingResultAccountError,
  PeriodAlreadyClosedError,
  YearOpeningPeriodsExistError,
} from "../domain/errors/annual-close-errors";
import { buildGastosCloseLines } from "./gastos-close-line.builder";
import { buildIngresosCloseLines } from "./ingresos-close-line.builder";
import { buildResultadoCloseLines } from "./resultado-close-line.builder";
import { buildBalanceCloseLines } from "./balance-close-line.builder";
import { buildAperturaLines } from "./apertura-line.builder";
import { toNoonUtc } from "@/lib/date-utils";

/**
 * AnnualCloseSummary DTO — read-only snapshot consumed by the UI accordion
 * and the future `/annual-close/summary` endpoint.
 *
 * Per annual-close-canonical-flow CAN-5.2: the `ccExists` field is RETIRED
 * as an idempotency signal; it remains as a literal `false` in the DTO
 * until the UI rework strips it entirely (Phase 7.5+ deferred).
 */
export interface AnnualCloseSummary {
  year: number;
  fiscalYearStatus: "OPEN" | "CLOSED" | "NOT_INITIALIZED";
  periods: FiscalYearPeriodCounts;
  decemberStatus: "OPEN" | "CLOSED" | "NOT_FOUND";
  /**
   * @deprecated Retired per CAN-5.2 / REQ-A.8 — idempotency is now exclusively
   * `FiscalYear.status='CLOSED'`.
   */
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

function decideGate(args: {
  fiscalYearStatus: "OPEN" | "CLOSED" | "NOT_INITIALIZED";
  periods: FiscalYearPeriodCounts;
  decemberStatus: "OPEN" | "CLOSED" | "NOT_FOUND";
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
  if (args.periods.closed === 11 && args.decemberStatus === "OPEN") {
    return { allowed: true };
  }
  if (args.periods.closed === 12 && args.decemberStatus === "CLOSED") {
    return { allowed: true };
  }
  const openMonths = args.periods.open;
  return {
    allowed: false,
    reason: `Quedan ${openMonths} mes(es) sin cerrar antes de poder cerrar la gestión.`,
  };
}

/**
 * Annual-close application service — orchestrator puro.
 *
 * annual-close-canonical-flow rewrite (Phase E T-16 + T-17):
 *   Emits up to 5 journal entries per close (4×CC + 1×CA), atomically inside
 *   `uow.run`. Per CAN-5 / CAN-5.5 — strict step ordering: all 4 CC into Dec
 *   OPEN, THEN lock cascade + Dec markClosed, THEN year+1 period creation,
 *   THEN CA into Jan year+1, THEN FY markClosed (W-3 guarded).
 *
 *   SKIP-on-zero (CAN-5.4): empty builder outputs cause the corresponding
 *   asiento to be skipped without breaking the atomicity invariant.
 *
 *   FK columns retired (CAN-5.6): FY.markClosed takes only `{fiscalYearId,
 *   closedBy}`; the canonical link is reverse-lookup via JournalEntry.sourceId.
 */
export class AnnualCloseService {
  constructor(private readonly deps: AnnualCloseServiceDeps) {}

  /**
   * Year-aggregate read-only snapshot. Pre-TX semantics — NO uow.run.
   *
   * Composition (annual-close-canonical-flow):
   *   1. fiscalYearReader.getByYear        → FiscalYearStatus | NOT_INITIALIZED
   *   2. fiscalYearReader.countPeriodsByStatus → {closed, open, total}
   *   3. fiscalYearReader.decemberPeriodOf → Dec status | NOT_FOUND
   *   4. yearAccountingReader.aggregateYearDebitCreditNoTx → year-aggregate balance
   *   5. decideGate(...) → standard|edge|blocked + reason
   *
   *   Idempotency gate `ccExistsForYear` RETIRED per CAN-5.2 / REQ-A.8 —
   *   FY.status='CLOSED' is the canonical idempotency source.
   */
  async getSummary(
    organizationId: string,
    year: number,
  ): Promise<AnnualCloseSummary> {
    const [fy, periods, dec, balance] = await Promise.all([
      this.deps.fiscalYearReader.getByYear(organizationId, year),
      this.deps.fiscalYearReader.countPeriodsByStatus(organizationId, year),
      this.deps.fiscalYearReader.decemberPeriodOf(organizationId, year),
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
    });

    return {
      year,
      fiscalYearStatus,
      periods,
      decemberStatus,
      ccExists: false,
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
   * Facade for the UI to render the FY snapshot. FK columns
   * `closingEntryId`/`openingEntryId` retired per CAN-5.6.
   */
  async getFiscalYearByYear(organizationId: string, year: number) {
    return this.deps.fiscalYearReader.getByYear(organizationId, year);
  }

  /**
   * Close the fiscal year for `(organizationId, year)`.
   *
   * Orchestration per spec REQ-2.1 / REQ-2.2 (annual-close-canonical-flow).
   *
   * ─── Pre-TX gates ──────────────────────────────────────────────────────
   *   1. validateJustification
   *   2. Year.of(year)
   *   3. getByYear → FY.status==='CLOSED' → FiscalYearAlreadyClosedError
   *   4. countPeriodsByStatus(year) total === 12
   *   5. decemberPeriodOf(year)
   *   6. dispatch standard | edge
   *   7. drafts-in-Dec gate (standard path)
   *   8. countPeriodsByStatus(year+1) total === 0
   *   9. findResultAccount (3.2.2)
   *  10. findAccumulatedResultsAccount (3.2.1) → MissingAccumulatedResults
   *      AccountError (NEW per REQ-A.3, 500)
   *  11. aggregateYearDebitCreditNoTx → BalanceNotZeroError on drift
   *
   * ─── INSIDE-TX ─────────────────────────────────────────────────────────
   *  (a') TOCTOU re-reads: upsertOpen + FY status + Dec status +
   *       findAccumulatedResultsAccountTx (CAN-5.2 — no ccExists re-check).
   *  (b)  Re-assert year-aggregate balance.
   *  (c)  Asiento #1 — Cerrar Gastos+Costos (CC, Dec OPEN). SKIP if empty.
   *  (d)  Asiento #2 — Cerrar Ingresos (CC, Dec OPEN). SKIP if empty.
   *  (e)  Asiento #3 — Cerrar P&G → 3.2.1 (CC, Dec OPEN). SKIP if break-even.
   *  (f)  Asiento #4 — Cerrar Balance (CC, Dec OPEN). SKIP if empty.
   *  (g)  STANDARD PATH ONLY: lock cascade STRICT ORDER + Dec markClosed.
   *  (h)  createTwelvePeriodsForYear(year+1) → janPeriodId.
   *  (i)  Asiento #5 — Apertura (CA, Jan year+1 OPEN). SKIP if #4 skipped.
   *  (j)  FY markClosed (W-3 guarded). Throws on race.
   *
   * Any failure rolls back the entire TX (uow contract — CAN-5.3 atomic).
   */
  async close(
    organizationId: string,
    year: number,
    userId: string,
    justification: string,
  ): Promise<AnnualCloseResult> {
    // ── Pre-TX gates ────────────────────────────────────────────────────
    if (justification.length < MIN_JUSTIFICATION_LENGTH) {
      throw new JustificationTooShortError({
        minLength: MIN_JUSTIFICATION_LENGTH,
        actualLength: justification.length,
      });
    }

    Year.of(year);

    const fy = await this.deps.fiscalYearReader.getByYear(organizationId, year);
    if (fy?.status === "CLOSED") {
      throw new FiscalYearAlreadyClosedError({ fiscalYearId: fy.id });
    }

    const periods = await this.deps.fiscalYearReader.countPeriodsByStatus(
      organizationId,
      year,
    );
    if (periods.total !== MONTHS_PER_YEAR) {
      throw new FiscalYearGateNotMetError({
        monthsClosed: periods.closed,
        decStatus: "NOT_FOUND",
        ccExists: false,
        periodsCount: periods.total,
        reason: `El año tiene ${periods.total}/12 períodos creados.`,
      });
    }

    const dec = await this.deps.fiscalYearReader.decemberPeriodOf(
      organizationId,
      year,
    );

    const standardPath =
      periods.closed === MONTHS_PER_YEAR - 1 && dec?.status === "OPEN";
    const edgePath =
      periods.closed === MONTHS_PER_YEAR && dec?.status === "CLOSED";
    if (!standardPath && !edgePath) {
      throw new FiscalYearGateNotMetError({
        monthsClosed: periods.closed,
        decStatus: dec?.status ?? "NOT_FOUND",
        ccExists: false,
        periodsCount: periods.total,
        reason:
          "El año no cumple el patrón estándar (11 meses cerrados + diciembre abierto) ni el patrón borde (12 meses cerrados con la gestión abierta).",
      });
    }

    if (standardPath && dec) {
      const drafts = await this.deps.draftDocuments.countDraftsByPeriod(
        organizationId,
        dec.id,
      );
      const totalDrafts =
        drafts.dispatches +
        drafts.payments +
        drafts.journalEntries +
        drafts.sales +
        drafts.purchases;
      if (totalDrafts > 0) {
        throw new DraftEntriesInDecemberError({
          dispatches: drafts.dispatches,
          payments: drafts.payments,
          journalEntries: drafts.journalEntries,
          sales: drafts.sales,
          purchases: drafts.purchases,
        });
      }
    }

    const yearPlus1Counts =
      await this.deps.fiscalYearReader.countPeriodsByStatus(
        organizationId,
        year + 1,
      );
    if (yearPlus1Counts.total > 0) {
      throw new YearOpeningPeriodsExistError({
        year: year + 1,
        existingCount: yearPlus1Counts.total,
      });
    }

    const resultAcc =
      await this.deps.fiscalYearReader.findResultAccount(organizationId);
    if (!resultAcc) {
      throw new MissingResultAccountError({ organizationId });
    }

    // REQ-A.3 — pre-TX gate for 3.2.1 Resultados Acumulados.
    const accumAcc =
      await this.deps.fiscalYearReader.findAccumulatedResultsAccount(
        organizationId,
      );
    if (!accumAcc) {
      throw new MissingAccumulatedResultsAccountError({ organizationId });
    }

    const yearBal =
      await this.deps.yearAccountingReader.aggregateYearDebitCreditNoTx(
        organizationId,
        year,
      );
    if (!yearBal.debit.equals(yearBal.credit)) {
      throw new BalanceNotZeroError(yearBal.debit, yearBal.credit);
    }

    // ── INSIDE-TX ────────────────────────────────────────────────────────
    const { result, correlationId } = await this.deps.uow.run(
      { userId, organizationId, justification },
      async (scope) => {
        // (a') TOCTOU re-reads FIRST (W-2 — spec REQ-2.2 step a').
        const { id: fyId } = await scope.fiscalYears.upsertOpen({
          organizationId,
          year,
          createdById: userId,
        });

        const fyTx = await scope.yearAccountingTx.reReadFiscalYearStatusTx(
          fyId,
        );
        if (!fyTx || fyTx.status !== "OPEN") {
          throw new FiscalYearAlreadyClosedError({ fiscalYearId: fyId });
        }

        if (dec) {
          const decTx = await scope.yearAccountingTx.reReadPeriodStatusTx(
            dec.id,
          );
          const expected: "OPEN" | "CLOSED" = standardPath ? "OPEN" : "CLOSED";
          if (!decTx || decTx.status !== expected) {
            if (expected === "OPEN") {
              throw new PeriodAlreadyClosedError({
                periodId: dec.id,
                status: decTx?.status ?? "CLOSED",
              });
            }
            throw new FiscalYearGateNotMetError({
              monthsClosed: periods.closed,
              decStatus: decTx?.status ?? "NOT_FOUND",
              ccExists: false,
              periodsCount: periods.total,
              reason:
                "El período de diciembre cambió de estado entre la validación previa y la transacción.",
            });
          }
        }

        // REQ-A.3 TOCTOU — re-check 3.2.1 inside TX.
        const accumAccTx =
          await scope.yearAccountingTx.findAccumulatedResultsAccountTx(
            organizationId,
          );
        if (!accumAccTx) {
          throw new MissingAccumulatedResultsAccountError({ organizationId });
        }

        // (b) Re-assert year-aggregate balance INSIDE-TX.
        const yearBalTx = await scope.yearAccountingTx.aggregateYearDebitCredit(
          organizationId,
          year,
        );
        if (!yearBalTx.debit.equals(yearBalTx.credit)) {
          throw new BalanceNotZeroError(yearBalTx.debit, yearBalTx.credit);
        }

        const resultAccTx =
          await scope.yearAccountingTx.findResultAccount(organizationId);
        if (!resultAccTx) {
          throw new MissingResultAccountError({ organizationId });
        }

        if (!dec) {
          // Unreachable defensive — pre-TX gate required dec.
          throw new FiscalYearGateNotMetError({
            monthsClosed: periods.closed,
            decStatus: "NOT_FOUND",
            ccExists: false,
            periodsCount: periods.total,
            reason: "No existe el período de diciembre.",
          });
        }

        const ccDate = toNoonUtc(`${year}-12-31`);
        const closingEntries: AnnualCloseResult["closingEntries"] = {
          gastos: null,
          ingresos: null,
          resultado: null,
          balance: null,
          apertura: null,
        };

        // (c) Asiento #1 — Cerrar Gastos+Costos. SKIP if empty.
        const gastosLines = await scope.yearAccountingTx.aggregateGastosByYear(
          organizationId,
          year,
        );
        const a1 = buildGastosCloseLines(gastosLines, resultAccTx);
        if (a1.lines.length > 0) {
          const { entryId } = await scope.closingJournals.createAndPost({
            organizationId,
            periodId: dec.id,
            date: ccDate,
            voucherTypeCode: "CC",
            description: `Cierre de Gastos y Costos ${year}`,
            createdById: userId,
            sourceType: "annual-close",
            sourceId: fyId,
            lines: a1.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          });
          closingEntries.gastos = entryId;
        }

        // (d) Asiento #2 — Cerrar Ingresos. SKIP if empty.
        const ingresosLines =
          await scope.yearAccountingTx.aggregateIngresosByYear(
            organizationId,
            year,
          );
        const a2 = buildIngresosCloseLines(ingresosLines, resultAccTx);
        if (a2.lines.length > 0) {
          const { entryId } = await scope.closingJournals.createAndPost({
            organizationId,
            periodId: dec.id,
            date: ccDate,
            voucherTypeCode: "CC",
            description: `Cierre de Ingresos ${year}`,
            createdById: userId,
            sourceType: "annual-close",
            sourceId: fyId,
            lines: a2.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          });
          closingEntries.ingresos = entryId;
        }

        // (e) Asiento #3 — Cerrar P&G → 3.2.1. SKIP if break-even.
        // netResult = ingresoNet - gastoNet (positive = profit).
        const netResult = a2.netForResultAccount.minus(a1.netForResultAccount);
        const a3 = buildResultadoCloseLines(netResult, resultAccTx, accumAccTx);
        if (a3.lines.length > 0) {
          const { entryId } = await scope.closingJournals.createAndPost({
            organizationId,
            periodId: dec.id,
            date: ccDate,
            voucherTypeCode: "CC",
            description: `Cierre Resultado a Acumulados ${year}`,
            createdById: userId,
            sourceType: "annual-close",
            sourceId: fyId,
            lines: a3.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          });
          closingEntries.resultado = entryId;
        }

        // (f) Asiento #4 — Cerrar Balance. POSTS into Dec OPEN BEFORE lock-cascade.
        const bsLines =
          await scope.yearAccountingTx.aggregateBalanceSheetAtYearEnd(
            organizationId,
            year,
          );
        const a4 = buildBalanceCloseLines(bsLines);
        if (a4.lines.length > 0) {
          const { entryId } = await scope.closingJournals.createAndPost({
            organizationId,
            periodId: dec.id,
            date: ccDate,
            voucherTypeCode: "CC",
            description: `Cierre de Balance ${year}`,
            createdById: userId,
            sourceType: "annual-close",
            sourceId: fyId,
            lines: a4.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          });
          closingEntries.balance = entryId;
        }

        // (g) Lock cascade STRICT ORDER (standard path only).
        let decClose: AnnualCloseResult["decClose"] = undefined;
        if (standardPath) {
          const lockedDispatches = await scope.locking.lockDispatches(
            organizationId,
            dec.id,
          );
          const lockedPayments = await scope.locking.lockPayments(
            organizationId,
            dec.id,
          );
          const lockedJournalEntries = await scope.locking.lockJournalEntries(
            organizationId,
            dec.id,
          );
          const lockedSales = await scope.locking.lockSales(
            organizationId,
            dec.id,
          );
          const lockedPurchases = await scope.locking.lockPurchases(
            organizationId,
            dec.id,
          );
          await scope.fiscalPeriods.markClosed(organizationId, dec.id, userId);
          decClose = {
            locked: {
              dispatches: lockedDispatches,
              payments: lockedPayments,
              journalEntries: lockedJournalEntries,
              sales: lockedSales,
              purchases: lockedPurchases,
            },
          };
        }

        // (h) Auto-create year+1 12 periods.
        const { janPeriodId, periodIds } =
          await scope.periodAutoCreator.createTwelvePeriodsForYear({
            organizationId,
            year: year + 1,
            createdById: userId,
          });

        // (i) Asiento #5 — Apertura (CA, Jan year+1 OPEN). SKIP if #4 skipped.
        if (a4.lines.length > 0) {
          const a5 = buildAperturaLines(a4);
          const { entryId } = await scope.closingJournals.createAndPost({
            organizationId,
            periodId: janPeriodId,
            date: toNoonUtc(`${year + 1}-01-01`),
            voucherTypeCode: "CA",
            description: `Apertura de Gestión ${year + 1}`,
            createdById: userId,
            sourceType: "annual-close",
            sourceId: fyId,
            lines: a5.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          });
          closingEntries.apertura = entryId;
        }

        // (j) FY markClosed LAST — guarded (W-3). FK args RETIRED CAN-5.6.
        const { closedAt } = await scope.fiscalYears.markClosed({
          fiscalYearId: fyId,
          closedBy: userId,
        });

        return {
          fiscalYearId: fyId,
          year,
          status: "CLOSED" as const,
          closedAt,
          closingEntries,
          yearPlus1: { periodIds },
          decClose,
        };
      },
    );

    return { ...result, correlationId };
  }
}

const MIN_JUSTIFICATION_LENGTH = 50;
const MONTHS_PER_YEAR = 12;

/**
 * Result of a successful annual close (annual-close-canonical-flow).
 *
 * Per-asiento entry IDs are exposed via `closingEntries.{gastos, ingresos,
 * resultado, balance, apertura}`. Any field may be `null` if the asiento was
 * skipped (SKIP-on-zero per CAN-5.4).
 */
export interface AnnualCloseResult {
  fiscalYearId: string;
  year: number;
  status: "CLOSED";
  closedAt: Date;
  correlationId: string;
  closingEntries: {
    gastos: string | null;
    ingresos: string | null;
    resultado: string | null;
    balance: string | null;
    apertura: string | null;
  };
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
