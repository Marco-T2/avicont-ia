import Decimal from "decimal.js";

import { BalanceNotZeroError } from "../domain/errors/annual-close-errors";
import type {
  AccountNature,
  AccountType,
} from "../domain/types/accounting-types";
import type { YearAggregatedLine } from "../domain/ports/year-accounting-reader-tx.port";

/**
 * Asiento #1 — Cerrar Gastos+Costos (REQ-A.1, annual-close-canonical-flow).
 *
 * Signed-net algorithm applied EXCLUSIVELY to GASTO leaves. The result-account
 * balancing line posts on `3.2.2 Resultado de la Gestión` on the DEBE side
 * (the GASTO net flows out of the expense accounts via HABER, charged against
 * the result via DEBE).
 *
 * For each GASTO leaf:
 *   signedNet = (nature==='ACREEDORA') ? credit-debit : debit-credit
 *   signedNet > 0 → post |net| on OPPOSITE side of nature (zeros account)
 *   signedNet < 0 → post |net| on SAME side as nature (contra anomaly)
 *   signedNet === 0 → skip
 *
 * SKIP-if-zero CAN-5.4: if all GASTOS net to zero, returns empty lines —
 * the orchestrator will skip the createAndPost call entirely.
 *
 * Balance invariant: sum(DEBE) === sum(HABER) via `Decimal.equals` (W-6 —
 * `money.utils.eq` FORBIDDEN). Mismatch → BalanceNotZeroError.
 *
 * Hexagonal layer 2 (application). Pure function. DEC-1: `decimal.js` direct.
 */

export type { AccountNature, AccountType };

export interface GastosCloseLine {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  description?: string;
}

export interface GastosCloseBuilderOutput {
  lines: GastosCloseLine[];
  totalDebit: Decimal;
  totalCredit: Decimal;
  /** Net gasto total flowing into 3.2.2 (always non-negative after zero-skip). */
  netForResultAccount: Decimal;
}

const ZERO = new Decimal(0);

function makeLine(
  accountId: string,
  debit: Decimal,
  credit: Decimal,
): GastosCloseLine {
  return { accountId, debit, credit };
}

export function buildGastosCloseLines(
  inputLines: YearAggregatedLine[],
  resultAcc: { id: string; nature: AccountNature },
): GastosCloseBuilderOutput {
  const out: GastosCloseLine[] = [];
  let gastoNet = ZERO;

  for (const l of inputLines) {
    if (l.type !== "GASTO") continue;

    const signedNet =
      l.nature === "ACREEDORA"
        ? l.credit.minus(l.debit)
        : l.debit.minus(l.credit);

    if (signedNet.isZero()) continue;

    const abs = signedNet.abs();

    if (signedNet.isPositive()) {
      // Close on OPPOSITE side of nature. DEUDORA → HABER; ACREEDORA → DEBE.
      const oppositeIsDebit = l.nature === "ACREEDORA";
      out.push(
        makeLine(
          l.accountId,
          oppositeIsDebit ? abs : ZERO,
          oppositeIsDebit ? ZERO : abs,
        ),
      );
    } else {
      // Anomaly contra-balance: post on SAME side as nature.
      const sameIsDebit = l.nature === "DEUDORA";
      out.push(
        makeLine(
          l.accountId,
          sameIsDebit ? abs : ZERO,
          sameIsDebit ? ZERO : abs,
        ),
      );
    }

    gastoNet = gastoNet.plus(signedNet);
  }

  // If no leaves produced lines, skip the entire asiento (CAN-5.4 SKIP-on-zero).
  if (out.length === 0) {
    return {
      lines: [],
      totalDebit: ZERO,
      totalCredit: ZERO,
      netForResultAccount: ZERO,
    };
  }

  // Balancing line on 3.2.2 Resultado de la Gestión.
  // GASTOS net flows: positive net → DEBE on 3.2.2 (charges against result).
  // Negative net (rare contra-anomaly) → HABER on 3.2.2.
  if (!gastoNet.isZero()) {
    const profit = gastoNet.isPositive();
    const abs = gastoNet.abs();
    out.push(
      makeLine(
        resultAcc.id,
        profit ? abs : ZERO,
        profit ? ZERO : abs,
      ),
    );
  }

  const totalDebit = out.reduce((s, l) => s.plus(l.debit), ZERO);
  const totalCredit = out.reduce((s, l) => s.plus(l.credit), ZERO);
  if (!totalDebit.equals(totalCredit)) {
    throw new BalanceNotZeroError(totalDebit, totalCredit);
  }

  return {
    lines: out,
    totalDebit,
    totalCredit,
    netForResultAccount: gastoNet,
  };
}
