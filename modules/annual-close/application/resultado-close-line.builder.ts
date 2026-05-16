import Decimal from "decimal.js";

import { BalanceNotZeroError } from "../domain/errors/annual-close-errors";
import type { AccountNature } from "../domain/types/accounting-types";

/**
 * Asiento #3 — Cerrar P&G → Resultados Acumulados (REQ-A.3,
 * annual-close-canonical-flow).
 *
 * Input: `netResult` — signed net of `3.2.2 Resultado de la Gestión` AFTER
 * asientos #1 + #2 have posted. Positive = profit (3.2.2 has HABER balance);
 * negative = loss (3.2.2 has DEBE balance).
 *
 *   netResult > 0 → DEBE `net` on 3.2.2 / HABER `net` on 3.2.1
 *   netResult < 0 → HABER `|net|` on 3.2.2 / DEBE `|net|` on 3.2.1
 *   netResult === 0 → SKIP (returns empty lines; CAN-5.4)
 *
 * Balance invariant via `Decimal.equals` (W-6). Pure function; DEC-1.
 */

export type { AccountNature };

export interface ResultadoCloseLine {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  description?: string;
}

export interface ResultadoCloseBuilderOutput {
  lines: ResultadoCloseLine[];
  totalDebit: Decimal;
  totalCredit: Decimal;
}

const ZERO = new Decimal(0);

export function buildResultadoCloseLines(
  netResult: Decimal,
  resultAcc: { id: string; nature: AccountNature },
  accumAcc: { id: string; nature: AccountNature },
): ResultadoCloseBuilderOutput {
  if (netResult.isZero()) {
    return { lines: [], totalDebit: ZERO, totalCredit: ZERO };
  }

  const abs = netResult.abs();
  const profit = netResult.isPositive();

  // profit: DEBE 3.2.2 / HABER 3.2.1
  // loss:   HABER 3.2.2 / DEBE 3.2.1
  const lines: ResultadoCloseLine[] = [
    {
      accountId: resultAcc.id,
      debit: profit ? abs : ZERO,
      credit: profit ? ZERO : abs,
    },
    {
      accountId: accumAcc.id,
      debit: profit ? ZERO : abs,
      credit: profit ? abs : ZERO,
    },
  ];

  const totalDebit = lines.reduce((s, l) => s.plus(l.debit), ZERO);
  const totalCredit = lines.reduce((s, l) => s.plus(l.credit), ZERO);
  if (!totalDebit.equals(totalCredit)) {
    throw new BalanceNotZeroError(totalDebit, totalCredit);
  }

  return { lines, totalDebit, totalCredit };
}
