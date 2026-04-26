import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import {
  curateIncomeStatementForLLM,
  checkIncomeStatementTriviality,
  formatIncomeStatementUserMessage,
  INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT,
} from "../income-statement-analysis.prompt";
import type {
  BalanceSheetCurrent,
  IncomeStatementCurrent,
  SubtypeGroup,
} from "@/features/accounting/financial-statements/financial-statements.types";

const D = (v: string | number) => new Prisma.Decimal(v);
const ZERO = D(0);

function group(
  subtype: AccountSubtype,
  label: string,
  accounts: SubtypeGroup["accounts"],
): SubtypeGroup {
  const total = accounts.reduce<Prisma.Decimal>(
    (acc, a) => (a.isContra ? acc.minus(a.balance) : acc.plus(a.balance)),
    ZERO,
  );
  return { subtype, label, accounts, total };
}

function emptyIs(overrides: Partial<IncomeStatementCurrent> = {}): IncomeStatementCurrent {
  return {
    dateFrom: new Date("2026-01-01T00:00:00Z"),
    dateTo: new Date("2026-06-30T00:00:00Z"),
    income: { groups: [], total: ZERO },
    expenses: { groups: [], total: ZERO },
    operatingIncome: ZERO,
    netIncome: ZERO,
    preliminary: false,
    ...overrides,
  };
}

function emptyBg(overrides: Partial<BalanceSheetCurrent> = {}): BalanceSheetCurrent {
  return {
    asOfDate: new Date("2026-06-30T00:00:00Z"),
    assets: { groups: [], total: ZERO },
    liabilities: { groups: [], total: ZERO },
    equity: { groups: [], total: ZERO, retainedEarningsOfPeriod: ZERO },
    imbalanced: false,
    imbalanceDelta: ZERO,
    preliminary: false,
    ...overrides,
  };
}

// ── Fixture: caso saludable representativo de asociación avícola ──

function healthyIs(): IncomeStatementCurrent {
  const ingOp = group(AccountSubtype.INGRESO_OPERATIVO, "Ingresos Operativos", [
    { accountId: "i1", code: "4.1.01", name: "Venta de pollo en pie", balance: D("1200000") },
    { accountId: "i2", code: "4.1.02", name: "Venta de huevo de mesa", balance: D("380000") },
    { accountId: "i3", code: "4.1.03", name: "Venta de pollo beneficiado", balance: D("220000") },
  ]);
  const ingNoOp = group(AccountSubtype.INGRESO_NO_OPERATIVO, "Otros Ingresos", [
    { accountId: "i4", code: "4.2.01", name: "Subsidios", balance: D("25000") },
    { accountId: "i5", code: "4.2.02", name: "Intereses ganados", balance: D("8000") },
  ]);

  const gOp = group(AccountSubtype.GASTO_OPERATIVO, "Gastos Operativos", [
    { accountId: "g1", code: "5.1.01", name: "Alimento balanceado", balance: D("740000") },
    { accountId: "g2", code: "5.1.02", name: "Pollitos BB", balance: D("180000") },
    { accountId: "g3", code: "5.1.03", name: "Vacunas y sanidad", balance: D("65000") },
    { accountId: "g4", code: "5.1.04", name: "Mano de obra de granjas", balance: D("120000") },
    { accountId: "g5", code: "5.1.05", name: "Servicios de faena", balance: D("55000") },
  ]);
  const gAdm = group(AccountSubtype.GASTO_ADMINISTRATIVO, "Gastos Administrativos", [
    { accountId: "g6", code: "5.2.01", name: "Sueldos administración", balance: D("145000") },
    { accountId: "g7", code: "5.2.02", name: "Servicios públicos", balance: D("38000") },
    { accountId: "g8", code: "5.2.03", name: "Honorarios profesionales", balance: D("28000") },
    { accountId: "g9", code: "5.2.04", name: "Materiales de oficina", balance: D("9500") },
  ]);
  const gFin = group(AccountSubtype.GASTO_FINANCIERO, "Gastos Financieros", [
    { accountId: "g10", code: "5.3.01", name: "Intereses préstamo bancario", balance: D("47000") },
    { accountId: "g11", code: "5.3.02", name: "Comisiones bancarias", balance: D("4200") },
  ]);
  const gNoOp = group(AccountSubtype.GASTO_NO_OPERATIVO, "Otros Gastos", [
    { accountId: "g12", code: "5.4.01", name: "Multas e intereses fiscales", balance: D("3800") },
  ]);

  const incomeTotal = ingOp.total.plus(ingNoOp.total);
  const expensesTotal = gOp.total.plus(gAdm.total).plus(gFin.total).plus(gNoOp.total);

  return {
    dateFrom: new Date("2026-01-01T00:00:00Z"),
    dateTo: new Date("2026-06-30T00:00:00Z"),
    income: { groups: [ingOp, ingNoOp], total: incomeTotal },
    expenses: { groups: [gOp, gAdm, gFin, gNoOp], total: expensesTotal },
    operatingIncome: ingOp.total.minus(gOp.total),
    netIncome: incomeTotal.minus(expensesTotal),
    preliminary: false,
  };
}

