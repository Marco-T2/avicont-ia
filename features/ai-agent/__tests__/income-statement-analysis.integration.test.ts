/**
 * Integration test (gated): valida el análisis IA del Estado de Resultados
 * con ratios cruzados contra el LLM real. Construye un IS + BG sintéticos
 * representativos de una asociación avícola con préstamo bancario, llama a
 * Gemini y emite el output completo a stdout para revisión humana.
 *
 * Activación explícita (consume tokens):
 *   RUN_LLM_INTEGRATION=1 pnpm vitest run \
 *     features/ai-agent/__tests__/income-statement-analysis.integration.test.ts
 *
 * Sin la flag, el test se skipea automáticamente.
 */
import "dotenv/config";

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import type {
  BalanceSheetCurrent,
  IncomeStatementCurrent,
  SubtypeGroup,
} from "@/features/accounting/financial-statements/financial-statements.types";

// dotenv puede dejar valores con CR si el .env vino con line endings de
// Windows. Limpiamos antes de que el wrapper LLM lea la API key.
for (const k of Object.keys(process.env)) {
  const v = process.env[k];
  if (typeof v === "string" && v.endsWith("\r")) {
    process.env[k] = v.replace(/\r$/, "");
  }
}

const ENABLED =
  process.env.RUN_LLM_INTEGRATION === "1" && !!process.env.GEMINI_API_KEY;

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

// Fixture: caso saludable representativo de asociación avícola con
// préstamo bancario activo. Primer semestre 2026.
//
// Verificación aritmética manual (todos los ratios calculados a mano):
//  - operatingIncome = 1.800.000 − 1.160.000 = 640.000
//  - netIncome = 1.833.000 − 1.435.500 = 397.500
//  - operatingMargin = 640.000 / 1.800.000 = 35,56%
//  - netMargin = 397.500 / 1.833.000 = 21,69%
//  - financialBurden = 51.200 / 1.833.000 = 2,79%
//  - roa = 397.500 / 5.300.000 = 7,50%
//  - roe = 397.500 / 2.450.000 = 16,22%
//  - assetTurnover = 1.833.000 / 5.300.000 = 0,35

function syntheticIs(): IncomeStatementCurrent {
  const ingOp = group(AccountSubtype.INGRESO_OPERATIVO, "Ingresos Operativos", [
    { accountId: "i1", code: "4.1.01", name: "Venta de pollo en pie", balance: D("1200000") },
    { accountId: "i2", code: "4.1.02", name: "Venta de huevo de mesa", balance: D("380000") },
    { accountId: "i3", code: "4.1.03", name: "Venta de pollo beneficiado", balance: D("220000") },
  ]);
  const ingNoOp = group(AccountSubtype.INGRESO_NO_OPERATIVO, "Otros Ingresos", [
    { accountId: "i4", code: "4.2.01", name: "Subsidios y bonificaciones", balance: D("25000") },
    { accountId: "i5", code: "4.2.02", name: "Intereses ganados sobre depósitos", balance: D("8000") },
  ]);

  const gOp = group(AccountSubtype.GASTO_OPERATIVO, "Gastos Operativos", [
    { accountId: "g1", code: "5.1.01", name: "Alimento balanceado", balance: D("740000") },
    { accountId: "g2", code: "5.1.02", name: "Pollitos BB", balance: D("180000") },
    { accountId: "g3", code: "5.1.03", name: "Vacunas y sanidad animal", balance: D("65000") },
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
    { accountId: "g11", code: "5.3.02", name: "Comisiones y mantenimiento bancario", balance: D("4200") },
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

function syntheticBg(): BalanceSheetCurrent {
  // Sólo importan los totales para los ratios cruzados; estructuramos lo
  // mínimo coherente con un BG real (activos = pasivos + patrimonio).
  const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
    { accountId: "a1", code: "1.1.1", name: "Caja y Bancos", balance: D("950000") },
    { accountId: "a2", code: "1.1.2", name: "Cuentas por Cobrar", balance: D("420000") },
    { accountId: "a3", code: "1.1.3", name: "Inventarios", balance: D("680000") },
  ]);
  const anc = group(AccountSubtype.ACTIVO_NO_CORRIENTE, "Activo No Corriente", [
    { accountId: "a4", code: "1.2.1", name: "Galpones e Instalaciones", balance: D("2700000") },
    { accountId: "a5", code: "1.2.2", name: "Equipos Avícolas", balance: D("550000") },
  ]);

  const pc = group(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", [
    { accountId: "p1", code: "2.1.1", name: "Proveedores", balance: D("520000") },
    { accountId: "p2", code: "2.1.2", name: "Sueldos y Cargas Sociales", balance: D("110000") },
    { accountId: "p3", code: "2.1.3", name: "Impuestos por Pagar", balance: D("220000") },
  ]);
  const pnc = group(AccountSubtype.PASIVO_NO_CORRIENTE, "Pasivo No Corriente", [
    { accountId: "p4", code: "2.2.1", name: "Préstamo Bancario LP — BNB", balance: D("1800000") },
    { accountId: "p5", code: "2.2.2", name: "Préstamo Cooperativa", balance: D("200000") },
  ]);

  const pat = group(AccountSubtype.PATRIMONIO_CAPITAL, "Capital y Aportes", [
    { accountId: "e1", code: "3.1.1", name: "Capital Social — Aportes", balance: D("1900000") },
    { accountId: "e2", code: "3.1.2", name: "Reservas Estatutarias", balance: D("153000") },
  ]);
  const res = group(AccountSubtype.PATRIMONIO_RESULTADOS, "Resultados", [
    { accountId: "e3", code: "3.2.1", name: "Resultado del Ejercicio", balance: D("397000") },
  ]);

  return {
    asOfDate: new Date("2026-06-30T00:00:00Z"),
    assets: { groups: [ac, anc], total: ac.total.plus(anc.total) },
    liabilities: { groups: [pc, pnc], total: pc.total.plus(pnc.total) },
    equity: {
      groups: [pat, res],
      total: pat.total.plus(res.total),
      retainedEarningsOfPeriod: D("397000"),
    },
    imbalanced: false,
    imbalanceDelta: ZERO,
    preliminary: false,
  };
}

