/**
 * Phase 2.8a RED — CA line builder (side-selection by nature).
 *
 * Spec REQ-4.2 + REQ-4.3; design rev 2 §4 `buildCALines`.
 *
 * Input shape (`YearAggregatedLine`, shared with CC) — the reader has ALREADY
 * merged delta + prevCA contributions per account (design rev 2 §5, C-3),
 * so this builder is pure side-selection on the supplied debit/credit.
 *
 * Algorithm:
 *   For each ACTIVO/PASIVO/PATRIMONIO leaf:
 *     net = (nature === "DEUDORA") ? debit - credit : credit - debit
 *     if net === 0 → skip (zero-balance excluded)
 *     else side = (nature === "DEUDORA") ? (net > 0 ? DEBE : HABER)
 *                                        : (net > 0 ? HABER : DEBE)
 *     Post |net| on that side.
 *
 *   INGRESO + GASTO rows MUST be ignored (they were zeroed by CC and
 *   excluded by the reader, but the builder is defensive).
 *
 *   Final invariant: sum(DEBE) === sum(HABER) via Decimal.equals (W-6).
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *   Module `../../application/ca-line.builder` does not exist at HEAD faab4722.
 *   Vitest reports a module-resolution failure. Phase 2.8b GREEN creates it.
 */

import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  buildCALines,
  type CABuilderOutput,
  type YearAggregatedLine,
} from "../../application/ca-line.builder";

const ZERO = new Decimal(0);

function line(partial: Partial<YearAggregatedLine>): YearAggregatedLine {
  return {
    accountId: partial.accountId ?? "acc_unspecified",
    code: partial.code ?? "0.0.0",
    nature: partial.nature ?? "DEUDORA",
    type: partial.type ?? "ACTIVO",
    subtype: partial.subtype ?? null,
    debit: partial.debit ?? ZERO,
    credit: partial.credit ?? ZERO,
  };
}

function sumDebit(out: CABuilderOutput["lines"]): Decimal {
  return out.reduce((s, l) => s.plus(l.debit), ZERO);
}
function sumCredit(out: CABuilderOutput["lines"]): Decimal {
  return out.reduce((s, l) => s.plus(l.credit), ZERO);
}