function healthyBg(): BalanceSheetCurrent {
  // Sólo importan los totals para los ratios cruzados; el resto es relleno.
  const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
    { accountId: "a1", code: "1.1.1", name: "Caja", balance: D("5300000") },
  ]);
  const eq = group(AccountSubtype.PATRIMONIO_CAPITAL, "Capital", [
    { accountId: "e1", code: "3.1.1", name: "Capital", balance: D("2450000") },
  ]);
  return {
    asOfDate: new Date("2026-06-30T00:00:00Z"),
    assets: { groups: [ac], total: D("5300000") },
    liabilities: { groups: [], total: D("2850000") },
    equity: { groups: [eq], total: D("2450000"), retainedEarningsOfPeriod: ZERO },
    imbalanced: false,
    imbalanceDelta: ZERO,
    preliminary: false,
  };
}

// ── curateIncomeStatementForLLM ──

describe("curateIncomeStatementForLLM", () => {
  it("aplana IS + BG cruzado y omite metadata interna", () => {
    const out = curateIncomeStatementForLLM(healthyIs(), healthyBg());

    expect(out.period.dateFrom).toBe("2026-01-01");
    expect(out.period.dateTo).toBe("2026-06-30");
    expect(out.currency).toBe("BOB");
    expect(out.preliminary === undefined || typeof out.period.preliminary === "boolean").toBe(true);

    // Secciones
    expect(out.income.total).toBe("1.833.000,00");
    expect(out.expenses.total).toBe("1.435.500,00");
    expect(out.income.groups[0].subtypeLabel).toBe("Ingresos Operativos");
    expect(out.income.groups[0].total).toBe("1.800.000,00");
    expect(out.income.groups[0].accounts[0]).toEqual({
      code: "4.1.01",
      name: "Venta de pollo en pie",
      amount: "1.200.000,00",
    });

    // Subtotales
    expect(out.subtotals.operatingRevenue).toBe("1.800.000,00");
    expect(out.subtotals.operatingIncome).toBe("640.000,00");
    expect(out.subtotals.netIncome).toBe("397.500,00");
    expect(out.subtotals.financialExpenses).toBe("51.200,00");

    // Cross BG
    expect(out.crossBalanceSheet.asOfDate).toBe("2026-06-30");
    expect(out.crossBalanceSheet.totalAssets).toBe("5.300.000,00");
    expect(out.crossBalanceSheet.totalEquity).toBe("2.450.000,00");
    expect(out.crossBalanceSheet.equityIsNegativeOrZero).toBe(false);

    // Sin filtraciones internas
    const flat = JSON.stringify(out);
    expect(flat).not.toContain("retainedEarningsOfPeriod");
    expect(flat).not.toContain("imbalanceDelta");
    expect(flat).not.toContain("accountId");
    expect(flat).not.toContain("orgId");
  });

  it("calcula los seis ratios pre-formateados con coma decimal", () => {
    const out = curateIncomeStatementForLLM(healthyIs(), healthyBg());

    // Margen Operativo = 640.000 / 1.800.000 = 35,5555... → 35,56
    expect(out.ratios.operatingMargin).toMatchObject({
      value: "35,56",
      unit: "percent",
      interpretable: true,
    });
    // Margen Neto = 397.500 / 1.833.000 = 21,6885... → 21,69
    expect(out.ratios.netMargin.value).toBe("21,69");
    // Carga Financiera = 51.200 / 1.833.000 = 2,7933... → 2,79
    expect(out.ratios.financialBurden.value).toBe("2,79");
    // ROA = 397.500 / 5.300.000 = 7,5000 → 7,50
    expect(out.ratios.roa.value).toBe("7,50");
    // ROE = 397.500 / 2.450.000 = 16,2244... → 16,22
    expect(out.ratios.roe.value).toBe("16,22");
    // Rotación = 1.833.000 / 5.300.000 = 0,3458... → 0,35
    expect(out.ratios.assetTurnover).toMatchObject({
      value: "0,35",
      unit: "ratio",
      interpretable: true,
    });
  });

  it("marca hasOperatingLoss=true cuando la utilidad operativa es negativa", () => {
    const is = healthyIs();
    is.operatingIncome = D("-50000");
    const out = curateIncomeStatementForLLM(is, healthyBg());
    expect(out.flags.hasOperatingLoss).toBe(true);
  });

  it("marca hasOperatingLoss=false cuando la utilidad operativa es positiva o cero", () => {
    const out = curateIncomeStatementForLLM(healthyIs(), healthyBg());
    expect(out.flags.hasOperatingLoss).toBe(false);

    const is = healthyIs();
    is.operatingIncome = ZERO;
    const out2 = curateIncomeStatementForLLM(is, healthyBg());
    expect(out2.flags.hasOperatingLoss).toBe(false);
  });

  it("marca crossBalanceSheetImbalanced=true cuando el BG cruzado tiene descuadre menor", () => {
    const bg = healthyBg();
    bg.imbalanced = true;
    bg.imbalanceDelta = D("100000"); // <10% sobre 5.300.000 → no triviality, sí flag
    const out = curateIncomeStatementForLLM(healthyIs(), bg);
    expect(out.flags.crossBalanceSheetImbalanced).toBe(true);
  });

  it("ROE marcado No interpretable cuando equity ≤ 0, con razón", () => {
    const bg = healthyBg();
    bg.equity = { ...bg.equity, total: D("-100000") };
    const out = curateIncomeStatementForLLM(healthyIs(), bg);
    expect(out.ratios.roe.interpretable).toBe(false);
    expect(out.ratios.roe.value).toBe("No interpretable");
    expect(out.ratios.roe.reasonNotInterpretable).toContain("Patrimonio");
    expect(out.crossBalanceSheet.equityIsNegativeOrZero).toBe(true);
  });

  it("ROE marcado No interpretable cuando equity = 0", () => {
    const bg = healthyBg();
    bg.equity = { ...bg.equity, total: ZERO };
    const out = curateIncomeStatementForLLM(healthyIs(), bg);
    expect(out.ratios.roe.interpretable).toBe(false);
    expect(out.crossBalanceSheet.equityIsNegativeOrZero).toBe(true);
  });

  it("Margen Operativo marcado No interpretable cuando ingresos operativos = 0", () => {
    const is = healthyIs();
    // Vaciar INGRESO_OPERATIVO conservando otros datos
    is.income = {
      groups: is.income.groups.filter((g) => g.subtype !== AccountSubtype.INGRESO_OPERATIVO),
      total: is.income.total.minus(
        is.income.groups.find((g) => g.subtype === AccountSubtype.INGRESO_OPERATIVO)!.total,
      ),
    };
    const out = curateIncomeStatementForLLM(is, healthyBg());
    expect(out.ratios.operatingMargin.interpretable).toBe(false);
    expect(out.subtotals.operatingRevenue).toBe("0,00");
  });

  it("ROA marcado No interpretable cuando activo total = 0", () => {
    const bg = healthyBg();
    bg.assets = { groups: [], total: ZERO };
    const is = healthyIs();
    // Forzamos ingresos no-cero, así pasa la triviality (no se invoca aquí)
    const out = curateIncomeStatementForLLM(is, bg);
    expect(out.ratios.roa.interpretable).toBe(false);
    expect(out.ratios.assetTurnover.interpretable).toBe(false);
  });

  it("formatea monto negativo con signo, separador de miles y coma decimal", () => {
    const ingNeg = group(AccountSubtype.INGRESO_NO_OPERATIVO, "Otros Ingresos", [
      { accountId: "i1", code: "4.2.99", name: "Ajuste por reverso", balance: D("-1234.5") },
    ]);
    const is = emptyIs({
      income: { groups: [ingNeg], total: ingNeg.total },
      operatingIncome: ZERO,
      netIncome: ingNeg.total,
    });
    const out = curateIncomeStatementForLLM(is, healthyBg());
    expect(out.income.groups[0].accounts[0].amount).toBe("-1.234,50");
  });
});

