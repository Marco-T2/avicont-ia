import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import {
  curateBalanceSheetForLLM,
  checkBalanceTriviality,
  formatBalanceSheetUserMessage,
  BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT,
} from "../balance-sheet-analysis.prompt";
import type {
  BalanceSheet,
  BalanceSheetCurrent,
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

function balanceSheetCurrent(overrides: Partial<BalanceSheetCurrent> = {}): BalanceSheetCurrent {
  return {
    asOfDate: new Date("2026-04-25T00:00:00Z"),
    assets: { groups: [], total: ZERO },
    liabilities: { groups: [], total: ZERO },
    equity: { groups: [], total: ZERO, retainedEarningsOfPeriod: ZERO },
    imbalanced: false,
    imbalanceDelta: ZERO,
    preliminary: false,
    ...overrides,
  };
}

function balanceSheet(current: BalanceSheetCurrent, comparative?: BalanceSheetCurrent): BalanceSheet {
  return { orgId: "org_test", current, comparative };
}

// ── Fixture: balance no trivial, representativo ──

function nonTrivialBalance(): BalanceSheet {
  const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
    { accountId: "a1", code: "1.1.1", name: "Caja y Bancos", balance: D("50000") },
    { accountId: "a2", code: "1.1.4", name: "Inventario de Alimento Balanceado", balance: D("30000") },
  ]);
  const anc = group(AccountSubtype.ACTIVO_NO_CORRIENTE, "Activo No Corriente", [
    { accountId: "a3", code: "1.2.1", name: "Galpones", balance: D("100000") },
    {
      accountId: "a4",
      code: "1.2.9",
      name: "Depreciación Acumulada Galpones",
      balance: D("30000"),
      isContra: true,
    },
  ]);
  const pc = group(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", [
    { accountId: "p1", code: "2.1.1", name: "Proveedores", balance: D("40000") },
  ]);
  const pnc = group(AccountSubtype.PASIVO_NO_CORRIENTE, "Pasivo No Corriente", [
    { accountId: "p2", code: "2.2.1", name: "Préstamo Bancario LP", balance: D("20000") },
  ]);
  const pat = group(AccountSubtype.PATRIMONIO_CAPITAL, "Capital y Aportes", [
    { accountId: "e1", code: "3.1.1", name: "Capital Social", balance: D("80000") },
  ]);
  const res = group(AccountSubtype.PATRIMONIO_RESULTADOS, "Resultados", [
    { accountId: "e2", code: "3.2.1", name: "Resultado del Ejercicio", balance: D("10000") },
  ]);

  return balanceSheet(
    balanceSheetCurrent({
      assets: { groups: [ac, anc], total: ac.total.plus(anc.total) },
      liabilities: { groups: [pc, pnc], total: pc.total.plus(pnc.total) },
      equity: {
        groups: [pat, res],
        total: pat.total.plus(res.total),
        retainedEarningsOfPeriod: D("10000"),
      },
    }),
  );
}

// ── curateBalanceSheetForLLM ──

