/**
 * T-10 RED — gastos-close-line.builder (asiento #1 of canonical 5).
 *
 * REQ refs: REQ-A.1 (Cerrar Gastos+Costos) + DEC-1.
 * Cross-ref: spec #2697 REQ-A.1 / design #2696 §Builders.
 *
 * Algorithm per design (signed-net):
 *   For each GASTO leaf:
 *     signedNet = (nature==='ACREEDORA') ? credit-debit : debit-credit
 *     signedNet.isZero()  → skip
 *     signedNet.isPositive() → post |net| on OPPOSITE side of nature
 *     signedNet.isNegative() → post |net| on SAME side as nature (anomaly)
 *   Balancing line on `3.2.2 Resultado de la Gestión`:
 *     gastoNet > 0 → DEBE on 3.2.2 = gastoNet (closes gastos against result)
 *
 * SKIP-if-zero: if all GASTO net = 0, returns empty lines.
 * Balance invariant: sum(DEBE) === sum(HABER) via `Decimal.equals` (W-6).
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *   `Cannot find module '../../application/gastos-close-line.builder'` —
 *   file does not exist at HEAD f8cede46. T-10 GREEN creates it.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { buildGastosCloseLines } from "../../application/gastos-close-line.builder";
import type { YearAggregatedLine } from "../../domain/ports/year-accounting-reader-tx.port";

const ZERO = new Decimal(0);

function makeLine(overrides: Partial<YearAggregatedLine>): YearAggregatedLine {
  return {
    accountId: "acc_gasto",
    code: "5.1.1",
    nature: "DEUDORA",
    type: "GASTO",
    subtype: null,
    debit: ZERO,
    credit: ZERO,
    ...overrides,
  };
}

const RESULT_ACC = { id: "acc_322", nature: "ACREEDORA" as const };

describe("gastos-close-line.builder (asiento #1 — REQ-A.1)", () => {
  it("empty input → empty lines + zero totals (SKIP-on-zero CAN-5.4)", () => {
    const out = buildGastosCloseLines([], RESULT_ACC);
    expect(out.lines).toEqual([]);
    expect(out.totalDebit.equals(ZERO)).toBe(true);
    expect(out.totalCredit.equals(ZERO)).toBe(true);
  });

  it("single GASTO leaf normal (DEUDORA, debit-balance) → HABER on account + DEBE on 3.2.2", () => {
    const out = buildGastosCloseLines(
      [
        makeLine({
          accountId: "acc_suel",
          nature: "DEUDORA",
          type: "GASTO",
          debit: new Decimal("100"),
          credit: ZERO,
        }),
      ],
      RESULT_ACC,
    );
    expect(out.lines).toHaveLength(2);
    const sueldos = out.lines.find((l) => l.accountId === "acc_suel")!;
    expect(sueldos.debit.equals(ZERO)).toBe(true);
    expect(sueldos.credit.equals(new Decimal("100"))).toBe(true);
    const result = out.lines.find((l) => l.accountId === "acc_322")!;
    expect(result.debit.equals(new Decimal("100"))).toBe(true);
    expect(result.credit.equals(ZERO)).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
    expect(out.totalDebit.equals(new Decimal("100"))).toBe(true);
  });

  it("anomaly: GASTO DEUDORA with credit-balance → DEBE same side + HABER on 3.2.2", () => {
    const out = buildGastosCloseLines(
      [
        makeLine({
          accountId: "acc_refund",
          nature: "DEUDORA",
          type: "GASTO",
          debit: new Decimal("0"),
          credit: new Decimal("50"),
        }),
      ],
      RESULT_ACC,
    );
    const refund = out.lines.find((l) => l.accountId === "acc_refund")!;
    expect(refund.debit.equals(new Decimal("50"))).toBe(true);
    expect(refund.credit.equals(ZERO)).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
  });

  it("multi-leaf accumulates to a single 3.2.2 balancing line", () => {
    const out = buildGastosCloseLines(
      [
        makeLine({
          accountId: "acc_a",
          debit: new Decimal("100"),
        }),
        makeLine({
          accountId: "acc_b",
          debit: new Decimal("250"),
        }),
      ],
      RESULT_ACC,
    );
    expect(out.lines).toHaveLength(3);
    const result = out.lines.find((l) => l.accountId === "acc_322")!;
    expect(result.debit.equals(new Decimal("350"))).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
  });

  it("filters non-GASTO leaves (defensive vs INGRESO/ACTIVO leaking in)", () => {
    const out = buildGastosCloseLines(
      [
        makeLine({
          accountId: "acc_ingreso",
          nature: "ACREEDORA",
          type: "INGRESO",
          credit: new Decimal("999"),
        }),
        makeLine({
          accountId: "acc_activo",
          nature: "DEUDORA",
          type: "ACTIVO",
          debit: new Decimal("888"),
        }),
      ],
      RESULT_ACC,
    );
    expect(out.lines).toEqual([]);
  });

  it("zero-net GASTO leaf → skipped (no line emitted)", () => {
    const out = buildGastosCloseLines(
      [
        makeLine({
          accountId: "acc_zero",
          debit: new Decimal("100"),
          credit: new Decimal("100"),
        }),
      ],
      RESULT_ACC,
    );
    expect(out.lines).toEqual([]);
  });
});
