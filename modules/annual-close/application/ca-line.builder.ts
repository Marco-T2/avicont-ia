import Decimal from "decimal.js";
import { BalanceNotZeroError } from "../domain/errors/annual-close-errors";
import type {
  AccountNature,
  AccountType,
  YearAggregatedLine as CCYearAggregatedLine,
} from "./cc-line.builder";

/**
 * @deprecated Retired by annual-close-canonical-flow per D-6 (proposal #2695)
 * + CAN-5.1 (zero-divergence). Replaced by `apertura-line.builder` which
 * performs pure in-memory inversion of asiento #4 (no second aggregation).
 * File deletion deferred to Phase J T-30 cleanup. NOT consumed by the
 * service after Phase E T-17 GREEN.
 *
 * CA line builder — nature-aware side selection (REQ-4.2/4.3, design rev 2 §4).
 *
 * Input is the ALREADY-merged delta+prevCA per-account aggregate produced by
 * `YearAccountingReaderTxPort.aggregateBalanceSheetAccountsForCA` (design
 * rev 2 §5, C-3 — the reader does delta-from-most-recent-prior-CA + in-memory
 * merge). This builder is pure side-selection on the supplied (debit, credit):
 *
 *   For each ACTIVO/PASIVO/PATRIMONIO leaf:
 *     net = (nature === "DEUDORA") ? debit - credit : credit - debit
 *     net === 0 → skip
 *     net > 0   → post |net| on natural side (DEU→DEBE, ACR→HABER)
 *     net < 0   → post |net| on opposite side (anomaly — closes contra balance)
 *
 *   INGRESO + GASTO defensively ignored — they were zeroed by CC and the
 *   upstream reader query already excludes them. Skip if any slip in.
 *
 *   Final invariant: sum(DEBE) === sum(HABER) via `Decimal.equals` (W-6 —
 *   no `money.utils.eq`). On mismatch throws BalanceNotZeroError.
 *
 * Hexagonal layer 2 (application). Pure function. DEC-1: `decimal.js` direct.
 *
 * NOTE: re-exports `YearAggregatedLine` from cc-line.builder so consumers
 * have one canonical shape. The reader returns the same row shape for both
 * builders (design §4).
 */

export type { AccountNature, AccountType };
export type YearAggregatedLine = CCYearAggregatedLine;

export interface CALine {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  description?: string;
}

export interface CABuilderOutput {
  lines: CALine[];
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
): CALine {
  return { accountId, debit, credit };
}

export function buildCALines(
  inputLines: YearAggregatedLine[],
): CABuilderOutput {
  const out: CALine[] = [];

  for (const l of inputLines) {
    if (!BALANCE_SHEET_TYPES.has(l.type)) continue; // defensive vs INGRESO/GASTO

    const net =
      l.nature === "DEUDORA" ? l.debit.minus(l.credit) : l.credit.minus(l.debit);

    if (net.isZero()) continue;

    const abs = net.abs();
    let postOnDebit: boolean;
    if (l.nature === "DEUDORA") {
      // Natural side = DEBE. Positive net → DEBE; negative (anomaly) → HABER.
      postOnDebit = net.isPositive();
    } else {
      // Natural side = HABER. Positive net → HABER; negative (anomaly) → DEBE.
      postOnDebit = !net.isPositive();
    }

    out.push(
      makeLine(
        l.accountId,
        postOnDebit ? abs : ZERO,
        postOnDebit ? ZERO : abs,
      ),
    );
  }

  const totalDebit = out.reduce((s, l) => s.plus(l.debit), ZERO);
  const totalCredit = out.reduce((s, l) => s.plus(l.credit), ZERO);
  if (!totalDebit.equals(totalCredit)) {
    throw new BalanceNotZeroError(totalDebit, totalCredit);
  }

  return { lines: out, totalDebit, totalCredit };
}
