import { AccountSubtype } from "@/generated/prisma/enums";
// R5-pragmatic: domain-to-domain cross-feature import (see balance-sheet.builder
// header for full rationale). modules/accounting/domain/account-subtype.utils
// is the canonical home; this is NOT cross-layer.
import { formatSubtypeLabel } from "@/modules/accounting/domain/account-subtype.utils";
import { sumDecimals, zeroDecimal } from "./money.utils";
import type {
  AccountMetadata,
  MovementAggregation,
  BuildISInput,
  IncomeStatementCurrent,
  Decimal,
  SubtypeGroup,
} from "./types/financial-statements.types";

// ── Subtipos de ingreso (orden REQ-5) ──
const INGRESO_SUBTYPES: AccountSubtype[] = [
  AccountSubtype.INGRESO_OPERATIVO,
  AccountSubtype.INGRESO_NO_OPERATIVO,
];

// ── Subtipos de gasto (orden REQ-5) ──
const GASTO_SUBTYPES: AccountSubtype[] = [
  AccountSubtype.GASTO_OPERATIVO,
  AccountSubtype.GASTO_ADMINISTRATIVO,
  AccountSubtype.GASTO_FINANCIERO,
  AccountSubtype.GASTO_NO_OPERATIVO,
];

/**
 * Construye el Estado de Resultados a partir de datos pre-consultados.
 *
 * Función pura (D3): no accede a Prisma ni produce efectos secundarios.
 *
 * Convención de signo de balance (igual que el resolver, REQ-4):
 *   DEUDORA (gastos):   balance = totalDebit − totalCredit
 *   ACREEDORA (ingresos): balance = totalCredit − totalDebit
 *
 * Subtotales en orden REQ-5:
 *   1. Ingresos Operativos = SUM(INGRESO_OPERATIVO)
 *   2. Gastos Operativos = SUM(GASTO_OPERATIVO)
 *   3. Utilidad Operativa = Ingresos Operativos − Gastos Operativos
 *   4. Ingresos No Operativos = SUM(INGRESO_NO_OPERATIVO)
 *   5. Otros Gastos = SUM(GASTO_ADMINISTRATIVO + GASTO_FINANCIERO + GASTO_NO_OPERATIVO)
 *   6. Utilidad Neta = income.total − expenses.total
 */
export function buildIncomeStatement(input: BuildISInput): IncomeStatementCurrent {
  const { accounts, movements, dateFrom, dateTo, periodStatus, source } = input;

  // 1. Índice de movimientos por accountId para lookup O(1)
  const movementMap = new Map<string, MovementAggregation>(
    movements.map((m) => [m.accountId, m]),
  );

  // 2. Calcular balance por cuenta (según naturaleza)
  const balanceOf = (acc: AccountMetadata): Decimal => {
    const mov = movementMap.get(acc.id);
    if (!mov) return zeroDecimal();
    // Misma convención que account-balances.repository.ts:68-72
    return acc.nature === "DEUDORA"
      ? mov.totalDebit.minus(mov.totalCredit)
      : mov.totalCredit.minus(mov.totalDebit);
  };

  // 3. Filtrar cuentas activas con subtype de ingresos/gastos
  const classified = accounts.filter((a) => a.subtype !== null && a.isActive);

  // 4. Builder de grupo por subtype
  const buildGroup = (subtype: AccountSubtype): SubtypeGroup | null => {
    const accsForSubtype = classified
      .filter((a) => a.subtype === subtype)
      .map((a) => ({
        accountId: a.id,
        code: a.code,
        name: a.name,
        balance: balanceOf(a),
      }))
      .filter((a) => !a.balance.isZero()); // omitir cuentas sin movimientos

    if (accsForSubtype.length === 0) return null;

    return {
      subtype,
      label: formatSubtypeLabel(subtype),
      accounts: accsForSubtype,
      total: sumDecimals(accsForSubtype.map((a) => a.balance)),
    };
  };

  // 5. Construir grupos de ingresos y gastos
  const incomeGroups = INGRESO_SUBTYPES.map(buildGroup).filter(
    (g): g is SubtypeGroup => g !== null,
  );
  const expenseGroups = GASTO_SUBTYPES.map(buildGroup).filter(
    (g): g is SubtypeGroup => g !== null,
  );

  // 6. Calcular subtotales (REQ-5)
  const incomeTotal = sumDecimals(incomeGroups.map((g) => g.total));
  const expenseTotal = sumDecimals(expenseGroups.map((g) => g.total));

  // Utilidad Operativa = INGRESO_OPERATIVO − GASTO_OPERATIVO (sin CMV en v1, decisión #518.3)
  const ingOp =
    incomeGroups.find((g) => g.subtype === AccountSubtype.INGRESO_OPERATIVO)?.total ??
    zeroDecimal();
  const gasOp =
    expenseGroups.find((g) => g.subtype === AccountSubtype.GASTO_OPERATIVO)?.total ??
    zeroDecimal();
  const operatingIncome = ingOp.minus(gasOp);

  // Utilidad Neta = income.total − expenses.total (single source of truth para retained earnings)
  const netIncome = incomeTotal.minus(expenseTotal);

  // 7. Flag preliminary (igual que el balance sheet)
  const preliminary = periodStatus !== "CLOSED" || source === "on-the-fly";

  return {
    dateFrom,
    dateTo,
    income: { groups: incomeGroups, total: incomeTotal },
    expenses: { groups: expenseGroups, total: expenseTotal },
    operatingIncome,
    netIncome,
    preliminary,
  };
}