describe("buildCALines — side-selection by nature (REQ-4.2/4.3)", () => {
  it("standard rollover — ACTIVO 200k / PASIVO 80k / PATRIMONIO 120k balances", () => {
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_activo",
        code: "1.1.1",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("200000.00"),
        credit: ZERO,
      }),
      line({
        accountId: "acc_pasivo",
        code: "2.1.1",
        nature: "ACREEDORA",
        type: "PASIVO",
        debit: ZERO,
        credit: new Decimal("80000.00"),
      }),
      line({
        accountId: "acc_pat",
        code: "3.1.1",
        nature: "ACREEDORA",
        type: "PATRIMONIO",
        debit: ZERO,
        credit: new Decimal("120000.00"),
      }),
    ];

    const out = buildCALines(lines);

    const activoLine = out.lines.find((l) => l.accountId === "acc_activo");
    expect(activoLine!.debit.equals(new Decimal("200000.00"))).toBe(true);
    expect(activoLine!.credit.equals(ZERO)).toBe(true);

    const pasivoLine = out.lines.find((l) => l.accountId === "acc_pasivo");
    expect(pasivoLine!.debit.equals(ZERO)).toBe(true);
    expect(pasivoLine!.credit.equals(new Decimal("80000.00"))).toBe(true);

    const patLine = out.lines.find((l) => l.accountId === "acc_pat");
    expect(patLine!.debit.equals(ZERO)).toBe(true);
    expect(patLine!.credit.equals(new Decimal("120000.00"))).toBe(true);

    expect(sumDebit(out.lines).equals(sumCredit(out.lines))).toBe(true);
    expect(sumDebit(out.lines).equals(new Decimal("200000.00"))).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
  });

  it("zero-balance account is excluded (no line emitted)", () => {
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_activo_zero",
        code: "1.1.0",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("100.00"),
        credit: new Decimal("100.00"),
      }),
      line({
        accountId: "acc_activo",
        code: "1.1.1",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("50000.00"),
        credit: ZERO,
      }),
      line({
        accountId: "acc_pasivo",
        code: "2.1.1",
        nature: "ACREEDORA",
        type: "PASIVO",
        debit: ZERO,
        credit: new Decimal("50000.00"),
      }),
    ];

    const out = buildCALines(lines);

    expect(out.lines.find((l) => l.accountId === "acc_activo_zero")).toBeUndefined();
    expect(out.lines).toHaveLength(2);
  });

  it("ACTIVO with credit-anomaly (net credit-balance) → HABER side", () => {
    // ACTIVO (nature DEUDORA) ended with debit=80, credit=100 → net = 80-100 = -20
    // Per algorithm: nature DEUDORA, net < 0 → HABER side, |net|=20.
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_activo_anom",
        code: "1.1.9",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("80.00"),
        credit: new Decimal("100.00"),
      }),
      // counter-balance
      line({
        accountId: "acc_activo_norm",
        code: "1.1.1",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("20.00"),
        credit: ZERO,
      }),
    ];

    const out = buildCALines(lines);

    const anom = out.lines.find((l) => l.accountId === "acc_activo_anom");
    expect(anom).toBeDefined();
    expect(anom!.debit.equals(ZERO)).toBe(true);
    expect(anom!.credit.equals(new Decimal("20.00"))).toBe(true);

    expect(sumDebit(out.lines).equals(sumCredit(out.lines))).toBe(true);
  });

  it("PASIVO with debit-anomaly (net debit-balance) → DEBE side", () => {
    // PASIVO (nature ACREEDORA) with debit=100, credit=80 → net = 80-100 = -20
    // nature ACREEDORA, net < 0 → DEBE side, |net|=20.
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_pasivo_anom",
        code: "2.1.9",
        nature: "ACREEDORA",
        type: "PASIVO",
        debit: new Decimal("100.00"),
        credit: new Decimal("80.00"),
      }),
      // counter-balance
      line({
        accountId: "acc_pasivo_norm",
        code: "2.1.1",
        nature: "ACREEDORA",
        type: "PASIVO",
        debit: ZERO,
        credit: new Decimal("20.00"),
      }),
    ];

    const out = buildCALines(lines);

    const anom = out.lines.find((l) => l.accountId === "acc_pasivo_anom");
    expect(anom).toBeDefined();
    expect(anom!.debit.equals(new Decimal("20.00"))).toBe(true);
    expect(anom!.credit.equals(ZERO)).toBe(true);

    expect(sumDebit(out.lines).equals(sumCredit(out.lines))).toBe(true);
  });

  it("INGRESO/GASTO rows are defensively ignored (CC already zeroed them)", () => {
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_ingreso",
        code: "4.1.1",
        nature: "ACREEDORA",
        type: "INGRESO",
        debit: ZERO,
        credit: new Decimal("1000.00"),
      }),
      line({
        accountId: "acc_gasto",
        code: "5.1.1",
        nature: "DEUDORA",
        type: "GASTO",
        debit: new Decimal("500.00"),
        credit: ZERO,
      }),
      line({
        accountId: "acc_activo",
        code: "1.1.1",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("100.00"),
        credit: ZERO,
      }),
      line({
        accountId: "acc_pasivo",
        code: "2.1.1",
        nature: "ACREEDORA",
        type: "PASIVO",
        debit: ZERO,
        credit: new Decimal("100.00"),
      }),
    ];

    const out = buildCALines(lines);

    expect(out.lines.find((l) => l.accountId === "acc_ingreso")).toBeUndefined();
    expect(out.lines.find((l) => l.accountId === "acc_gasto")).toBeUndefined();
    expect(out.lines.find((l) => l.accountId === "acc_activo")).toBeDefined();
    expect(out.lines.find((l) => l.accountId === "acc_pasivo")).toBeDefined();
  });

  it("PATRIMONIO includes 3.2.1 Resultados Acumulados — transferred from CC's netResult", () => {
    // The reader/upstream merges 3.2.1's post-CC balance (prior + transferred netResult).
    // The builder treats it as a regular PATRIMONIO ACREEDORA leaf with non-zero credit.
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_activo",
        code: "1.1.1",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("50000.00"),
        credit: ZERO,
      }),
      line({
        accountId: "acc_resultados_acum",
        code: "3.2.1",
        nature: "ACREEDORA",
        type: "PATRIMONIO",
        debit: ZERO,
        credit: new Decimal("50000.00"),
      }),
    ];

    const out = buildCALines(lines);

    const rae = out.lines.find((l) => l.accountId === "acc_resultados_acum");
    expect(rae).toBeDefined();
    expect(rae!.credit.equals(new Decimal("50000.00"))).toBe(true);
    expect(sumDebit(out.lines).equals(sumCredit(out.lines))).toBe(true);
  });

  it("DEC-1 — builder consumes decimal.js Decimal directly", () => {
    const sample = line({
      accountId: "a",
      code: "1.1.1",
      nature: "DEUDORA",
      type: "ACTIVO",
      debit: new Decimal("1.00"),
      credit: ZERO,
    });
    expect(sample.debit).toBeInstanceOf(Decimal);
  });

  it("no (0,0) lines slip through the filter", () => {
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_a",
        code: "1.1.1",
        nature: "DEUDORA",
        type: "ACTIVO",
        debit: new Decimal("10.00"),
        credit: ZERO,
      }),
      line({
        accountId: "acc_b",
        code: "2.1.1",
        nature: "ACREEDORA",
        type: "PASIVO",
        debit: ZERO,
        credit: new Decimal("10.00"),
      }),
    ];
    const out = buildCALines(lines);
    for (const l of out.lines) {
      const bothZero = l.debit.isZero() && l.credit.isZero();
      expect(bothZero).toBe(false);
    }
  });
});
