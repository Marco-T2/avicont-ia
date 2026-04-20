import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import { buildBalanceSheet } from "@/features/accounting/financial-statements/balance-sheet.builder";
import type {
  AccountMetadata,
  ResolvedBalance,
  BuildBalanceSheetInput,
} from "@/features/accounting/financial-statements/financial-statements.types";

const D = (v: string | number) => new Prisma.Decimal(v);

// ── Fixtures de cuentas ──
function makeAccount(
  partial: Partial<AccountMetadata> & { id: string; subtype: AccountSubtype | null },
): AccountMetadata {
  return {
    code: partial.id,
    name: `Cuenta ${partial.id}`,
    level: 3,
    nature: "DEUDORA",
    isActive: true,
    isContraAccount: false,
    ...partial,
  };
}

function makeInput(
  overrides: Partial<BuildBalanceSheetInput> & {
    accounts?: AccountMetadata[];
    balances?: ResolvedBalance[];
  },
): BuildBalanceSheetInput {
  return {
    accounts: overrides.accounts ?? [],
    balances: overrides.balances ?? [],
    retainedEarningsOfPeriod: overrides.retainedEarningsOfPeriod ?? D("0"),
    date: new Date("2025-12-31"),
    periodStatus: overrides.periodStatus ?? "CLOSED",
    source: overrides.source ?? "snapshot",
  };
}

// ── Cuentas de fixture ──
const activoCorrienteAcc: AccountMetadata = makeAccount({
  id: "acc-activo-corr",
  subtype: AccountSubtype.ACTIVO_CORRIENTE,
  nature: "DEUDORA",
});

const pasivoCorreinteAcc: AccountMetadata = makeAccount({
  id: "acc-pasivo-corr",
  subtype: AccountSubtype.PASIVO_CORRIENTE,
  nature: "ACREEDORA",
});

const patrimonioCap: AccountMetadata = makeAccount({
  id: "acc-pat-cap",
  subtype: AccountSubtype.PATRIMONIO_CAPITAL,
  nature: "ACREEDORA",
});

const patrimonioRes: AccountMetadata = makeAccount({
  id: "acc-pat-res",
  subtype: AccountSubtype.PATRIMONIO_RESULTADOS,
  nature: "ACREEDORA",
});

