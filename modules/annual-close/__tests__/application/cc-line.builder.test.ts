/**
 * Phase 2.7a RED — CC line builder (signed-net algorithm, C-2).
 *
 * Spec REQ-3.3 + REQ-3.4; design rev 2 §4 `buildCCLines`. Cites
 * `modules/accounting/worksheet/domain/worksheet.builder.ts:176` net-balance
 * pattern (`nature`-aware sign).
 *
 * Algorithm (REQ-3.3):
 *   For each INGRESO/GASTO leaf account with (debit, credit) from POSTED
 *   lines across all 12 months of year N, let:
 *     signedNet = (nature === "ACREEDORA")
 *                   ? credit - debit
 *                   : debit - credit;
 *   If signedNet === 0      → skip (no line)
 *   If signedNet > 0        → post |signedNet| on the OPPOSITE side of
 *                              nature (ACR→DEBE, DEU→HABER) — closes account
 *   If signedNet < 0        → post |signedNet| on the SAME side as nature
 *                              (ACR→HABER, DEU→DEBE) — closes contra balance
 *
 *   Balancing line on `3.2.2 Resultado de la Gestión`:
 *     result = sum(ingresoSignedNet) - sum(gastoSignedNet)
 *     if result > 0  → HABER (profit credits the result account)
 *     if result < 0  → DEBE  (loss debits the result account)
 *     if result == 0 → no balancing line
 *
 *   Invariant: sum DEBE === sum HABER bit-perfect via `Decimal.equals`
 *   (W-6 — `money.utils.eq` FORBIDDEN; builder must use `Decimal.equals`).
 *
 * Declared failure mode per [[red_acceptance_failure_mode]]:
 *   Module `../../application/cc-line.builder` does not exist at HEAD 23afcfaf.
 *   Vitest reports a module-resolution failure; no it() block executes.
 *   Phase 2.7b GREEN creates the file.
 */

import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  buildCCLines,
  type CCBuilderInput,
  type YearAggregatedLine,
} from "../../application/cc-line.builder";

const ZERO = new Decimal(0);

function line(partial: Partial<YearAggregatedLine>): YearAggregatedLine {
  return {
    accountId: partial.accountId ?? "acc_unspecified",
    code: partial.code ?? "0.0.0",
    nature: partial.nature ?? "ACREEDORA",
    type: partial.type ?? "INGRESO",
    subtype: partial.subtype ?? null,
    debit: partial.debit ?? ZERO,
    credit: partial.credit ?? ZERO,
  };
}

const RESULT_ACC = {
  id: "acc_result",
  code: "3.2.2",
  nature: "ACREEDORA" as const,
};

function sumDebit(out: CCBuilderInput["lines"]): Decimal {
  return out.reduce((s, l) => s.plus(l.debit), ZERO);
}
function sumCredit(out: CCBuilderInput["lines"]): Decimal {
  return out.reduce((s, l) => s.plus(l.credit), ZERO);
}

