import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import { buildIncomeStatement } from "@/modules/accounting/financial-statements/domain/income-statement.builder";
import type {
  AccountMetadata,
  MovementAggregation,
  BuildISInput,
} from "@/modules/accounting/financial-statements/domain/types/financial-statements.types";

const D = (v: string | number) => new Prisma.Decimal(v);

function makeAccount(
  partial: Partial<AccountMetadata> & { id: string; subtype: AccountSubtype },
): AccountMetadata {
  return {
    code: partial.id,
    name: `Cuenta ${partial.id}`,
    level: 3,
    nature: "ACREEDORA", // ingresos son acreedores por defecto
    isActive: true,
    isContraAccount: false,
    ...partial,
  };
}

function makeMovement(
  accountId: string,
  totalDebit: string,
  totalCredit: string,
  nature: "DEUDORA" | "ACREEDORA",
  subtype: AccountSubtype,
): MovementAggregation {
  return {
    accountId,
    totalDebit: D(totalDebit),
    totalCredit: D(totalCredit),
    nature,
    subtype,
  };
}

function makeInput(overrides: Partial<BuildISInput> = {}): BuildISInput {
  return {
    accounts: overrides.accounts ?? [],
    movements: overrides.movements ?? [],
    dateFrom: new Date("2025-01-01"),
    dateTo: new Date("2025-12-31"),
    periodStatus: overrides.periodStatus ?? "CLOSED",
    source: overrides.source ?? "snapshot",
  };
}

// Cuentas de fixture
const ingOpAcc = makeAccount({
  id: "acc-ing-op",
  subtype: AccountSubtype.INGRESO_OPERATIVO,
  nature: "ACREEDORA",
});
const gasOpAcc = makeAccount({
  id: "acc-gas-op",
  subtype: AccountSubtype.GASTO_OPERATIVO,
  nature: "DEUDORA",
});
const ingNoOpAcc = makeAccount({
  id: "acc-ing-noop",
  subtype: AccountSubtype.INGRESO_NO_OPERATIVO,
  nature: "ACREEDORA",
});
const gasAdminAcc = makeAccount({
  id: "acc-gas-admin",
  subtype: AccountSubtype.GASTO_ADMINISTRATIVO,
  nature: "DEUDORA",
});
const gasFinAcc = makeAccount({
  id: "acc-gas-fin",
  subtype: AccountSubtype.GASTO_FINANCIERO,
  nature: "DEUDORA",
});
const gasNoOpAcc = makeAccount({
  id: "acc-gas-noop",
  subtype: AccountSubtype.GASTO_NO_OPERATIVO,
  nature: "DEUDORA",
});

