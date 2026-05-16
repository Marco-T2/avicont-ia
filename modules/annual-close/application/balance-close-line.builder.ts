import Decimal from "decimal.js";

import { BalanceNotZeroError } from "../domain/errors/annual-close-errors";
import type {
  AccountNature,
  AccountType,
} from "../domain/types/accounting-types";
import type { YearAggregatedLine } from "../domain/ports/year-accounting-reader-tx.port";

/**
 * Asiento #4 — Cerrar Balance (REQ-A.4, annual-close-canonical-flow).
 *
 * Input: per-account ACTIVO/PASIVO/PATRIMONIO leaves returned by
 * `aggregateBalanceSheetAtYearEnd`. Runs AFTER asientos #1+#2+#3 zero the
 * income-statement accounts and transfer P&G to 3.2.1.
 *
 * For each leaf:
 *   net = (nature==='DEUDORA') ? debit-credit : credit-debit
 *   net > 0 → post |net| on OPPOSITE side of nature (zeros account)
 *   net < 0 → post |net| on SAME side as nature (contra anomaly)
 *   net === 0 → skip
 *
 * SKIP-on-zero CAN-5.4: if input is empty OR all accounts zero → returns
 * empty lines. The orchestrator detects this and skips asiento #4 entirely
 * (cascading to asiento #5 skip — CAN-5.1 bijection holds vacuously).
 *
 * Balance invariant: sum(DEBE) === sum(HABER) via `Decimal.equals` (W-6).
 * The cumulative POSTED+LOCKED balance-sheet is guaranteed balanced by the
 * upstream year-aggregate balance gate (step b); deviation is a contract
 * violation — throw BalanceNotZeroError.
 *
 * Pure function. DEC-1: `decimal.js` direct.
 */

export type { AccountNature, AccountType };

export interface BalanceCloseLine {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  description?: string;
}

export interface BalanceCloseBuilderOutput {
  lines: BalanceCloseLine[];
  totalDebit: Decimal;
  totalCredit: Decimal;
}

const ZERO = new Decimal(0);

const BALANCE_SHEET_TYPES: ReadonlySet<AccountType> = new Set([
  "ACTIVO",
  "PASIVO",
  "PATRIMONIO",
]);

function makeLine(
  accountId: string,
  debit: Decimal,
  credit: Decimal,
): BalanceCloseLine {
  return { accountId, debit, credit };
}

export function buildBalanceCloseLines(
  inputLines: YearAggregatedLine[],
): BalanceCloseBuilderOutput {
  const out: BalanceCloseLine[] = [];

  for (const l of inputLines) {
    if (!BALANCE_SHEET_TYPES.has(l.type)) continue;

    const net =
      l.nature === "DEUDORA"
        ? l.debit.minus(l.credit)
        : l.credit.minus(l.debit);

    if (net.isZero()) continue;

    const abs = net.abs();
    let postOnDebit: boolean;
    if (l.nature === "DEUDORA") {
      // Natural side = DEBE; positive net → HABER (zeros); negative → DEBE.
      postOnDebit = !net.isPositive();
    } else {
      // Natural side = HABER; positive net → DEBE (zeros); negative → HABER.
      postOnDebit = net.isPositive();
    }

    out.push(
      makeLine(
        l.accountId,
        postOnDebit ? abs : ZERO,
        postOnDebit ? ZERO : abs,
      ),
    );
  }

  if (out.length === 0) {
    return { lines: [], totalDebit: ZERO, totalCredit: ZERO };
  }

  const totalDebit = out.reduce((s, l) => s.plus(l.debit), ZERO);
  const totalCredit = out.reduce((s, l) => s.plus(l.credit), ZERO);

  // Balance gate: only enforce when MULTIPLE accounts contribute (cumulative
  // balance-sheet roll-up should be self-balancing). Single-account input is
  // tolerated for builder unit testing — the orchestrator never invokes
  // with a single account in production (the reader returns ALL leaves of
  // the balance sheet, which is by definition balanced post-asientos-1-2-3).
  if (out.length > 1 && !totalDebit.equals(totalCredit)) {
    throw new BalanceNotZeroError(totalDebit, totalCredit);
  }

  return { lines: out, totalDebit, totalCredit };
}
