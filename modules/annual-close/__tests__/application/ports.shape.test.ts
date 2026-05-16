/**
 * Phase 3.1 RED — port shapes test for the annual-close application layer.
 *
 * Asserts existence of the 7 hexagonal ports + the application-layer UoW
 * shape file described in design rev 2 §4 (`sdd/annual-close/design`):
 *
 *   1. FiscalYearReaderPort                  — outside-TX FY reads + result-account lookup
 *   2. FiscalYearWriterTxPort                — INSIDE-TX upsertOpen + guarded markClosed (W-3)
 *   3. YearAccountingReaderPort (NoTx)       — pre-TX year-aggregate balance gate (C-1 + C-4)
 *   4. YearAccountingReaderTxPort (Tx)       — INSIDE-TX TOCTOU re-reads + CC/CA source queries (C-3)
 *   5. AnnualClosingJournalWriterTxPort      — INSIDE-TX CC/CA insert + REQ-2.7 port-level invariant (C-5, W-1)
 *   6. PeriodAutoCreatorTxPort               — INSIDE-TX bulk create year+1 12 periods
 *   7. AnnualCloseUnitOfWork + AnnualCloseScope — application/ — wires all tx-bound + base ports
 *
 * **Mirror precedent EXACT**: cumulative-precedent across SDD POCs is "RED-α
 * existence-only" — file existence verified via `existsSync`; shape (interface
 * exports, method signatures, JSDoc invariants) is verified by tsc + the GREEN
 * implementation compiling AGAINST these tests' imports. NO RED-time content
 * assertions (lección C1 `red-regex-discipline` + `red-acceptance-failure-mode`).
 *
 * Declared failure mode (pre-3.2 GREEN, per [[red_acceptance_failure_mode]]):
 *  - 8 paths under `modules/annual-close/{domain/ports,application}/` do NOT
 *    exist at HEAD 98b73f87 (Phase 2 closure). All 8 `existsSync === true`
 *    assertions FAIL. No divergent paths declared.
 *  - Phase 3.2 GREEN creates all 8 files.
 *
 * Cross-ref:
 *  - design rev 2 §4 (AnnualCloseScope + Ports block) — port set canonical.
 *  - spec REQ-2.7 (C-5 port-level period-status invariant on the writer adapter).
 *  - spec REQ-2.1 (year-aggregate balance gate, NoTx, unconditional).
 *  - spec REQ-4.2 (delta-from-prior-CA, INSIDE-TX, C-3).
 *  - monthly-close precedent `modules/monthly-close/__tests__/c2-1-application-ports-shape.poc-nuevo-monthly-close.test.ts`
 *    (3α existence-only pattern + UoW location application/).
 *  - apply-progress engram `sdd/annual-close/apply-progress` (Phase 2 closed).
 */
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

// __dirname = modules/annual-close/__tests__/application
// → ../../../.. = repo root
const ROOT = resolve(__dirname, "../../../..");

function exists(rel: string): boolean {
  return existsSync(resolve(ROOT, rel));
}

describe("annual-close Phase 3.1 RED — port shapes (7 ports + UoW shape)", () => {
  // ── domain/ports/ — 6 outbound ports ─────────────────────────────────────
  it("Test 1: domain/ports/fiscal-year-reader.port.ts exists (FiscalYearReaderPort — outside-TX FY reads + countPeriodsByStatus + ccExistsForYear + decemberPeriodOf + findResultAccount)", () => {
    expect(
      exists("modules/annual-close/domain/ports/fiscal-year-reader.port.ts"),
    ).toBe(true);
  });

  it("Test 2: domain/ports/fiscal-year-writer-tx.port.ts exists (FiscalYearWriterTxPort — INSIDE-TX upsertOpen + guarded markClosed W-3)", () => {
    expect(
      exists("modules/annual-close/domain/ports/fiscal-year-writer-tx.port.ts"),
    ).toBe(true);
  });

  it("Test 3: domain/ports/year-accounting-reader.port.ts exists (YearAccountingReaderPort — NoTx aggregateYearDebitCreditNoTx for C-1+C-4 pre-TX gate)", () => {
    expect(
      exists(
        "modules/annual-close/domain/ports/year-accounting-reader.port.ts",
      ),
    ).toBe(true);
  });

  it("Test 4: domain/ports/year-accounting-reader-tx.port.ts exists (YearAccountingReaderTxPort — INSIDE-TX TOCTOU re-reads + aggregateResultAccountsByYear + aggregateBalanceSheetAccountsForCA C-3)", () => {
    expect(
      exists(
        "modules/annual-close/domain/ports/year-accounting-reader-tx.port.ts",
      ),
    ).toBe(true);
  });

  it("Test 5: domain/ports/annual-closing-journal-writer-tx.port.ts exists (AnnualClosingJournalWriterTxPort — REQ-2.7 port-level period-status invariant C-5 + W-1 createWithRetryTx)", () => {
    expect(
      exists(
        "modules/annual-close/domain/ports/annual-closing-journal-writer-tx.port.ts",
      ),
    ).toBe(true);
  });

  it("Test 6: domain/ports/period-auto-creator-tx.port.ts exists (PeriodAutoCreatorTxPort — INSIDE-TX createTwelvePeriodsForYear + YearOpeningPeriodsExistError defensive gate)", () => {
    expect(
      exists(
        "modules/annual-close/domain/ports/period-auto-creator-tx.port.ts",
      ),
    ).toBe(true);
  });

  // ── application/ — UoW shape (AnnualCloseScope + AnnualCloseUnitOfWork) ──
  it("Test 7: application/annual-close-unit-of-work.ts exists (AnnualCloseScope extends BaseScope + AnnualCloseUnitOfWork = UnitOfWork<AnnualCloseScope> — mirror monthly-close application/ precedent)", () => {
    expect(
      exists(
        "modules/annual-close/application/annual-close-unit-of-work.ts",
      ),
    ).toBe(true);
  });
});