describe("buildIncomeStatement", () => {
  // ── (a): subtotales en orden correcto (REQ-5) ──
  it("calcula subtotales en el orden correcto: ingresos, gastos, utilidades", () => {
    // Ingreso Operativo: ACREEDORA → balance = credit - debit = 80000 - 0 = 80000
    // Gasto Operativo: DEUDORA → balance = debit - credit = 50000 - 0 = 50000
    // Ingreso No Operativo: ACREEDORA → 10000
    // Gasto Administrativo: DEUDORA → 8000
    // Gasto Financiero: DEUDORA → 2000
    const input = makeInput({
      accounts: [ingOpAcc, gasOpAcc, ingNoOpAcc, gasAdminAcc, gasFinAcc],
      movements: [
        makeMovement("acc-ing-op", "0", "80000", "ACREEDORA", AccountSubtype.INGRESO_OPERATIVO),
        makeMovement("acc-gas-op", "50000", "0", "DEUDORA", AccountSubtype.GASTO_OPERATIVO),
        makeMovement("acc-ing-noop", "0", "10000", "ACREEDORA", AccountSubtype.INGRESO_NO_OPERATIVO),
        makeMovement("acc-gas-admin", "8000", "0", "DEUDORA", AccountSubtype.GASTO_ADMINISTRATIVO),
        makeMovement("acc-gas-fin", "2000", "0", "DEUDORA", AccountSubtype.GASTO_FINANCIERO),
      ],
    });

    const result = buildIncomeStatement(input);

    // REQ-5 subtotales:
    // 1. Ingresos Operativos = 80000
    expect(result.income.groups.find(g => g.subtype === AccountSubtype.INGRESO_OPERATIVO)?.total.toNumber()).toBe(80000);
    // 2. Gastos Operativos = 50000
    expect(result.expenses.groups.find(g => g.subtype === AccountSubtype.GASTO_OPERATIVO)?.total.toNumber()).toBe(50000);
    // 3. Utilidad Operativa = 80000 − 50000 = 30000
    expect(result.operatingIncome.toNumber()).toBe(30000);
    // 4. Ingresos No Operativos = 10000
    expect(result.income.groups.find(g => g.subtype === AccountSubtype.INGRESO_NO_OPERATIVO)?.total.toNumber()).toBe(10000);
    // 5. Otros Gastos = admin + financiero = 8000 + 2000 = 10000
    // 6. Utilidad Neta = income.total − expenses.total = 90000 − 60000 = 30000
    expect(result.income.total.toNumber()).toBe(90000);
    expect(result.expenses.total.toNumber()).toBe(60000);
    expect(result.netIncome.toNumber()).toBe(30000);
  });

  // ── (b): preliminary: true cuando periodStatus !== "CLOSED" ──
  it("preliminary: true cuando período OPEN", () => {
    const input = makeInput({
      accounts: [ingOpAcc],
      movements: [makeMovement("acc-ing-op", "0", "5000", "ACREEDORA", AccountSubtype.INGRESO_OPERATIVO)],
      periodStatus: "OPEN",
      source: "on-the-fly",
    });
    const result = buildIncomeStatement(input);
    expect(result.preliminary).toBe(true);
  });

  // preliminary: false cuando período CLOSED + snapshot
  it("preliminary: false cuando período CLOSED + source snapshot", () => {
    const input = makeInput({
      accounts: [ingOpAcc],
      movements: [makeMovement("acc-ing-op", "0", "5000", "ACREEDORA", AccountSubtype.INGRESO_OPERATIVO)],
      periodStatus: "CLOSED",
      source: "snapshot",
    });
    const result = buildIncomeStatement(input);
    expect(result.preliminary).toBe(false);
  });

  // ── (c): subtypes vacíos omitidos ──
  it("omite subtipos sin cuentas con balance distinto de cero", () => {
    // Solo ingreso operativo con movimiento; gasto operativo con balance cero
    const input = makeInput({
      accounts: [ingOpAcc, gasOpAcc],
      movements: [
        makeMovement("acc-ing-op", "0", "10000", "ACREEDORA", AccountSubtype.INGRESO_OPERATIVO),
        makeMovement("acc-gas-op", "0", "0", "DEUDORA", AccountSubtype.GASTO_OPERATIVO), // cero
      ],
    });
    const result = buildIncomeStatement(input);
    expect(result.expenses.groups).toHaveLength(0); // sin gastos
    expect(result.income.groups).toHaveLength(1); // solo ingresos operativos
  });

  // TRIANGULATE: cuenta sin movimiento registrado → balance cero → omitida
  it("cuenta sin movimiento registrado se trata como balance cero y se omite", () => {
    const input = makeInput({
      accounts: [ingOpAcc, gasNoOpAcc], // gasNoOp sin movimiento
      movements: [
        makeMovement("acc-ing-op", "0", "20000", "ACREEDORA", AccountSubtype.INGRESO_OPERATIVO),
        // acc-gas-noop no aparece en movements
      ],
    });
    const result = buildIncomeStatement(input);
    expect(result.expenses.groups).toHaveLength(0);
    expect(result.income.total.toNumber()).toBe(20000);
  });

  // TRIANGULATE: pérdida operativa cuando gastos > ingresos
  it("operatingIncome es negativo cuando gastos operativos > ingresos operativos", () => {
    const input = makeInput({
      accounts: [ingOpAcc, gasOpAcc],
      movements: [
        makeMovement("acc-ing-op", "0", "30000", "ACREEDORA", AccountSubtype.INGRESO_OPERATIVO),
        makeMovement("acc-gas-op", "60000", "0", "DEUDORA", AccountSubtype.GASTO_OPERATIVO),
      ],
    });
    const result = buildIncomeStatement(input);
    expect(result.operatingIncome.toNumber()).toBe(-30000);
    expect(result.netIncome.toNumber()).toBe(-30000);
  });

  // TRIANGULATE: preliminary true cuando source on-the-fly incluso con CLOSED
  it("preliminary: true cuando source es on-the-fly aunque el período esté CLOSED", () => {
    const input = makeInput({
      accounts: [ingOpAcc],
      movements: [makeMovement("acc-ing-op", "0", "5000", "ACREEDORA", AccountSubtype.INGRESO_OPERATIVO)],
      periodStatus: "CLOSED",
      source: "on-the-fly",
    });
    const result = buildIncomeStatement(input);
    expect(result.preliminary).toBe(true);
  });

  // TRIANGULATE: utilidad neta correcta con todos los subtipos de gasto
  it("otrosGastos = GASTO_ADMINISTRATIVO + GASTO_FINANCIERO + GASTO_NO_OPERATIVO", () => {
    const input = makeInput({
      accounts: [ingOpAcc, gasAdminAcc, gasFinAcc, gasNoOpAcc],
      movements: [
        makeMovement("acc-ing-op", "0", "100000", "ACREEDORA", AccountSubtype.INGRESO_OPERATIVO),
        makeMovement("acc-gas-admin", "15000", "0", "DEUDORA", AccountSubtype.GASTO_ADMINISTRATIVO),
        makeMovement("acc-gas-fin", "5000", "0", "DEUDORA", AccountSubtype.GASTO_FINANCIERO),
        makeMovement("acc-gas-noop", "3000", "0", "DEUDORA", AccountSubtype.GASTO_NO_OPERATIVO),
      ],
    });
    const result = buildIncomeStatement(input);
    expect(result.income.total.toNumber()).toBe(100000);
    expect(result.expenses.total.toNumber()).toBe(23000); // 15000 + 5000 + 3000
    expect(result.netIncome.toNumber()).toBe(77000);
  });
});