describe("curateBalanceSheetForLLM", () => {
  it("aplana el BalanceSheet a la forma curada y omite metadata interna", () => {
    const out = curateBalanceSheetForLLM(nonTrivialBalance());

    expect(out.asOfDate).toBe("2026-04-25");
    expect(out.currency).toBe("BOB");
    expect(out.preliminary).toBe(false);
    expect(out.imbalanced).toBe(false);

    expect(out.assets.total).toBe("150.000,00");
    expect(out.assets.groups[0].subtypeLabel).toBe("Activo Corriente");
    expect(out.assets.groups[0].total).toBe("80.000,00");
    expect(out.assets.groups[0].accounts[0]).toEqual({
      code: "1.1.1",
      name: "Caja y Bancos",
      balance: "50.000,00",
    });

    expect(out.liabilities.total).toBe("60.000,00");
    expect(out.equity.total).toBe("90.000,00");

    // No hay retainedEarningsOfPeriod, ni imbalanceDelta, ni accountId, ni orgId.
    const flat = JSON.stringify(out);
    expect(flat).not.toContain("retainedEarningsOfPeriod");
    expect(flat).not.toContain("imbalanceDelta");
    expect(flat).not.toContain("accountId");
    expect(flat).not.toContain("orgId");
  });

  it("preserva la marca isContra en cuentas reductoras", () => {
    const out = curateBalanceSheetForLLM(nonTrivialBalance());
    const anc = out.assets.groups[1];
    expect(anc.subtypeLabel).toBe("Activo No Corriente");
    const dep = anc.accounts.find((a) => a.code === "1.2.9");
    expect(dep?.isContra).toBe(true);
  });

  it("incluye comparative cuando está presente", () => {
    const current = nonTrivialBalance().current;
    const comp = balanceSheetCurrent({
      asOfDate: new Date("2025-04-25T00:00:00Z"),
      assets: { groups: current.assets.groups, total: current.assets.total },
      liabilities: { groups: current.liabilities.groups, total: current.liabilities.total },
      equity: current.equity,
    });

    const out = curateBalanceSheetForLLM(balanceSheet(current, comp));
    expect(out.comparative).toBeDefined();
    expect(out.comparative?.asOfDate).toBe("2025-04-25");
    expect(out.comparative?.assets.total).toBe("150.000,00");
  });

  it("omite comparative cuando no existe en el origen", () => {
    const out = curateBalanceSheetForLLM(nonTrivialBalance());
    expect(out.comparative).toBeUndefined();
  });

  it("formatea balances negativos con signo, separador de miles y coma decimal (formato boliviano)", () => {
    const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
      { accountId: "a1", code: "1.1.1", name: "Caja", balance: D("-1234.5") },
    ]);
    const out = curateBalanceSheetForLLM(
      balanceSheet(
        balanceSheetCurrent({
          assets: { groups: [ac], total: ac.total },
          liabilities: { groups: [], total: ZERO },
          equity: { groups: [], total: ZERO, retainedEarningsOfPeriod: ZERO },
        }),
      ),
    );
    expect(out.assets.groups[0].accounts[0].balance).toBe("-1.234,50");
  });

  it("formatea cifras grandes (millones) con dos puntos de miles", () => {
    const ac = group(AccountSubtype.ACTIVO_NO_CORRIENTE, "Activo No Corriente", [
      { accountId: "a1", code: "1.2.1", name: "Galpones", balance: D("1234567.89") },
    ]);
    const out = curateBalanceSheetForLLM(
      balanceSheet(
        balanceSheetCurrent({
          assets: { groups: [ac], total: ac.total },
        }),
      ),
    );
    expect(out.assets.groups[0].accounts[0].balance).toBe("1.234.567,89");
  });

  it("formatea cero como 0,00 (sin separador de miles)", () => {
    const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
      { accountId: "a1", code: "1.1.1", name: "Caja", balance: D("0") },
    ]);
    const out = curateBalanceSheetForLLM(
      balanceSheet(
        balanceSheetCurrent({
          assets: { groups: [ac], total: ac.total },
        }),
      ),
    );
    expect(out.assets.groups[0].accounts[0].balance).toBe("0,00");
  });
});

// ── checkBalanceTriviality ──

