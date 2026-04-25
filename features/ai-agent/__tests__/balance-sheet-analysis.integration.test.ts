/**
 * Integration test (gated): valida el análisis IA del Balance General contra
 * el LLM real. Construye un balance sintético representativo, llama a Gemini
 * y emite el output completo a stdout para revisión humana.
 *
 * Activación explícita (consume tokens):
 *   RUN_LLM_INTEGRATION=1 pnpm vitest run \
 *     features/ai-agent/__tests__/balance-sheet-analysis.integration.test.ts
 *
 * Sin la flag, el test se skipea automáticamente.
 */
import "dotenv/config";

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import type {
  BalanceSheet,
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

function syntheticBalance(): BalanceSheet {
  // Asociación de productores avícolas mediana, plan de cuentas estándar BO.
  // Total activo 850.000 Bs, mezcla razonable de corriente / no corriente,
  // pasivo total 420.000, patrimonio 430.000.

  const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
    { accountId: "a1", code: "1.1.1", name: "Caja y Bancos", balance: D("120000") },
    { accountId: "a2", code: "1.1.2", name: "Cuentas por Cobrar Socios", balance: D("85000") },
    { accountId: "a3", code: "1.1.3", name: "Inventario de Alimento Balanceado", balance: D("95000") },
    { accountId: "a4", code: "1.1.4", name: "Inventario de Pollos en Crecimiento", balance: D("60000") },
    { accountId: "a5", code: "1.1.5", name: "Inventario de Insumos Veterinarios", balance: D("15000") },
  ]);

  const anc = group(AccountSubtype.ACTIVO_NO_CORRIENTE, "Activo No Corriente", [
    { accountId: "a6", code: "1.2.1", name: "Galpones", balance: D("450000") },
    { accountId: "a7", code: "1.2.2", name: "Equipos Avícolas", balance: D("110000") },
    {
      accountId: "a8",
      code: "1.2.9",
      name: "Depreciación Acumulada Galpones",
      balance: D("75000"),
      isContra: true,
    },
    {
      accountId: "a9",
      code: "1.2.10",
      name: "Depreciación Acumulada Equipos",
      balance: D("10000"),
      isContra: true,
    },
  ]);

  const pc = group(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", [
    { accountId: "p1", code: "2.1.1", name: "Proveedores Locales", balance: D("140000") },
    { accountId: "p2", code: "2.1.2", name: "Sueldos y Salarios por Pagar", balance: D("28000") },
    { accountId: "p3", code: "2.1.3", name: "Impuestos por Pagar (IUE/IT)", balance: D("32000") },
  ]);

  const pnc = group(AccountSubtype.PASIVO_NO_CORRIENTE, "Pasivo No Corriente", [
    { accountId: "p4", code: "2.2.1", name: "Préstamo Bancario LP — BNB", balance: D("180000") },
    { accountId: "p5", code: "2.2.2", name: "Préstamo Cooperativa de Productores", balance: D("40000") },
  ]);

  const pat = group(AccountSubtype.PATRIMONIO_CAPITAL, "Patrimonio — Capital", [
    { accountId: "e1", code: "3.1.1", name: "Capital Social — Aportes de Socios", balance: D("300000") },
    { accountId: "e2", code: "3.1.2", name: "Reservas Estatutarias", balance: D("45000") },
  ]);

  const res = group(AccountSubtype.PATRIMONIO_RESULTADOS, "Patrimonio — Resultados", [
    { accountId: "e3", code: "3.2.1", name: "Resultados Acumulados", balance: D("32000") },
    { accountId: "e4", code: "3.2.2", name: "Resultado del Ejercicio", balance: D("53000") },
  ]);

  return {
    orgId: "org_synth",
    current: {
      asOfDate: new Date("2026-04-25T00:00:00Z"),
      assets: { groups: [ac, anc], total: ac.total.plus(anc.total) },
      liabilities: { groups: [pc, pnc], total: pc.total.plus(pnc.total) },
      equity: {
        groups: [pat, res],
        total: pat.total.plus(res.total),
        retainedEarningsOfPeriod: D("53000"),
      },
      imbalanced: false,
      imbalanceDelta: ZERO,
      preliminary: false,
    },
  };
}

describe.skipIf(!ENABLED)("balance-sheet analysis — integration vs LLM real", () => {
  it("produce un análisis con tabla de los 5 ratios y párrafos por ratio", async () => {
    const {
      BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT,
      curateBalanceSheetForLLM,
      formatBalanceSheetUserMessage,
      checkBalanceTriviality,
    } = await import("../balance-sheet-analysis.prompt");
    const { llmClient } = await import("../llm");

    const balance = syntheticBalance();
    const triviality = checkBalanceTriviality(balance);
    expect(triviality.trivial).toBe(false);

    const curated = curateBalanceSheetForLLM(balance);
    const userMessage = formatBalanceSheetUserMessage(curated);

    console.log("\n─── JSON CURADO (input al LLM) ───");
    console.log(JSON.stringify(curated, null, 2));

    const startedAt = Date.now();
    const result = await llmClient.query({
      systemPrompt: BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT,
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
    expect(result.text).toMatch(/Liquidez corriente/i);
    expect(result.text).toMatch(/Prueba ácida/i);
    expect(result.text).toMatch(/endeudamiento/i);
    expect(result.text).toMatch(/Capital de trabajo/i);
    // Tabla markdown
    expect(result.text).toContain("|");
  }, 60_000);
});
