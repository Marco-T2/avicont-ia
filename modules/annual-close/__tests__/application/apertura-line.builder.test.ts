/**
 * T-14 RED — apertura-line.builder (asiento #5, CAN-5.1 in-memory invert).
 *
 * REQ refs: REQ-A.5 + CAN-5.1 (zero-divergence invariant) + CAN-5.4 + DEC-1.
 * Cross-ref: spec #2697 REQ-A.5 + CAN-5.1 / design #2696 §Builders algorithm.
 *
 * Algorithm: pure in-memory inversion of asiento #4 output.
 *   For each line: swap debit ↔ credit, preserve accountId + description.
 *   Totals: swap totalDebit ↔ totalCredit.
 *
 * Empty input → empty output (asiento #5 skipped if #4 skipped).
 *
 * CAN-5.1 property: for any synthetic asiento #4 input, the output
 * satisfies a bijection — every line has swapped sides + same amounts,
 * and totals swap.
 *
 * Declared failure mode: "Cannot find module '../../application/
 * apertura-line.builder'".
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { buildAperturaLines } from "../../application/apertura-line.builder";
import type { BalanceCloseBuilderOutput } from "../../application/balance-close-line.builder";

const ZERO = new Decimal(0);

function makeA4Output(
  lines: Array<{ accountId: string; debit: string; credit: string }>,
): BalanceCloseBuilderOutput {
  const mapped = lines.map((l) => ({
    accountId: l.accountId,
    debit: new Decimal(l.debit),
    credit: new Decimal(l.credit),
  }));
  return {
    lines: mapped,
    totalDebit: mapped.reduce((s, l) => s.plus(l.debit), ZERO),
    totalCredit: mapped.reduce((s, l) => s.plus(l.credit), ZERO),
  };
}

describe("apertura-line.builder (asiento #5 — CAN-5.1 bijection)", () => {
  it("empty #4 → empty #5 (CAN-5.4 cascade)", () => {
    const out = buildAperturaLines({
      lines: [],
      totalDebit: ZERO,
      totalCredit: ZERO,
    });
    expect(out.lines).toEqual([]);
    expect(out.totalDebit.equals(ZERO)).toBe(true);
    expect(out.totalCredit.equals(ZERO)).toBe(true);
  });

  it("single-line bijection (DEBE → CREDIT)", () => {
    const a4 = makeA4Output([
      { accountId: "acc_caja", debit: "0", credit: "520" },
    ]);
    const a5 = buildAperturaLines(a4);
    expect(a5.lines).toHaveLength(1);
    expect(a5.lines[0].accountId).toBe("acc_caja");
    expect(a5.lines[0].debit.equals(new Decimal("520"))).toBe(true);
    expect(a5.lines[0].credit.equals(ZERO)).toBe(true);
    expect(a5.totalDebit.equals(a4.totalCredit)).toBe(true);
    expect(a5.totalCredit.equals(a4.totalDebit)).toBe(true);
  });

  it("multi-line bijection (full balance-sheet inversion)", () => {
    const a4 = makeA4Output([
      { accountId: "acc_caja", debit: "0", credit: "520" },
      { accountId: "acc_bancos", debit: "0", credit: "1700" },
      { accountId: "acc_cxp", debit: "4600", credit: "0" },
      { accountId: "acc_321", debit: "1230", credit: "0" },
    ]);
    const a5 = buildAperturaLines(a4);
    expect(a5.lines).toHaveLength(4);
    for (let i = 0; i < a4.lines.length; i++) {
      expect(a5.lines[i].accountId).toBe(a4.lines[i].accountId);
      expect(a5.lines[i].debit.equals(a4.lines[i].credit)).toBe(true);
      expect(a5.lines[i].credit.equals(a4.lines[i].debit)).toBe(true);
    }
    expect(a5.totalDebit.equals(a4.totalCredit)).toBe(true);
    expect(a5.totalCredit.equals(a4.totalDebit)).toBe(true);
  });

  // CAN-5.1 property-based sentinel — 10+ random synthetic inputs.
  it("CAN-5.1 bijection holds across 10 random synthetic asiento #4 line sets", () => {
    const rand = (n: number) => Math.floor(Math.random() * n);
    for (let trial = 0; trial < 10; trial++) {
      const lineCount = 2 + rand(8); // 2..9 lines
      const a4Lines = Array.from({ length: lineCount }, (_, i) => {
        const debit = rand(2) === 0 ? "0" : String(100 + rand(10000));
        const credit = debit === "0" ? String(100 + rand(10000)) : "0";
        return { accountId: `acc_${trial}_${i}`, debit, credit };
      });
      const a4 = makeA4Output(a4Lines);
      const a5 = buildAperturaLines(a4);

      // CAN-5.1: per-line bijection
      expect(a5.lines).toHaveLength(a4.lines.length);
      for (let i = 0; i < a4.lines.length; i++) {
        expect(a5.lines[i].accountId).toBe(a4.lines[i].accountId);
        expect(a5.lines[i].debit.equals(a4.lines[i].credit)).toBe(true);
        expect(a5.lines[i].credit.equals(a4.lines[i].debit)).toBe(true);
      }
      // Totals swap
      expect(a5.totalDebit.equals(a4.totalCredit)).toBe(true);
      expect(a5.totalCredit.equals(a4.totalDebit)).toBe(true);
    }
  });
});