describe("checkBalanceTriviality", () => {
  it("detecta balance vacío (todas las secciones en cero)", () => {
    const result = checkBalanceTriviality(balanceSheet(balanceSheetCurrent()));
    expect(result).toEqual({
      trivial: true,
      code: "empty",
      reason: expect.stringContaining("no contiene movimientos"),
    });
  });

  it("detecta sin activos cuando hay pasivo o patrimonio pero activos en cero", () => {
    const pc = group(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", [
      { accountId: "p1", code: "2.1.1", name: "Proveedores", balance: D("100") },
    ]);
    const result = checkBalanceTriviality(
      balanceSheet(
        balanceSheetCurrent({
          liabilities: { groups: [pc], total: pc.total },
        }),
      ),
    );
    expect(result.trivial).toBe(true);
    if (result.trivial) {
      expect(result.code).toBe("no_assets");
    }
  });

  it("bloquea cuando el descuadre relativo supera 10%", () => {
    const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
      { accountId: "a1", code: "1.1.1", name: "Caja", balance: D("1000") },
    ]);
    const pc = group(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", [
      { accountId: "p1", code: "2.1.1", name: "Proveedores", balance: D("500") },
    ]);
    const eq = group(AccountSubtype.PATRIMONIO_CAPITAL, "Capital", [
      { accountId: "e1", code: "3.1.1", name: "Capital", balance: D("300") },
    ]);

    // Pasivo + Patrimonio = 800; Activo = 1000; delta = 200 → 20% del activo.
    const result = checkBalanceTriviality(
      balanceSheet(
        balanceSheetCurrent({
          assets: { groups: [ac], total: ac.total },
          liabilities: { groups: [pc], total: pc.total },
          equity: { groups: [eq], total: eq.total, retainedEarningsOfPeriod: ZERO },
          imbalanced: true,
          imbalanceDelta: D("200"),
        }),
      ),
    );
    expect(result.trivial).toBe(true);
    if (result.trivial) {
      expect(result.code).toBe("imbalance_severe");
    }
  });

  it("permite descuadres menores al 10%", () => {
    const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
      { accountId: "a1", code: "1.1.1", name: "Caja", balance: D("1000") },
    ]);
    const pc = group(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", [
      { accountId: "p1", code: "2.1.1", name: "Proveedores", balance: D("500") },
    ]);
    const eq = group(AccountSubtype.PATRIMONIO_CAPITAL, "Capital", [
      { accountId: "e1", code: "3.1.1", name: "Capital", balance: D("450") },
    ]);

    // delta = 50 → 5% del activo, no bloquea.
    const result = checkBalanceTriviality(
      balanceSheet(
        balanceSheetCurrent({
          assets: { groups: [ac], total: ac.total },
          liabilities: { groups: [pc], total: pc.total },
          equity: { groups: [eq], total: eq.total, retainedEarningsOfPeriod: ZERO },
          imbalanced: true,
          imbalanceDelta: D("50"),
        }),
      ),
    );
    expect(result.trivial).toBe(false);
  });

  it("detecta insufficient_structure cuando dos secciones están vacías y hay totals positivos", () => {
    // Escenario sintético: assets.total > 0 con 1 cuenta, liabilities.total
    // y equity.total = 0 con grupos vacíos, imbalanced=false (forzado).
    // Sólo 1 sección tiene cuenta no-cero → insufficient_structure.
    const ac = group(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", [
      { accountId: "a1", code: "1.1.1", name: "Caja", balance: D("1000") },
    ]);

    const result = checkBalanceTriviality(
      balanceSheet(
        balanceSheetCurrent({
          assets: { groups: [ac], total: ac.total },
          liabilities: { groups: [], total: ZERO },
          equity: { groups: [], total: ZERO, retainedEarningsOfPeriod: ZERO },
          imbalanced: false,
          imbalanceDelta: ZERO,
        }),
      ),
    );
    expect(result.trivial).toBe(true);
    if (result.trivial) {
      expect(result.code).toBe("insufficient_structure");
    }
  });

  it("permite balances con actividad en al menos dos secciones", () => {
    const result = checkBalanceTriviality(nonTrivialBalance());
    expect(result.trivial).toBe(false);
  });
});

// ── formatBalanceSheetUserMessage ──

describe("formatBalanceSheetUserMessage", () => {
  it("envuelve el JSON curado en un bloque de código JSON", () => {
    const curated = curateBalanceSheetForLLM(nonTrivialBalance());
    const msg = formatBalanceSheetUserMessage(curated);

    expect(msg).toContain("```json");
    expect(msg).toContain("```");
    expect(msg).toContain('"asOfDate": "2026-04-25"');
    expect(msg).toContain('"currency": "BOB"');
  });
});

// ── system prompt: anclas críticas ──

describe("BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT", () => {
  it("declara los 5 ratios en el orden estipulado", () => {
    const idxLiquidez = BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT.indexOf("Liquidez corriente");
    const idxAcida = BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT.indexOf("Prueba ácida");
    const idxEnd = BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT.indexOf("Razón de endeudamiento");
    const idxEndPat = BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT.indexOf("Endeudamiento patrimonial");
    const idxKt = BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT.indexOf("Capital de trabajo");

    expect(idxLiquidez).toBeGreaterThan(0);
    expect(idxAcida).toBeGreaterThan(idxLiquidez);
    expect(idxEnd).toBeGreaterThan(idxAcida);
    expect(idxEndPat).toBeGreaterThan(idxEnd);
    expect(idxKt).toBeGreaterThan(idxEndPat);
  });

  it("incluye la nota de descuadre menor exacta", () => {
    expect(BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT).toContain(
      "El balance presenta un descuadre menor — los ratios pueden interpretarse pero con reserva.",
    );
  });

  it("define No interpretable para Endeudamiento Patrimonial con patrimonio ≤ 0", () => {
    expect(BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT).toContain("No interpretable");
    expect(BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT).toContain("patrimonio neto negativo o nulo");
  });

  it("define el idioma como español formal técnico-profesional sin voseo", () => {
    expect(BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT).toContain("español formal técnico-profesional");
    expect(BALANCE_SHEET_ANALYSIS_SYSTEM_PROMPT).toContain("No utilices voseo");
  });
});