// ── checkIncomeStatementTriviality ──

describe("checkIncomeStatementTriviality", () => {
  it("detecta no_activity cuando ingresos y gastos son cero", () => {
    const r = checkIncomeStatementTriviality(emptyIs(), healthyBg());
    expect(r).toEqual({
      trivial: true,
      code: "no_activity",
      reason: expect.stringContaining("no presenta actividad"),
    });
  });

  it("detecta no_revenue cuando hay gastos pero no ingresos", () => {
    const gOp = group(AccountSubtype.GASTO_OPERATIVO, "Gastos", [
      { accountId: "g1", code: "5.1.1", name: "Insumos", balance: D("1000") },
    ]);
    const is = emptyIs({
      expenses: { groups: [gOp], total: gOp.total },
      netIncome: gOp.total.negated(),
    });
    const r = checkIncomeStatementTriviality(is, healthyBg());
    expect(r).toEqual({
      trivial: true,
      code: "no_revenue",
      reason: expect.stringContaining("no presenta ingresos"),
    });
  });

  it("bloquea con imbalanced_bs cuando el BG cruzado tiene descuadre >10%", () => {
    const bg = healthyBg();
    bg.imbalanced = true;
    bg.imbalanceDelta = D("700000"); // 700.000 / 5.300.000 ≈ 13,2% → bloquea
    const r = checkIncomeStatementTriviality(healthyIs(), bg);
    expect(r.trivial).toBe(true);
    if (r.trivial) {
      expect(r.code).toBe("imbalanced_bs");
      expect(r.reason).toContain("descuadre mayor al 10%");
    }
  });

  it("permite descuadre ≤10% (no bloquea, queda como flag)", () => {
    const bg = healthyBg();
    bg.imbalanced = true;
    bg.imbalanceDelta = D("400000"); // 7,5% → no bloquea
    const r = checkIncomeStatementTriviality(healthyIs(), bg);
    expect(r.trivial).toBe(false);
  });

  it("permite IS saludable contra BG balanceado", () => {
    const r = checkIncomeStatementTriviality(healthyIs(), healthyBg());
    expect(r.trivial).toBe(false);
  });

  it("orden de evaluación: no_activity gana sobre imbalanced_bs", () => {
    const bg = healthyBg();
    bg.imbalanced = true;
    bg.imbalanceDelta = D("700000");
    const r = checkIncomeStatementTriviality(emptyIs(), bg);
    expect(r.trivial).toBe(true);
    if (r.trivial) {
      expect(r.code).toBe("no_activity");
    }
  });
});

