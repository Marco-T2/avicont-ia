/**
 * T-12 RED — resultado-close-line.builder (asiento #3 — P&G → 3.2.1).
 *
 * REQ refs: REQ-A.3 + CAN-5.4 + DEC-1 + W-6.
 * Cross-ref: spec #2697 REQ-A.3 / design #2696 §Builders algorithm.
 *
 * Algorithm:
 *   netResult > 0 (profit) → DEBE 3.2.2 net + HABER 3.2.1 net
 *   netResult < 0 (loss)   → HABER 3.2.2 |net| + DEBE 3.2.1 |net|
 *   netResult === 0 → SKIP (returns empty lines)
 *
 * Declared failure mode: "Cannot find module '../../application/
 * resultado-close-line.builder'".
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { buildResultadoCloseLines } from "../../application/resultado-close-line.builder";

const RESULT_ACC = { id: "acc_322", nature: "ACREEDORA" as const };
const ACCUM_ACC = { id: "acc_321", nature: "ACREEDORA" as const };
const ZERO = new Decimal(0);

describe("resultado-close-line.builder (asiento #3 — REQ-A.3)", () => {
  it("profit (net > 0) → DEBE 3.2.2 + HABER 3.2.1", () => {
    const out = buildResultadoCloseLines(
      new Decimal("3000"),
      RESULT_ACC,
      ACCUM_ACC,
    );
    expect(out.lines).toHaveLength(2);
    const r322 = out.lines.find((l) => l.accountId === "acc_322")!;
    expect(r322.debit.equals(new Decimal("3000"))).toBe(true);
    expect(r322.credit.equals(ZERO)).toBe(true);
    const r321 = out.lines.find((l) => l.accountId === "acc_321")!;
    expect(r321.credit.equals(new Decimal("3000"))).toBe(true);
    expect(r321.debit.equals(ZERO)).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
  });

  it("loss (net < 0) → HABER 3.2.2 + DEBE 3.2.1", () => {
    const out = buildResultadoCloseLines(
      new Decimal("-3210"),
      RESULT_ACC,
      ACCUM_ACC,
    );
    expect(out.lines).toHaveLength(2);
    const r322 = out.lines.find((l) => l.accountId === "acc_322")!;
    expect(r322.credit.equals(new Decimal("3210"))).toBe(true);
    expect(r322.debit.equals(ZERO)).toBe(true);
    const r321 = out.lines.find((l) => l.accountId === "acc_321")!;
    expect(r321.debit.equals(new Decimal("3210"))).toBe(true);
    expect(r321.credit.equals(ZERO)).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
  });

  it("break-even (net === 0) → empty lines (CAN-5.4 SKIP-on-zero)", () => {
    const out = buildResultadoCloseLines(ZERO, RESULT_ACC, ACCUM_ACC);
    expect(out.lines).toEqual([]);
    expect(out.totalDebit.equals(ZERO)).toBe(true);
    expect(out.totalCredit.equals(ZERO)).toBe(true);
  });

  it("balance invariant via Decimal.equals (W-6)", () => {
    const out = buildResultadoCloseLines(
      new Decimal("12345.67"),
      RESULT_ACC,
      ACCUM_ACC,
    );
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
  });
});