describe.skipIf(!ENABLED)("income-statement analysis — integration vs LLM real", () => {
  it("produce un análisis con tabla de los 6 ratios + interpretación + aviso obligatorio", async () => {
    const {
      INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT,
      curateIncomeStatementForLLM,
      formatIncomeStatementUserMessage,
      checkIncomeStatementTriviality,
    } = await import("../income-statement-analysis.prompt");
    const { llmClient } = await import("../llm");

    const is = syntheticIs();
    const bg = syntheticBg();

    const triviality = checkIncomeStatementTriviality(is, bg);
    expect(triviality.trivial).toBe(false);

    const curated = curateIncomeStatementForLLM(is, bg);

    // Sanity-check: aritmética del curado coincide con cálculos manuales.
    expect(curated.subtotals.operatingIncome).toBe("640.000,00");
    expect(curated.subtotals.netIncome).toBe("397.500,00");
    expect(curated.ratios.operatingMargin.value).toBe("35,56");
    expect(curated.ratios.netMargin.value).toBe("21,69");
    expect(curated.ratios.financialBurden.value).toBe("2,79");
    expect(curated.ratios.roa.value).toBe("7,50");
    expect(curated.ratios.roe.value).toBe("16,22");
    expect(curated.ratios.assetTurnover.value).toBe("0,35");

    const userMessage = formatIncomeStatementUserMessage(curated);

    console.log("\n─── JSON CURADO (input al LLM) ───");
    console.log(JSON.stringify(curated, null, 2));

    const startedAt = Date.now();
    const result = await llmClient.query({
      systemPrompt: INCOME_STATEMENT_ANALYSIS_SYSTEM_PROMPT,
      userMessage,
      tools: [],
    });
    const durationMs = Date.now() - startedAt;

    console.log("\n─── RESPUESTA DEL LLM ───");
    console.log(result.text);
    console.log("\n─── METADATA ───");
    console.log({
      durationMs,
      inputTokens: result.usage?.inputTokens,
      outputTokens: result.usage?.outputTokens,
      totalTokens: result.usage?.totalTokens,
    });

    expect(result.text).toBeTruthy();
    // Tabla markdown
    expect(result.text).toContain("|");
    // Los seis ratios deben aparecer
    expect(result.text).toMatch(/Margen Operativo/i);
    expect(result.text).toMatch(/Margen Neto/i);
    expect(result.text).toMatch(/Carga Financiera/i);
    expect(result.text).toMatch(/ROA/i);
    expect(result.text).toMatch(/ROE/i);
    expect(result.text).toMatch(/Rotación de Activos/i);
    // Aviso obligatorio sobre punto-en-tiempo
    expect(result.text).toMatch(/promediar saldos de apertura y cierre/i);
    // Anti-recomendación: no debe contener prescripciones operativas comunes
    expect(result.text).not.toMatch(/mejorar la rotación|aumentar la rotación|mejorar la productividad/i);
  }, 60_000);
});
