import Decimal from "decimal.js";

import type { BalanceCloseBuilderOutput } from "./balance-close-line.builder";

/**
 * Asiento #5 — Apertura de Gestión (REQ-A.5, annual-close-canonical-flow).
 *
 * Pure in-memory side-inversion of asiento #4 line set. CAN-5.1 zero-
 * divergence invariant: every line has swapped (debit, credit); totals
 * swap; accountId + description preserved. NO second DB aggregation.
 *
 * If asiento #4 was skipped (empty lines), asiento #5 is also skipped
 * (cascade per CAN-5.4). The bijection is bijective by construction —
 * if #4 balanced, #5 balances (no separate Decimal.equals gate needed,
 * but kept defensively by the writer adapter REQ-2.7 invariant).
 *
 * Pure function. DEC-1: `decimal.js` direct. Hexagonal layer 2.
 */

export interface AperturaLine {
  accountId: string;
  debit: Decimal;
  credit: Decimal;
  description?: string;
}

export interface AperturaBuilderOutput {
  lines: AperturaLine[];
  totalDebit: Decimal;
  totalCredit: Decimal;
}

const ZERO = new Decimal(0);

export function buildAperturaLines(
  a4: BalanceCloseBuilderOutput,
): AperturaBuilderOutput {
  if (a4.lines.length === 0) {
    return { lines: [], totalDebit: ZERO, totalCredit: ZERO };
  }

  const inverted: AperturaLine[] = a4.lines.map((l) => ({
    accountId: l.accountId,
    debit: l.credit, // SWAP
    credit: l.debit, // SWAP
    description: l.description,
  }));

  return {
    lines: inverted,
    // Totals swap (bijective).
    totalDebit: a4.totalCredit,
    totalCredit: a4.totalDebit,
  };
}
