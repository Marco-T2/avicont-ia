/**
 * T02 — RED: Column mapping tests.
 * T03 will extend this file with builder fixture tests.
 *
 * Covers: REQ-1 (column mapping by account code prefix)
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const D = (v: string | number) => new Prisma.Decimal(String(v));

describe("mapAccountCodeToColumn — longest-prefix-wins", () => {
  it("'3.1.4' → CAPITAL_SOCIAL", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.1.4")).toBe("CAPITAL_SOCIAL");
  });

  it("'3.2.1' → APORTES_CAPITALIZAR (NOT AJUSTE_CAPITAL)", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.2.1")).toBe("APORTES_CAPITALIZAR");
    expect(mapAccountCodeToColumn("3.2.1")).not.toBe("AJUSTE_CAPITAL");
  });

  it("'3.2.5' → AJUSTE_CAPITAL", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.2.5")).toBe("AJUSTE_CAPITAL");
  });

  it("'3.3.2' → RESERVA_LEGAL", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.3.2")).toBe("RESERVA_LEGAL");
  });

  it("'3.4.1' → RESULTADOS_ACUMULADOS", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.4.1")).toBe("RESULTADOS_ACUMULADOS");
  });

  it("'3.5.1' → RESULTADOS_ACUMULADOS", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.5.1")).toBe("RESULTADOS_ACUMULADOS");
  });

  it("'3.9.1' (no match) → OTROS_PATRIMONIO", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.9.1")).toBe("OTROS_PATRIMONIO");
  });

  it("COLUMNS_ORDER has exactly 6 elements in canonical order", async () => {
    const { COLUMNS_ORDER } = await import("../equity-statement.builder");
    expect(COLUMNS_ORDER).toHaveLength(6);
    expect(COLUMNS_ORDER[0]).toBe("CAPITAL_SOCIAL");
    expect(COLUMNS_ORDER[1]).toBe("APORTES_CAPITALIZAR");
    expect(COLUMNS_ORDER[2]).toBe("AJUSTE_CAPITAL");
    expect(COLUMNS_ORDER[3]).toBe("RESERVA_LEGAL");
    expect(COLUMNS_ORDER[4]).toBe("RESULTADOS_ACUMULADOS");
    expect(COLUMNS_ORDER[5]).toBe("OTROS_PATRIMONIO");
  });
});

// ── buildEquityStatement fixtures ─────────────────────────────────────────────

describe("buildEquityStatement", () => {
  const D = (v: string | number) => new Prisma.Decimal(String(v));

  const capitalAccount = { id: "acc-capital", code: "3.1.1", name: "Capital Social",  nature: "ACREEDORA" as const };
  const reservaAccount = { id: "acc-reserva", code: "3.3.1", name: "Reserva Legal",   nature: "ACREEDORA" as const };
  const resultadosAccount = { id: "acc-res",  code: "3.4.1", name: "Resultados Acum.", nature: "ACREEDORA" as const };
  const otrosAccount = { id: "acc-otros",     code: "3.9.1", name: "Otros Patrimonio", nature: "ACREEDORA" as const };

  function makeInput(overrides: Record<string, unknown> = {}) {
    return {
      initialBalances: new Map<string, Prisma.Decimal>(),
      finalBalances: new Map<string, Prisma.Decimal>(),
      accounts: [capitalAccount],
      typedMovements: new Map(),
      periodResult: D("0"),
      dateFrom: new Date("2024-01-01"),
      dateTo: new Date("2024-12-31"),
      preliminary: false,
      ...overrides,
    };
  }

  it("1. output has exactly 3 rows with correct labels in order", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput());
    expect(stmt.rows).toHaveLength(3);
    expect(stmt.rows[0].label).toBe("Saldo al inicio del período");
    expect(stmt.rows[1].label).toBe("Resultado del ejercicio");
    expect(stmt.rows[2].label).toBe("Saldo al cierre del período");
    expect(stmt.rows[0].key).toBe("SALDO_INICIAL");
    expect(stmt.rows[1].key).toBe("RESULTADO_EJERCICIO");
    expect(stmt.rows[2].key).toBe("SALDO_FINAL");
  });

  it("2. account 3.1.x balance ends in CAPITAL_SOCIAL column of SALDO_INICIAL row", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const balances = new Map([["acc-capital", D("5000")]]);
    const stmt = buildEquityStatement(makeInput({ initialBalances: balances }));
    const cell = stmt.rows[0].cells.find((c) => c.column === "CAPITAL_SOCIAL");
    expect(cell?.amount.equals(D("5000"))).toBe(true);
  });

  it("3. OTROS_PATRIMONIO invisible when all accounts map to official F-605 columns", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount],
      initialBalances: new Map([["acc-capital", D("1000")]]),
      finalBalances: new Map([["acc-capital", D("1500")]]),
      periodResult: D("500"),
    }));
    const otros = stmt.columns.find((c) => c.key === "OTROS_PATRIMONIO");
    expect(otros?.visible).toBe(false);
  });

  it("4. OTROS_PATRIMONIO visible when account 3.9.1 has balance", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount, otrosAccount],
      initialBalances: new Map([["acc-otros", D("300")]]),
      finalBalances: new Map([["acc-otros", D("300")]]),
      periodResult: D("0"),
    }));
    const otros = stmt.columns.find((c) => c.key === "OTROS_PATRIMONIO");
    expect(otros?.visible).toBe(true);
    const cell = stmt.rows[0].cells.find((c) => c.column === "OTROS_PATRIMONIO");
    expect(cell?.amount.equals(D("300"))).toBe(true);
  });

  it("5. periodResult goes entirely to RESULTADOS_ACUMULADOS; all other result cells are zero", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount, resultadosAccount],
      periodResult: D("7500"),
    }));
    const resultRow = stmt.rows[1];
    const resCell = resultRow.cells.find((c) => c.column === "RESULTADOS_ACUMULADOS");
    expect(resCell?.amount.equals(D("7500"))).toBe(true);
    for (const cell of resultRow.cells) {
      if (cell.column !== "RESULTADOS_ACUMULADOS") {
        expect(cell.amount.isZero()).toBe(true);
      }
    }
  });

  it("6. positive result (utilidad): rows[1].total equals periodResult", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({ periodResult: D("5000") }));
    expect(stmt.rows[1].total.equals(D("5000"))).toBe(true);
  });

  it("7. negative result (pérdida): sign preserved in RESULTADOS_ACUMULADOS cell", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({ periodResult: D("-15000") }));
    const cell = stmt.rows[1].cells.find((c) => c.column === "RESULTADOS_ACUMULADOS");
    expect(cell?.amount.equals(D("-15000"))).toBe(true);
    expect(stmt.rows[1].total.equals(D("-15000"))).toBe(true);
  });

  it("8. imbalanced=false when finalBalances[col] = initialBalances[col] + periodResult_col", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount, resultadosAccount],
      initialBalances: new Map([["acc-capital", D("1000")], ["acc-res", D("500")]]),
      finalBalances:   new Map([["acc-capital", D("1000")], ["acc-res", D("1500")]]),
      periodResult: D("1000"),
    }));
    expect(stmt.imbalanced).toBe(false);
  });

  it("9. imbalanced=true when CAPITAL_SOCIAL final deviates from expected by 100", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount],
      initialBalances: new Map([["acc-capital", D("1000")]]),
      finalBalances:   new Map([["acc-capital", D("1100")]]),
      periodResult: D("0"),
    }));
    expect(stmt.imbalanced).toBe(true);
    expect(stmt.imbalanceDelta.gte(D("100"))).toBe(true);
  });

  it("10. grandTotal = sum of all columnTotals", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const { sumDecimals } = await import("@/features/accounting/financial-statements/money.utils");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount, reservaAccount, resultadosAccount],
      finalBalances: new Map([
        ["acc-capital", D("5000")],
        ["acc-reserva", D("1000")],
        ["acc-res",     D("2000")],
      ]),
    }));
    const totalsSum = sumDecimals(Object.values(stmt.columnTotals));
    expect(stmt.grandTotal.equals(totalsSum)).toBe(true);
  });

  it("11. Decimal precision preserved: imbalanceDelta is exactly 0.01 for 99999999.99 → 100000000.00", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount],
      initialBalances: new Map([["acc-capital", D("99999999.99")]]),
      finalBalances:   new Map([["acc-capital", D("100000000.00")]]),
      periodResult: D("0"),
    }));
    expect(stmt.imbalanceDelta.equals(D("0.01"))).toBe(true);
  });

  it("12. preliminary flag passthrough", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmtPreliminary = buildEquityStatement(makeInput({ preliminary: true }));
    const stmtFinal       = buildEquityStatement(makeInput({ preliminary: false }));
    expect(stmtPreliminary.preliminary).toBe(true);
    expect(stmtFinal.preliminary).toBe(false);
  });

  // ── Economic semantic: SALDO_FINAL projects periodResult for preliminary ─────

  it("13. preliminary=true: SALDO_FINAL[RESULTADOS_ACUMULADOS] projects periodResult when ledger is zero", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [resultadosAccount],
      initialBalances: new Map(),
      finalBalances: new Map(),
      periodResult: D("-551"),
      preliminary: true,
    }));
    const saldoFinal = stmt.rows.find((r) => r.key === "SALDO_FINAL")!;
    const raCell = saldoFinal.cells.find((c) => c.column === "RESULTADOS_ACUMULADOS");
    expect(raCell?.amount.equals(D("-551"))).toBe(true);
    expect(stmt.imbalanced).toBe(false);
  });

  it("14. preliminary=true with direct CAPITAL_SOCIAL movement: RA projects P&L, imbalance captures ONLY the capital movement", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount, resultadosAccount],
      initialBalances: new Map(),
      finalBalances: new Map([["acc-capital", D("200000")]]),
      periodResult: D("-551"),
      preliminary: true,
    }));
    const saldoFinal = stmt.rows.find((r) => r.key === "SALDO_FINAL")!;
    const raCell = saldoFinal.cells.find((c) => c.column === "RESULTADOS_ACUMULADOS");
    const capitalCell = saldoFinal.cells.find((c) => c.column === "CAPITAL_SOCIAL");
    expect(raCell?.amount.equals(D("-551"))).toBe(true);
    expect(capitalCell?.amount.equals(D("200000"))).toBe(true);
    expect(stmt.imbalanced).toBe(true);
    expect(stmt.imbalanceDelta.equals(D("200000"))).toBe(true);
  });

  it("15. preliminary=false: SALDO_FINAL[RESULTADOS_ACUMULADOS] uses ledger balance without projecting (no double-count)", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [resultadosAccount],
      initialBalances: new Map(),
      finalBalances: new Map([["acc-res", D("-551")]]),
      periodResult: D("-551"),
      preliminary: false,
    }));
    const saldoFinal = stmt.rows.find((r) => r.key === "SALDO_FINAL")!;
    const raCell = saldoFinal.cells.find((c) => c.column === "RESULTADOS_ACUMULADOS");
    expect(raCell?.amount.equals(D("-551"))).toBe(true);
    expect(stmt.imbalanced).toBe(false);
  });

  it("16. preliminary=true: grandTotal includes periodResult (economic patrimony)", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount],
      initialBalances: new Map([["acc-capital", D("100000")]]),
      finalBalances: new Map([["acc-capital", D("100000")]]),
      periodResult: D("-551"),
      preliminary: true,
    }));
    expect(stmt.grandTotal.equals(D("99449"))).toBe(true);
  });

  // ── Batch 5: typed rows + invariant + projection bypass ──────────────────────

  it("REQ-1-S1 — CP 200k → fila APORTE_CAPITAL con 200k en CAPITAL_SOCIAL", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount],
      initialBalances: new Map(),
      finalBalances: new Map([["acc-capital", D("200000")]]),
      typedMovements: new Map([
        ["CP", new Map([["acc-capital", D("200000")]])],
      ]),
      periodResult: D("0"),
    }));
    const row = stmt.rows.find((r) => r.key === "APORTE_CAPITAL");
    expect(row).toBeDefined();
    expect(row!.label).toBe("Aportes de capital del período");
    const cell = row!.cells.find((c) => c.column === "CAPITAL_SOCIAL");
    expect(cell?.amount.equals(D("200000"))).toBe(true);
    // other cells in the typed row should be zero
    for (const c of row!.cells) {
      if (c.column !== "CAPITAL_SOCIAL") expect(c.amount.isZero()).toBe(true);
    }
  });

  it("REQ-1-S2 — typedMovements vacío → 3 filas v1 (SALDO_INICIAL, RESULTADO_EJERCICIO, SALDO_FINAL)", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount],
      typedMovements: new Map(),
    }));
    expect(stmt.rows).toHaveLength(3);
    expect(stmt.rows.map((r) => r.key)).toEqual([
      "SALDO_INICIAL",
      "RESULTADO_EJERCICIO",
      "SALDO_FINAL",
    ]);
  });

  it("REQ-2-S1 — CP+CL+CV + resultado → 6 filas en orden canónico", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount, reservaAccount, resultadosAccount],
      initialBalances: new Map(),
      finalBalances: new Map([
        ["acc-capital", D("200000")],
        ["acc-reserva", D("30000")],
        ["acc-res",     D("-50000")],
      ]),
      typedMovements: new Map<
        "CP" | "CL" | "CV",
        Map<string, Prisma.Decimal>
      >([
        ["CP", new Map([["acc-capital", D("200000")]])],
        ["CL", new Map([["acc-reserva", D("30000")]])],
        ["CV", new Map([["acc-res",     D("-50000")]])],
      ]),
      periodResult: D("0"),
    }));
    expect(stmt.rows.map((r) => r.key)).toEqual([
      "SALDO_INICIAL",
      "APORTE_CAPITAL",
      "CONSTITUCION_RESERVA",
      "DISTRIBUCION_DIVIDENDO",
      "RESULTADO_EJERCICIO",
      "SALDO_FINAL",
    ]);
  });

  it("REQ-2-S2 — solo CP → 4 filas (SALDO_INICIAL, APORTE_CAPITAL, RESULTADO_EJERCICIO, SALDO_FINAL)", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount],
      initialBalances: new Map(),
      finalBalances: new Map([["acc-capital", D("200000")]]),
      typedMovements: new Map([
        ["CP", new Map([["acc-capital", D("200000")]])],
      ]),
      periodResult: D("0"),
    }));
    expect(stmt.rows.map((r) => r.key)).toEqual([
      "SALDO_INICIAL",
      "APORTE_CAPITAL",
      "RESULTADO_EJERCICIO",
      "SALDO_FINAL",
    ]);
  });

  it("REQ-3-S1 — CP 200k tipado con finalBalance coherente → imbalanced=false", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount],
      initialBalances: new Map(),
      finalBalances: new Map([["acc-capital", D("200000")]]),
      typedMovements: new Map([
        ["CP", new Map([["acc-capital", D("200000")]])],
      ]),
      periodResult: D("0"),
    }));
    expect(stmt.imbalanced).toBe(false);
    expect(stmt.imbalanceDelta.isZero()).toBe(true);
  });

  it("REQ-3-S2 — 200k sin voucher tipado (delta huérfano) → imbalanced=true, delta=200k", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [capitalAccount],
      initialBalances: new Map(),
      finalBalances: new Map([["acc-capital", D("200000")]]),
      typedMovements: new Map(),
      periodResult: D("0"),
      preliminary: false,
    }));
    expect(stmt.imbalanced).toBe(true);
    expect(stmt.imbalanceDelta.equals(D("200000"))).toBe(true);
  });

  it("REQ-4 — CV débito a 3.4 por 50k → fila DISTRIBUCION_DIVIDENDO con −50k en RESULTADOS_ACUMULADOS", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [resultadosAccount],
      initialBalances: new Map([["acc-res", D("100000")]]),
      finalBalances:   new Map([["acc-res", D("50000")]]),
      typedMovements: new Map([
        ["CV", new Map([["acc-res", D("-50000")]])],
      ]),
      periodResult: D("0"),
      preliminary: false,
    }));
    const row = stmt.rows.find((r) => r.key === "DISTRIBUCION_DIVIDENDO");
    expect(row).toBeDefined();
    expect(row!.label).toBe("Distribuciones a socios");
    const raCell = row!.cells.find((c) => c.column === "RESULTADOS_ACUMULADOS");
    expect(raCell?.amount.equals(D("-50000"))).toBe(true);
    expect(stmt.imbalanced).toBe(false);
  });

  it("REQ-5 — CV presente + preliminary=true → SALDO_FINAL[RA] NO proyecta periodResult (usa ledger)", async () => {
    const { buildEquityStatement } = await import("../equity-statement.builder");
    const stmt = buildEquityStatement(makeInput({
      accounts: [resultadosAccount],
      initialBalances: new Map([["acc-res", D("100000")]]),
      finalBalances:   new Map([["acc-res", D("50000")]]),
      typedMovements: new Map([
        ["CV", new Map([["acc-res", D("-50000")]])],
      ]),
      periodResult: D("-551"),
      preliminary: true,
    }));
    const saldoFinal = stmt.rows.find((r) => r.key === "SALDO_FINAL")!;
    const raCell = saldoFinal.cells.find((c) => c.column === "RESULTADOS_ACUMULADOS");
    // Sin CV: ledger 50000 + projected -551 = 49449. Con CV: bypass → 50000 pelado.
    expect(raCell?.amount.equals(D("50000"))).toBe(true);
  });
});
