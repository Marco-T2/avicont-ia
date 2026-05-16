/**
 * T-13 RED — balance-close-line.builder (asiento #4 — Cerrar Balance).
 *
 * REQ refs: REQ-A.4 + CAN-5.4 + DEC-1 + W-6.
 * Cross-ref: spec #2697 REQ-A.4 / design #2696 §Builders algorithm.
 *
 * Algorithm: For each ACTIVO/PASIVO/PATRIMONIO leaf returned by
 * aggregateBalanceSheetAtYearEnd:
 *   net = (nature==='DEUDORA') ? debit-credit : credit-debit
 *   net > 0 → post |net| on OPPOSITE side of nature (zeros account)
 *   net < 0 → post |net| on SAME side as nature (contra anomaly)
 *   net === 0 → skip
 *
 * SKIP-on-zero CAN-5.4: empty input or all-zero → empty lines (asiento #5
 * also skipped).
 *
 * Declared failure mode: "Cannot find module '../../application/
 * balance-close-line.builder'".
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { buildBalanceCloseLines } from "../../application/balance-close-line.builder";
import type { YearAggregatedLine } from "../../domain/ports/year-accounting-reader-tx.port";

const ZERO = new Decimal(0);

function makeLine(o: Partial<YearAggregatedLine>): YearAggregatedLine {
  return {
    accountId: "acc",
    code: "x",
    nature: "DEUDORA",
    type: "ACTIVO",
    subtype: null,
    debit: ZERO,
    credit: ZERO,
    ...o,
  };
}

describe("balance-close-line.builder (asiento #4 — REQ-A.4)", () => {
  it("empty input → empty (CAN-5.4 cascades to #5 skip)", () => {
    const out = buildBalanceCloseLines([]);
    expect(out.lines).toEqual([]);
    expect(out.totalDebit.equals(ZERO)).toBe(true);
  });

  it("ACTIVO DEUDORA with debit balance → HABER line (zeros account)", () => {
    const out = buildBalanceCloseLines([
      makeLine({
        accountId: "acc_caja",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("5000"),
        credit: ZERO,
      }),
    ]);
    expect(out.lines).toHaveLength(1);
    expect(out.lines[0].credit.equals(new Decimal("5000"))).toBe(true);
    expect(out.lines[0].debit.equals(ZERO)).toBe(true);
    // Single line is unbalanced — but for a single account that's the only
    // expected output. The orchestrator combines balance-sheet lines from
    // the FULL reader output; balance is checked only at the multi-account
    // level. So this test asserts single-account shape; multi-account tests
    // exercise the balance invariant.
  });

  it("multi-account ACTIVO + PASIVO balanced", () => {
    const out = buildBalanceCloseLines([
      makeLine({
        accountId: "acc_a",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("100"),
      }),
      makeLine({
        accountId: "acc_p",
        nature: "ACREEDORA",
        type: "PASIVO",
        credit: new Decimal("100"),
      }),
    ]);
    expect(out.lines).toHaveLength(2);
    const activo = out.lines.find((l) => l.accountId === "acc_a")!;
    expect(activo.credit.equals(new Decimal("100"))).toBe(true);
    const pasivo = out.lines.find((l) => l.accountId === "acc_p")!;
    expect(pasivo.debit.equals(new Decimal("100"))).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
  });

  it("contra anomaly: ACTIVO DEUDORA with credit-balance → DEBE same side", () => {
    const out = buildBalanceCloseLines([
      makeLine({
        accountId: "acc_anom",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: ZERO,
        credit: new Decimal("50"),
      }),
      makeLine({
        accountId: "acc_offset",
        nature: "ACREEDORA",
        type: "PASIVO",
        credit: ZERO,
        debit: new Decimal("50"),
      }),
    ]);
    const anom = out.lines.find((l) => l.accountId === "acc_anom")!;
    expect(anom.debit.equals(new Decimal("50"))).toBe(true);
  });

  it("all-zero accounts → empty output (degenerate empty FY)", () => {
    const out = buildBalanceCloseLines([
      makeLine({
        accountId: "acc_zero",
        debit: ZERO,
        credit: ZERO,
      }),
    ]);
    expect(out.lines).toEqual([]);
  });
});
