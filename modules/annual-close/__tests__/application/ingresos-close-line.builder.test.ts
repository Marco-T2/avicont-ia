/**
 * T-11 RED — ingresos-close-line.builder (asiento #2).
 *
 * REQ refs: REQ-A.2 (Cerrar Ingresos) + CAN-5.4 + DEC-1 + W-6.
 * Cross-ref: spec #2697 REQ-A.2 / design #2696 §Builders.
 *
 * Algorithm mirrors gastos with INGRESO type filter and opposite balancing
 * direction: ingresos closed on DEBE side of each account; balancing HABER
 * on 3.2.2 (revenue credits the result account).
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *   `Cannot find module '../../application/ingresos-close-line.builder'` —
 *   file does not exist at HEAD 25200ae2.
 */

import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";

import { buildIngresosCloseLines } from "../../application/ingresos-close-line.builder";
import type { YearAggregatedLine } from "../../domain/ports/year-accounting-reader-tx.port";

const ZERO = new Decimal(0);

function makeLine(overrides: Partial<YearAggregatedLine>): YearAggregatedLine {
  return {
    accountId: "acc_ingreso",
    code: "4.1.1",
    nature: "ACREEDORA",
    type: "INGRESO",
    subtype: null,
    debit: ZERO,
    credit: ZERO,
    ...overrides,
  };
}

const RESULT_ACC = { id: "acc_322", nature: "ACREEDORA" as const };

describe("ingresos-close-line.builder (asiento #2 — REQ-A.2)", () => {
  it("empty input → empty lines (CAN-5.4 SKIP-on-zero)", () => {
    const out = buildIngresosCloseLines([], RESULT_ACC);
    expect(out.lines).toEqual([]);
    expect(out.totalDebit.equals(ZERO)).toBe(true);
  });

  it("INGRESO ACREEDORA with credit-balance → DEBE on account + HABER on 3.2.2", () => {
    const out = buildIngresosCloseLines(
      [
        makeLine({
          accountId: "acc_ventas",
          credit: new Decimal("3610"),
        }),
      ],
      RESULT_ACC,
    );
    expect(out.lines).toHaveLength(2);
    const ventas = out.lines.find((l) => l.accountId === "acc_ventas")!;
    expect(ventas.debit.equals(new Decimal("3610"))).toBe(true);
    expect(ventas.credit.equals(ZERO)).toBe(true);
    const result = out.lines.find((l) => l.accountId === "acc_322")!;
    expect(result.credit.equals(new Decimal("3610"))).toBe(true);
    expect(result.debit.equals(ZERO)).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
  });

  it("anomaly: INGRESO ACREEDORA with debit-balance → HABER same side + DEBE on 3.2.2", () => {
    const out = buildIngresosCloseLines(
      [
        makeLine({
          accountId: "acc_refund",
          debit: new Decimal("100"),
          credit: ZERO,
        }),
      ],
      RESULT_ACC,
    );
    const refund = out.lines.find((l) => l.accountId === "acc_refund")!;
    expect(refund.credit.equals(new Decimal("100"))).toBe(true);
    expect(refund.debit.equals(ZERO)).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
  });

  it("multi-leaf accumulates to single 3.2.2 balancing HABER line", () => {
    const out = buildIngresosCloseLines(
      [
        makeLine({ accountId: "acc_a", credit: new Decimal("100") }),
        makeLine({ accountId: "acc_b", credit: new Decimal("250") }),
      ],
      RESULT_ACC,
    );
    expect(out.lines).toHaveLength(3);
    const result = out.lines.find((l) => l.accountId === "acc_322")!;
    expect(result.credit.equals(new Decimal("350"))).toBe(true);
  });

  it("filters non-INGRESO leaves (defensive)", () => {
    const out = buildIngresosCloseLines(
      [
        makeLine({
          accountId: "acc_gasto",
          nature: "DEUDORA",
          type: "GASTO",
          debit: new Decimal("999"),
        }),
      ],
      RESULT_ACC,
    );
    expect(out.lines).toEqual([]);
  });

  it("zero-net INGRESO → skipped", () => {
    const out = buildIngresosCloseLines(
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
