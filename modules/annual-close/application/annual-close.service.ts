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
  MissingResultAccountError,
  PeriodAlreadyClosedError,
  YearOpeningPeriodsExistError,
} from "../domain/errors/annual-close-errors";
import { buildCCLines } from "./cc-line.builder";
import { buildCALines } from "./ca-line.builder";
import { toNoonUtc } from "@/lib/date-utils";

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
   * Thin facade over `FiscalYearReaderPort.getByYear` — exposed at the
   * service surface so the UI (Phase 7.5+) can render `closedAt` without
   * depending on the reader port directly (R5 — only the service is the
   * consumer-facing surface). FK columns `closingEntryId`/`openingEntryId`
   * retired per CAN-5.6 — link is reverse-lookup via JournalEntry.sourceId.
   *
   * Returns `null` when no FiscalYear row exists for `(orgId, year)` — common
   * for years that were never closed (status would be inferred OPEN by the
   * UI's badge logic).
   */
  async getFiscalYearByYear(organizationId: string, year: number) {
    return this.deps.fiscalYearReader.getByYear(organizationId, year);
  }

  /**
   * Close the fiscal year for `(organizationId, year)`.
   *
   * Orchestration per spec REQ-2.1 / REQ-2.2 + design rev 2 §4.
   *
   * ─── Pre-TX (read-only validation) ─────────────────────────────────────
   *   1. validateJustification (≥50 chars)         → JustificationTooShortError
   *   2. Year.of(year)                             → InvalidYearError
   *   3. fiscalYearReader.getByYear (may be null)
   *      if FY.status === "CLOSED" → FiscalYearAlreadyClosedError
   *   4. countPeriodsByStatus(year) total === 12   else FiscalYearGateNotMetError
   *   5. decemberPeriodOf(year)
   *   6. ccExistsForYear(year)
   *   7. dispatch standard vs edge path             else FiscalYearGateNotMetError
   *   8. if Dec OPEN → draftDocuments.countDraftsByPeriod → DraftEntriesInDecemberError
   *   9. countPeriodsByStatus(year+1) total === 0   else YearOpeningPeriodsExistError
   *  10. fiscalYearReader.findResultAccount         else MissingResultAccountError (500)
   *  11. yearAccountingReader.aggregateYearDebitCreditNoTx (C-1/C-4, UNCONDITIONAL)
   *      if !debit.equals(credit) → BalanceNotZeroError
   *
   * ─── INSIDE-TX (uow.run) ───────────────────────────────────────────────
   *  (a') TOCTOU re-reads as FIRST action (W-2):
   *       - fiscalYears.upsertOpen → fyId
   *       - yearAccountingTx.reReadFiscalYearStatusTx(fyId)   != OPEN  → FYAlreadyClosed
   *       - yearAccountingTx.reReadPeriodStatusTx(dec.id)     mismatch → typed error
   *       - yearAccountingTx.reReadCcExistsForYearTx(orgId,year)       → FYGateNotMet
   *  (b)  yearAccountingTx.aggregateYearDebitCredit(orgId,year)
   *       if !debit.equals(credit) → BalanceNotZeroError
   *  (c)  Compose CC: yearAccountingTx.aggregateResultAccountsByYear +
   *       findResultAccount → buildCCLines → closingJournals.createAndPost
   *       (adapter enforces REQ-2.7 C-5)
   *  (d)  if standardPath: locking.lock* STRICT ORDER + fiscalPeriods.markClosed(dec)
   *  (e)  periodAutoCreator.createTwelvePeriodsForYear(year+1) → janPeriodId
   *  (f)  Compose CA: yearAccountingTx.aggregateBalanceSheetAccountsForCA →
   *       buildCALines → closingJournals.createAndPost (in Jan year+1)
   *  (g)  fiscalYears.markClosed (guarded, W-3) → propagates FYAlreadyClosed
   *
   * Any failure rolls back the entire TX (uow contract).
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

    // Year VO validates [1900..2100] + integer; throws InvalidYearError.
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
    const ccExists = await this.deps.fiscalYearReader.ccExistsForYear(
      organizationId,
      year,
    );

    // Path dispatch (spec REQ-2.1 step 5): standard | edge | reject.
    const standardPath =
      periods.closed === MONTHS_PER_YEAR - 1 && dec?.status === "OPEN";
    const edgePath =
      periods.closed === MONTHS_PER_YEAR &&
      dec?.status === "CLOSED" &&
      !ccExists;
    if (!standardPath && !edgePath) {
      throw new FiscalYearGateNotMetError({
        monthsClosed: periods.closed,
        decStatus: dec?.status ?? "NOT_FOUND",
        ccExists,
        periodsCount: periods.total,
        reason:
          "El año no cumple el patrón estándar (11 meses cerrados + diciembre abierto) ni el patrón borde (12 meses cerrados sin CC).",
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

    // C-1 + C-4: year-aggregate balance gate, UNCONDITIONAL.
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
              // Dec was OPEN at pre-TX, now CLOSED → race.
              throw new PeriodAlreadyClosedError({
                periodId: dec.id,
                status: decTx?.status ?? "CLOSED",
              });
            }
            // Edge path expected CLOSED but now OPEN.
            throw new FiscalYearGateNotMetError({
              monthsClosed: periods.closed,
              decStatus: decTx?.status ?? "NOT_FOUND",
              ccExists,
              periodsCount: periods.total,
              reason:
                "El período de diciembre cambió de estado entre la validación previa y la transacción.",
            });
          }
        }

        const ccExistsTx =
          await scope.yearAccountingTx.reReadCcExistsForYearTx(
            organizationId,
            year,
          );
        if (ccExistsTx) {
          throw new FiscalYearGateNotMetError({
            monthsClosed: periods.closed,
            decStatus: dec?.status ?? "NOT_FOUND",
            ccExists: true,
            periodsCount: periods.total,
            reason:
              "Otro proceso registró el Comprobante de Cierre antes de esta transacción.",
          });
        }

        // (b) Re-assert year-aggregate balance INSIDE-TX.
        const yearBalTx = await scope.yearAccountingTx.aggregateYearDebitCredit(
          organizationId,
          year,
        );
        if (!yearBalTx.debit.equals(yearBalTx.credit)) {
          throw new BalanceNotZeroError(yearBalTx.debit, yearBalTx.credit);
        }

        // (c) Compose CC lines.
        const resultLinesTx =
          await scope.yearAccountingTx.aggregateResultAccountsByYear(
            organizationId,
            year,
          );
        const resultAccTx =
          await scope.yearAccountingTx.findResultAccount(organizationId);
        if (!resultAccTx) {
          throw new MissingResultAccountError({ organizationId });
        }
        const ccBuilt = buildCCLines(resultLinesTx, resultAccTx);
        // Builder already asserts Decimal.equals invariant + throws on drift.

        if (!dec) {
          // Unreachable — pre-TX gate already required dec or threw
          // FiscalYearGateNotMetError. Belt-and-suspenders for type narrowing.
          throw new FiscalYearGateNotMetError({
            monthsClosed: periods.closed,
            decStatus: "NOT_FOUND",
            ccExists,
            periodsCount: periods.total,
            reason: "No existe el período de diciembre.",
          });
        }

        const { entryId: ccEntryId } = await scope.closingJournals.createAndPost(
          {
            organizationId,
            periodId: dec.id,
            date: toNoonUtc(`${year}-12-31`),
            voucherTypeCode: "CC",
            description: `Cierre de Gestión ${year}`,
            createdById: userId,
            sourceType: "annual-close",
            sourceId: fyId,
            lines: ccBuilt.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          },
        );

        // (d) Lock cascade STRICT ORDER (standard path only).
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

        // (e) Auto-create year+1 12 periods.
        const { janPeriodId, periodIds } =
          await scope.periodAutoCreator.createTwelvePeriodsForYear({
            organizationId,
            year: year + 1,
            createdById: userId,
          });

        // (f) Compose CA lines.
        const bsLinesTx =
          await scope.yearAccountingTx.aggregateBalanceSheetAccountsForCA(
            organizationId,
            year,
          );
        const caBuilt = buildCALines(bsLinesTx);

        const { entryId: caEntryId } = await scope.closingJournals.createAndPost(
          {
            organizationId,
            periodId: janPeriodId,
            date: toNoonUtc(`${year + 1}-01-01`),
            voucherTypeCode: "CA",
            description: `Apertura de Gestión ${year + 1}`,
            createdById: userId,
            sourceType: "annual-close",
            sourceId: fyId,
            lines: caBuilt.lines.map((l) => ({
              accountId: l.accountId,
              debit: l.debit,
              credit: l.credit,
              description: l.description,
            })),
          },
        );

        // (g) FY markClosed LAST — guarded (W-3). Throws on race.
        // FK args closingEntryId/openingEntryId RETIRED per CAN-5.6 — the
        // canonical flow links via JournalEntry.sourceId reverse-lookup.
        const { closedAt } = await scope.fiscalYears.markClosed({
          fiscalYearId: fyId,
          closedBy: userId,
        });

        return {
          fiscalYearId: fyId,
          year,
          status: "CLOSED" as const,
          closedAt,
          closingEntryId: ccEntryId,
          openingEntryId: caEntryId,
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