describe("buildBalanceSheet", () => {
  // ── (a): grupos con cero balance se omiten (REQ-1 "subtipo sin movimientos") ──
  it("omite grupos donde todas las cuentas tienen balance cero", () => {
    const input = makeInput({
      accounts: [activoCorrienteAcc, pasivoCorreinteAcc],
      balances: [
        { accountId: "acc-activo-corr", balance: D("1000") },
        { accountId: "acc-pasivo-corr", balance: D("0") }, // cero → omitir
      ],
    });
    const result = buildBalanceSheet(input);
    expect(result.assets.groups).toHaveLength(1);
    expect(result.liabilities.groups).toHaveLength(0); // pasivo sin movimientos
  });

  // ── (b): cuentas subtype=null excluidas del agrupamiento (solo headers visuales) ──
  it("excluye cuentas con subtype=null del agrupamiento", () => {
    const raizAcc: AccountMetadata = makeAccount({
      id: "acc-raiz",
      subtype: null, // nivel 1 — header visual
      level: 1,
    });
    const input = makeInput({
      accounts: [raizAcc, activoCorrienteAcc],
      balances: [
        { accountId: "acc-raiz", balance: D("999") },
        { accountId: "acc-activo-corr", balance: D("500") },
      ],
    });
    const result = buildBalanceSheet(input);
    // acc-raiz no debe aparecer en ningún grupo
    const allAccountIds = result.assets.groups.flatMap((g) => g.accounts.map((a) => a.accountId));
    expect(allAccountIds).not.toContain("acc-raiz");
  });

  // ── (c): cuentas inactivas excluidas ──
  it("excluye cuentas inactivas del balance", () => {
    const inactiveAcc: AccountMetadata = makeAccount({
      id: "acc-inactiva",
      subtype: AccountSubtype.ACTIVO_CORRIENTE,
      isActive: false, // inactiva
    });
    const input = makeInput({
      accounts: [activoCorrienteAcc, inactiveAcc],
      balances: [
        { accountId: "acc-activo-corr", balance: D("1000") },
        { accountId: "acc-inactiva", balance: D("500") },
      ],
    });
    const result = buildBalanceSheet(input);
    const allAccountIds = result.assets.groups.flatMap((g) => g.accounts.map((a) => a.accountId));
    expect(allAccountIds).not.toContain("acc-inactiva");
    expect(allAccountIds).toContain("acc-activo-corr");
  });

  // ── (d): retainedEarningsOfPeriod positivo → línea sintética en PATRIMONIO_RESULTADOS ──
  it("inserta utilidad positiva como línea sintética en PATRIMONIO_RESULTADOS", () => {
    const input = makeInput({
      accounts: [patrimonioCap],
      balances: [{ accountId: "acc-pat-cap", balance: D("50000") }],
      retainedEarningsOfPeriod: D("20000"),
    });
    const result = buildBalanceSheet(input);
    const resultsGroup = result.equity.groups.find(
      (g) => g.subtype === AccountSubtype.PATRIMONIO_RESULTADOS,
    );
    expect(resultsGroup).toBeDefined();
    const syntheticLine = resultsGroup!.accounts.find(
      (a) => a.accountId === "__synthetic_retained_earnings__",
    );
    expect(syntheticLine).toBeDefined();
    expect(syntheticLine!.name).toBe("Resultado del Ejercicio");
    expect(syntheticLine!.balance.toNumber()).toBe(20000);
  });

  // ── (e): retainedEarningsOfPeriod negativo → "Pérdida del Ejercicio" ──
  it("nombra la línea sintética 'Pérdida del Ejercicio' cuando utilidad es negativa", () => {
    const input = makeInput({
      accounts: [patrimonioRes],
      balances: [{ accountId: "acc-pat-res", balance: D("5000") }],
      retainedEarningsOfPeriod: D("-8000"),
    });
    const result = buildBalanceSheet(input);
    const resultsGroup = result.equity.groups.find(
      (g) => g.subtype === AccountSubtype.PATRIMONIO_RESULTADOS,
    )!;
    const syntheticLine = resultsGroup.accounts.find(
      (a) => a.accountId === "__synthetic_retained_earnings__",
    );
    expect(syntheticLine!.name).toBe("Pérdida del Ejercicio");
    expect(syntheticLine!.balance.toNumber()).toBe(-8000);
  });

  // ── (f): ecuación balanceada → imbalanced: false ──
  it("ecuación balanceada → imbalanced: false", () => {
    // Activo = Pasivo + Patrimonio: 1000 = 1000 + 0
    const input = makeInput({
      accounts: [activoCorrienteAcc, pasivoCorreinteAcc],
      balances: [
        { accountId: "acc-activo-corr", balance: D("1000") },
        { accountId: "acc-pasivo-corr", balance: D("1000") },
      ],
      retainedEarningsOfPeriod: D("0"),
    });
    const result = buildBalanceSheet(input);
    expect(result.imbalanced).toBe(false);
  });

  // ── (g): delta > 0.01 → imbalanced: true con imbalanceDelta firmado (REQ-6) ──
  it("ecuación desbalanceada → imbalanced: true con imbalanceDelta", () => {
    // Activo = 1000, Pasivo = 900 → delta = 100
    const input = makeInput({
      accounts: [activoCorrienteAcc, pasivoCorreinteAcc],
      balances: [
        { accountId: "acc-activo-corr", balance: D("1000") },
        { accountId: "acc-pasivo-corr", balance: D("900") },
      ],
      retainedEarningsOfPeriod: D("0"),
    });
    const result = buildBalanceSheet(input);
    expect(result.imbalanced).toBe(true);
    expect(result.imbalanceDelta.toNumber()).toBe(100); // Activo - (Pasivo + Patrimonio)
  });

  // TRIANGULATE: delta exactamente 0.01 → balanceado (tolerancia incluye el límite)
  it("delta exactamente 0.01 → imbalanced: false (dentro de tolerancia)", () => {
    const input = makeInput({
      accounts: [activoCorrienteAcc, pasivoCorreinteAcc],
      balances: [
        { accountId: "acc-activo-corr", balance: D("1000.01") },
        { accountId: "acc-pasivo-corr", balance: D("1000") },
      ],
      retainedEarningsOfPeriod: D("0"),
    });
    const result = buildBalanceSheet(input);
    expect(result.imbalanced).toBe(false);
  });

  // TRIANGULATE: preliminary = true cuando source es on-the-fly
  it("preliminary: true cuando source es on-the-fly", () => {
    const input = makeInput({
      accounts: [activoCorrienteAcc],
      balances: [{ accountId: "acc-activo-corr", balance: D("500") }],
      source: "on-the-fly",
      periodStatus: "OPEN",
    });
    const result = buildBalanceSheet(input);
    expect(result.preliminary).toBe(true);
  });

  // TRIANGULATE: preliminary = false cuando período CLOSED + snapshot
  it("preliminary: false cuando período CLOSED + source snapshot", () => {
    const input = makeInput({
      accounts: [activoCorrienteAcc, pasivoCorreinteAcc],
      balances: [
        { accountId: "acc-activo-corr", balance: D("1000") },
        { accountId: "acc-pasivo-corr", balance: D("1000") },
      ],
      periodStatus: "CLOSED",
      source: "snapshot",
    });
    const result = buildBalanceSheet(input);
    expect(result.preliminary).toBe(false);
  });

  // TRIANGULATE: los totales de sección son correctos
  it("calcula totalActivo, totalPasivo, totalPatrimonio correctamente", () => {
    const activo2: AccountMetadata = makeAccount({
      id: "acc-activo-nc",
      subtype: AccountSubtype.ACTIVO_NO_CORRIENTE,
    });
    const input = makeInput({
      accounts: [activoCorrienteAcc, activo2, pasivoCorreinteAcc, patrimonioCap],
      balances: [
        { accountId: "acc-activo-corr", balance: D("3000") },
        { accountId: "acc-activo-nc", balance: D("7000") },
        { accountId: "acc-pasivo-corr", balance: D("5000") },
        { accountId: "acc-pat-cap", balance: D("5000") },
      ],
      retainedEarningsOfPeriod: D("0"),
    });
    const result = buildBalanceSheet(input);
    expect(result.assets.total.toNumber()).toBe(10000);
    expect(result.liabilities.total.toNumber()).toBe(5000);
    expect(result.equity.total.toNumber()).toBe(5000);
  });

  // TRIANGULATE: retainedEarnings se suma a totalPatrimonio
  it("retainedEarningsOfPeriod se incluye en totalPatrimonio", () => {
    const input = makeInput({
      accounts: [patrimonioCap],
      balances: [{ accountId: "acc-pat-cap", balance: D("5000") }],
      retainedEarningsOfPeriod: D("2000"),
    });
    const result = buildBalanceSheet(input);
    expect(result.equity.total.toNumber()).toBe(7000); // 5000 capital + 2000 utilidad
  });
});
