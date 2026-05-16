import Decimal from "decimal.js";

import { BalanceNotZeroError } from "../domain/errors/annual-close-errors";
import type {
  AccountNature,
  AccountType,
} from "../domain/types/accounting-types";
import type { YearAggregatedLine } from "../domain/ports/year-accounting-reader-tx.port";

/**
 * Asiento #2 — Cerrar Ingresos (REQ-A.2, annual-close-canonical-flow).
 *
 * Signed-net algorithm applied EXCLUSIVELY to INGRESO leaves. The balancing
 * line posts on `3.2.2 Resultado de la Gestión` on the HABER side (revenue
 * credits the result account; the income accounts are zeroed via DEBE).
 *
 * For each INGRESO leaf:
 *   signedNet = (nature==='ACREEDORA') ? credit-debit : debit-credit
 *   signedNet > 0 → post |net| on OPPOSITE side of nature
 *   signedNet < 0 → post |net| on SAME side as nature (anomaly)
 *   signedNet === 0 → skip
 *
 * SKIP-on-zero CAN-5.4: empty lines if no INGRESOS movement.
 * Balance invariant via `Decimal.equals` (W-6).
 *
 * After asientos #1 + #2 post, 3.2.2 net = HABER(ingresoNet) − DEBE(gastoNet).
 * Asiento #3 zeroes 3.2.2 by transferring net to 3.2.1.
 */

export type { AccountNature, AccountType };

export interface IngresosCloseLine {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  description?: string;
}

export interface IngresosCloseBuilderOutput {
  lines: IngresosCloseLine[];
  totalDebit: Decimal;
  totalCredit: Decimal;
  /** Net ingreso total flowing into 3.2.2 (HABER side when positive). */
  netForResultAccount: Decimal;
}

const ZERO = new Decimal(0);

function makeLine(
  accountId: string,
  debit: Decimal,
  credit: Decimal,
): IngresosCloseLine {
  return { accountId, debit, credit };
}

export function buildIngresosCloseLines(
  inputLines: YearAggregatedLine[],
  resultAcc: { id: string; nature: AccountNature },
): IngresosCloseBuilderOutput {
  const out: IngresosCloseLine[] = [];
  let ingresoNet = ZERO;

  for (const l of inputLines) {
    if (l.type !== "INGRESO") continue;

    const signedNet =
      l.nature === "ACREEDORA"
        ? l.credit.minus(l.debit)
        : l.debit.minus(l.credit);

    if (signedNet.isZero()) continue;

    const abs = signedNet.abs();

    if (signedNet.isPositive()) {
      // Close on OPPOSITE side of nature. ACREEDORA → DEBE; DEUDORA → HABER.
      const oppositeIsDebit = l.nature === "ACREEDORA";
      out.push(
        makeLine(
          l.accountId,
          oppositeIsDebit ? abs : ZERO,
          oppositeIsDebit ? ZERO : abs,
        ),
      );
    } else {
      // Anomaly: post on SAME side as nature.
      const sameIsDebit = l.nature === "DEUDORA";
      out.push(
        makeLine(
          l.accountId,
          sameIsDebit ? abs : ZERO,
          sameIsDebit ? ZERO : abs,
        ),
      );
    }

    ingresoNet = ingresoNet.plus(signedNet);
  }

  if (out.length === 0) {
    return {
      lines: [],
      totalDebit: ZERO,
      totalCredit: ZERO,
      netForResultAccount: ZERO,
    };
  }

  // Balancing line on 3.2.2: INGRESOS net (positive) → HABER on 3.2.2.
  if (!ingresoNet.isZero()) {
    const positive = ingresoNet.isPositive();
    const abs = ingresoNet.abs();
    out.push(
      makeLine(
        resultAcc.id,
        positive ? ZERO : abs,
        positive ? abs : ZERO,
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
    netForResultAccount: ingresoNet,
  };
}