// ── formatIncomeStatementUserMessage ──

describe("formatIncomeStatementUserMessage", () => {
  it("envuelve el JSON curado en un bloque de código", () => {
    const curated = curateIncomeStatementForLLM(healthyIs(), healthyBg());
    const msg = formatIncomeStatementUserMessage(curated);
    expect(msg).toContain("```json");
    expect(msg).toContain('"dateFrom": "2026-01-01"');
    expect(msg).toContain('"dateTo": "2026-06-30"');
    expect(msg).toContain('"currency": "BOB"');
    expect(msg).toContain('"operatingMargin"');
  });
});

// ── system prompt: anclas críticas ──

describe("INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT", () => {
  it("declara los 6 ratios en el orden estipulado", () => {
    const p = INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT;
    const idxOp = p.indexOf("Margen Operativo");
    const idxNeto = p.indexOf("Margen Neto");
    const idxCarga = p.indexOf("Carga Financiera");
    const idxRoa = p.indexOf("ROA");
    const idxRoe = p.indexOf("ROE");
    const idxRot = p.indexOf("Rotación de Activos");

    expect(idxOp).toBeGreaterThan(0);
    expect(idxNeto).toBeGreaterThan(idxOp);
    expect(idxCarga).toBeGreaterThan(idxNeto);
    expect(idxRoa).toBeGreaterThan(idxCarga);
    expect(idxRoe).toBeGreaterThan(idxRoa);
    expect(idxRot).toBeGreaterThan(idxRoe);
  });

  it("incluye la regla de no recalcular ratios", () => {
    expect(INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT).toContain("NO recalcules los ratios");
  });

  it("incluye el aviso obligatorio sobre punto-en-tiempo", () => {
    expect(INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT).toContain(
      "Para análisis comparativo más preciso, se recomienda promediar saldos de apertura y cierre.",
    );
  });

  it("usa columna Fórmula en la tabla (no Categoría/Puro/Cruzado)", () => {
    const p = INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT;
    expect(p).toContain("Ratio | Fórmula | Valor | Interpretación");
    expect(p).not.toContain("Puro");
    expect(p).not.toContain("Cruzado");
  });

  it("refuerza la regla anti-recomendación con ejemplos sobre Rotación", () => {
    const p = INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT;
    expect(p).toContain("mejorar rotación");
    expect(p).toContain("aumentar productividad");
    expect(p).toContain("rotación baja, consistente con un giro intensivo");
  });

  it("define el idioma como español formal técnico-profesional sin voseo", () => {
    expect(INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT).toContain("español formal técnico-profesional");
    expect(INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT).toContain("No utilices voseo");
  });

  it("guía sobre el umbral del 5% en carga financiera está suavizada (no como verdad absoluta)", () => {
    const p = INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT;
    expect(p).toContain("guía orientativa, no un umbral absoluto");
  });

  it("instruye marcar No interpretable cuando interpretable=false", () => {
    expect(INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT).toContain("No interpretable");
  });
});