describe("buildCCLines — signed-net algorithm (REQ-3.3, C-2)", () => {
  it("profit year — INGRESO 100k vs GASTO 80k → balancing HABER 20k on 3.2.2", () => {
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_ingreso_a",
        code: "4.1.1",
        nature: "ACREEDORA",
        type: "INGRESO",
        debit: ZERO,
        credit: new Decimal("100000.00"),
      }),
      line({
        accountId: "acc_gasto_a",
        code: "5.1.1",
        nature: "DEUDORA",
        type: "GASTO",
        debit: new Decimal("80000.00"),
        credit: ZERO,
      }),
    ];

    const out = buildCCLines(lines, RESULT_ACC);

    // INGRESO closes DEBE (opposite of ACREEDORA): 100k DEBE on ingreso account
    const ingresoLine = out.lines.find((l) => l.accountId === "acc_ingreso_a");
    expect(ingresoLine).toBeDefined();
    expect(ingresoLine!.debit.equals(new Decimal("100000.00"))).toBe(true);
    expect(ingresoLine!.credit.equals(ZERO)).toBe(true);

    // GASTO closes HABER (opposite of DEUDORA): 80k HABER on gasto account
    const gastoLine = out.lines.find((l) => l.accountId === "acc_gasto_a");
    expect(gastoLine).toBeDefined();
    expect(gastoLine!.debit.equals(ZERO)).toBe(true);
    expect(gastoLine!.credit.equals(new Decimal("80000.00"))).toBe(true);

    // Balancing line on 3.2.2 — HABER 20k (profit)
    const balLine = out.lines.find((l) => l.accountId === "acc_result");
    expect(balLine).toBeDefined();
    expect(balLine!.debit.equals(ZERO)).toBe(true);
    expect(balLine!.credit.equals(new Decimal("20000.00"))).toBe(true);

    // Aggregate invariants
    expect(sumDebit(out.lines).equals(sumCredit(out.lines))).toBe(true);
    expect(sumDebit(out.lines).equals(new Decimal("100000.00"))).toBe(true);
    expect(out.totalDebit.equals(out.totalCredit)).toBe(true);
    expect(out.netResult.equals(new Decimal("20000.00"))).toBe(true);
  });

  it("loss year — INGRESO 60k vs GASTO 75k → balancing DEBE 15k on 3.2.2", () => {
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_ingreso_a",
        code: "4.1.1",
        nature: "ACREEDORA",
        type: "INGRESO",
        debit: ZERO,
        credit: new Decimal("60000.00"),
      }),
      line({
        accountId: "acc_gasto_a",
        code: "5.1.1",
        nature: "DEUDORA",
        type: "GASTO",
        debit: new Decimal("75000.00"),
        credit: ZERO,
      }),
    ];

    const out = buildCCLines(lines, RESULT_ACC);

    const balLine = out.lines.find((l) => l.accountId === "acc_result");
    expect(balLine).toBeDefined();
    expect(balLine!.debit.equals(new Decimal("15000.00"))).toBe(true);
    expect(balLine!.credit.equals(ZERO)).toBe(true);

    expect(sumDebit(out.lines).equals(sumCredit(out.lines))).toBe(true);
    expect(sumDebit(out.lines).equals(new Decimal("75000.00"))).toBe(true);
    expect(out.netResult.equals(new Decimal("-15000.00"))).toBe(true);
  });

  it("zero-result year — INGRESO 50k vs GASTO 50k → no balancing line on 3.2.2", () => {
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_ingreso_a",
        code: "4.1.1",
        nature: "ACREEDORA",
        type: "INGRESO",
        debit: ZERO,
        credit: new Decimal("50000.00"),
      }),
      line({
        accountId: "acc_gasto_a",
        code: "5.1.1",
        nature: "DEUDORA",
        type: "GASTO",
        debit: new Decimal("50000.00"),
        credit: ZERO,
      }),
    ];

    const out = buildCCLines(lines, RESULT_ACC);

    expect(out.lines.find((l) => l.accountId === "acc_result")).toBeUndefined();
    expect(sumDebit(out.lines).equals(sumCredit(out.lines))).toBe(true);
    expect(sumDebit(out.lines).equals(new Decimal("50000.00"))).toBe(true);
    expect(out.netResult.equals(ZERO)).toBe(true);
  });

  it("account with zero balance is excluded (no line emitted)", () => {
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_ingreso_zero",
        code: "4.1.0",
        nature: "ACREEDORA",
        type: "INGRESO",
        debit: new Decimal("100.00"),
        credit: new Decimal("100.00"),
      }),
      line({
        accountId: "acc_ingreso_a",
        code: "4.1.1",
        nature: "ACREEDORA",
        type: "INGRESO",
        debit: ZERO,
        credit: new Decimal("100000.00"),
      }),
      line({
        accountId: "acc_gasto_a",
        code: "5.1.1",
        nature: "DEUDORA",
        type: "GASTO",
        debit: new Decimal("100000.00"),
        credit: ZERO,
      }),
    ];

    const out = buildCCLines(lines, RESULT_ACC);

    expect(out.lines.find((l) => l.accountId === "acc_ingreso_zero")).toBeUndefined();
    // Only the two non-zero accounts (and no balancing line — they net to 0)
    expect(out.lines).toHaveLength(2);
  });

  it("INGRESO with debit-anomaly (contra/refund) — posts SAME side as nature", () => {
    // INGRESO (nature ACREEDORA) ended year with debit=120, credit=100 → signedNet = -20
    // Per algorithm: signedNet < 0 → post |signedNet| on SAME side as nature → HABER 20.
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_ingreso_anom",
        code: "4.1.9",
        nature: "ACREEDORA",
        type: "INGRESO",
        debit: new Decimal("120.00"),
        credit: new Decimal("100.00"),
      }),
      // counter-balance with a GASTO so we can assert the result account contribution
      line({
        accountId: "acc_gasto_a",
        code: "5.1.1",
        nature: "DEUDORA",
        type: "GASTO",
        debit: new Decimal("80.00"),
        credit: ZERO,
      }),
    ];

    const out = buildCCLines(lines, RESULT_ACC);

    const anom = out.lines.find((l) => l.accountId === "acc_ingreso_anom");
    expect(anom).toBeDefined();
    expect(anom!.debit.equals(ZERO)).toBe(true);
    expect(anom!.credit.equals(new Decimal("20.00"))).toBe(true);

    // Result: ingresoSignedNet sum = -20; gastoSignedNet sum = 80; result = -20 - 80 = -100 (loss)
    // → DEBE 100 on result account
    const bal = out.lines.find((l) => l.accountId === "acc_result");
    expect(bal).toBeDefined();
    expect(bal!.debit.equals(new Decimal("100.00"))).toBe(true);
    expect(bal!.credit.equals(ZERO)).toBe(true);

    expect(sumDebit(out.lines).equals(sumCredit(out.lines))).toBe(true);
  });

  it("GASTO with credit-anomaly — posts SAME side as nature (DEBE)", () => {
    // GASTO (nature DEUDORA) ended with debit=80, credit=100 → signedNet = -20
    // Per algorithm: signedNet < 0 → post on SAME side as nature → DEBE 20.
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_gasto_anom",
        code: "5.1.9",
        nature: "DEUDORA",
        type: "GASTO",
        debit: new Decimal("80.00"),
        credit: new Decimal("100.00"),
      }),
      // counter-balance — INGRESO 100 to make the year close cleanly
      line({
        accountId: "acc_ingreso_a",
        code: "4.1.1",
        nature: "ACREEDORA",
        type: "INGRESO",
        debit: ZERO,
        credit: new Decimal("100.00"),
      }),
    ];

    const out = buildCCLines(lines, RESULT_ACC);

    const anom = out.lines.find((l) => l.accountId === "acc_gasto_anom");
    expect(anom).toBeDefined();
    expect(anom!.debit.equals(new Decimal("20.00"))).toBe(true);
    expect(anom!.credit.equals(ZERO)).toBe(true);

    // result = ingresoNet(100) - gastoNet(-20) = 120 → profit, HABER 120 on result account
    const bal = out.lines.find((l) => l.accountId === "acc_result");
    expect(bal).toBeDefined();
    expect(bal!.debit.equals(ZERO)).toBe(true);
    expect(bal!.credit.equals(new Decimal("120.00"))).toBe(true);

    expect(sumDebit(out.lines).equals(sumCredit(out.lines))).toBe(true);
  });

  it("DEC-1 — module imports Decimal from decimal.js, not Prisma.Decimal", () => {
    // Smoke check: the test file itself imports Decimal from decimal.js.
    // The sentinel test under modules/annual-close/__tests__/decimal-import.sentinel.test.ts
    // enforces this at the module-tree level. This assertion documents the
    // DEC-1 boundary at the input-shape level for cc-line.builder.
    const sample = line({
      accountId: "a",
      code: "x",
      debit: new Decimal("1.00"),
      credit: ZERO,
    });
    expect(sample.debit).toBeInstanceOf(Decimal);
  });

  it("does not emit a line whose individual debit+credit are both zero", () => {
    // Defensive: if any account survives the signed-net filter with both
    // sides at zero, that is an internal bug (the algorithm should skip
    // before generating such a row).
    const lines: YearAggregatedLine[] = [
      line({
        accountId: "acc_a",
        code: "4.1.1",
        nature: "ACREEDORA",
        type: "INGRESO",
        debit: ZERO,
        credit: new Decimal("10.00"),
      }),
      line({
        accountId: "acc_b",
        code: "5.1.1",
        nature: "DEUDORA",
        type: "GASTO",
        debit: new Decimal("10.00"),
        credit: ZERO,
      }),
    ];
    const out = buildCCLines(lines, RESULT_ACC);
    for (const l of out.lines) {
      const bothZero = l.debit.isZero() && l.credit.isZero();
      expect(bothZero).toBe(false);
    }
  });
});
