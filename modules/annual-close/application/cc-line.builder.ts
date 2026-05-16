import Decimal from "decimal.js";
import { BalanceNotZeroError } from "../domain/errors/annual-close-errors";
import type {
  AccountNature,
  AccountType,
} from "../domain/types/accounting-types";

/**
 * @deprecated Retired by annual-close-canonical-flow per D-6 (proposal #2695)
 * + CAN-5 (5-asientos canonical). Replaced by 4 separate builders:
 *   - gastos-close-line.builder (asiento #1)
 *   - ingresos-close-line.builder (asiento #2)
 *   - resultado-close-line.builder (asiento #3)
 *   - balance-close-line.builder (asiento #4)
 * File deletion deferred to Phase J T-30 cleanup. NOT consumed by the
 * service after Phase E T-17 GREEN.
 *
 * CC line builder — signed-net algorithm (REQ-3.3, design rev 2 §4, C-2).
 *
 * Mirrors the nature-aware net-balance pattern from
 * `modules/accounting/worksheet/domain/worksheet.builder.ts:176`:
 *
 *   signedNet = (nature === "ACREEDORA")
 *                 ? credit - debit
 *                 : debit - credit;
 *
 *   signedNet > 0 → post |signedNet| on OPPOSITE side of nature (closes
 *                    a normal-direction balance)
 *   signedNet < 0 → post |signedNet| on SAME side as nature (closes a
 *                    contra-direction anomaly — e.g. INGRESO ended with
 *                    debit-balance due to refund)
 *   signedNet === 0 → skip
 *
 * Balancing line on `3.2.2 Resultado de la Gestión`:
 *   result = sum(ingresoSignedNet) - sum(gastoSignedNet)
 *   result > 0  → HABER (profit credits the result account)
 *   result < 0  → DEBE  (loss debits the result account)
 *   result == 0 → no balancing line
 *
 * Final invariant: sum(DEBE) === sum(HABER) bit-perfect via `Decimal.equals`
 * (W-6 — `money.utils.eq` FORBIDDEN). On mismatch throws BalanceNotZeroError.
 *
 * Hexagonal layer 2 (application). Pure function — no side effects, no infra.
 * DEC-1: `decimal.js` direct.
 */

export type { AccountNature, AccountType };

export interface YearAggregatedLine {
  accountId: string;
  code: string;
  nature: AccountNature;
  type: AccountType;
  subtype: string | null;
  debit: Decimal;
  credit: Decimal;
}

export interface CCLine {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  description?: string;
}

export interface CCBuilderInput {
  lines: CCLine[];
  totalDebit: Decimal;
  totalCredit: Decimal;
  /** Signed net result for the year: +profit, -loss, 0 if break-even. */
  netResult: Decimal;
}

const ZERO = new Decimal(0);

function makeLine(
  accountId: string,
  debit: Decimal,
  credit: Decimal,
): CCLine {
  return { accountId, debit, credit };
}

export function buildCCLines(
  inputLines: YearAggregatedLine[],
  resultAcc: { id: string; nature: AccountNature },
): CCBuilderInput {
  const out: CCLine[] = [];
  let ingresoNet = ZERO;
  let gastoNet = ZERO;

  for (const l of inputLines) {
    if (l.type !== "INGRESO" && l.type !== "GASTO") continue;

    const signedNet =
      l.nature === "ACREEDORA" ? l.credit.minus(l.debit) : l.debit.minus(l.credit);

    if (signedNet.isZero()) continue;

    const abs = signedNet.abs();

    if (signedNet.isPositive()) {
      // Close on OPPOSITE side of nature → zeros the account.
      // ACREEDORA → DEBE; DEUDORA → HABER.
      const oppositeIsDebit = l.nature === "ACREEDORA";
      out.push(
        makeLine(
          l.accountId,
          oppositeIsDebit ? abs : ZERO,
          oppositeIsDebit ? ZERO : abs,
        ),
      );
    } else {
      // Anomaly (contra balance): post on SAME side as nature → reverses.
      // ACREEDORA → HABER; DEUDORA → DEBE.
      const sameIsDebit = l.nature === "DEUDORA";
      out.push(
        makeLine(
          l.accountId,
          sameIsDebit ? abs : ZERO,
          sameIsDebit ? ZERO : abs,
        ),
      );
    }

    if (l.type === "INGRESO") ingresoNet = ingresoNet.plus(signedNet);
    else gastoNet = gastoNet.plus(signedNet);
  }

  // Balancing line on `3.2.2 Resultado de la Gestión`.
  const result = ingresoNet.minus(gastoNet);
  if (!result.isZero()) {
    const profit = result.isPositive();
    const abs = result.abs();
    out.push(
      makeLine(
        resultAcc.id,
        profit ? ZERO : abs,
        profit ? abs : ZERO,
      ),
    );
  }

  // Final invariant — bit-perfect via Decimal.equals (W-6 — no money.utils.eq).
  const totalDebit = out.reduce((s, l) => s.plus(l.debit), ZERO);
  const totalCredit = out.reduce((s, l) => s.plus(l.credit), ZERO);
  if (!totalDebit.equals(totalCredit)) {
    throw new BalanceNotZeroError(totalDebit, totalCredit);
  }

  return {
    lines: out,
    totalDebit,
    totalCredit,
    netResult: result,
  };
}
