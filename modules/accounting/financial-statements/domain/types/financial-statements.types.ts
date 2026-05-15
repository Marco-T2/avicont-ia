import type { Prisma } from "@/generated/prisma/client";
import type { AccountSubtype } from "@/generated/prisma/enums";

// ── Tipos para el estilo QuickBooks (PR1) ──

export type DatePresetId =
  | "all_dates"
  | "custom_date"
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "this_month_to_date"
  | "last_month"
  | "this_quarter"
  | "last_quarter"
  | "this_year"
  | "this_year_to_date"
  | "last_year"
  | "last_30_days"
  | "last_90_days"
  | "last_12_months";

export type BreakdownBy = "total" | "months" | "quarters" | "years";

export type CompareWith = "none" | "previous_period" | "previous_year" | "custom";

export type StatementColumn = {
  id: string;
  label: string;
  asOfDate?: Date;
  dateFrom?: Date;
  dateTo?: Date;
  role: "current" | "comparative" | "diff_percent";
};

export type SemanticRowClass =
  | "top-level-grouped-row"
  | "custom-grouped-row"
  | "custom-bg-white"
  | "total-row";

// Alias local para Decimal — se usa en todo el pipeline sin conversión a number
export type Decimal = Prisma.Decimal;

// ── Grupo de cuentas agrupadas por subtipo ──
export type SubtypeGroup = {
  subtype: AccountSubtype;
  label: string; // etiqueta en español, ej "Activo Corriente"
  accounts: Array<{
    accountId: string;
    code: string;
    name: string;
    balance: Decimal;
    /** true if this is a contra-account (its balance reduces the group total) */
    isContra?: boolean;
  }>;
  total: Decimal;
};

/**
 * Cuenta no-contra cuyo balance final aterrizó con signo opuesto a su
 * naturaleza contable (DEUDORA con saldo acreedor → balance negativo,
 * o viceversa). Las contra-cuentas (depreciación, provisiones) y la línea
 * sintética de Resultado/Pérdida del Ejercicio están exentas — sus signos
 * son by-design, no anomalías de datos.
 *
 * Señal de calidad para el contador: típicamente indica anticipos no
 * reclasificados o errores de carga.
 */
export type BalanceSheetOppositeSignAccount = {
  code: string;
  name: string;
  section: "ACTIVO" | "PASIVO" | "PATRIMONIO";
  balance: Decimal; // siempre negativo
};

// ── Balance General (Estado de Situación Patrimonial) ──
export type BalanceSheetCurrent = {
  asOfDate: Date;
  assets: { groups: SubtypeGroup[]; total: Decimal };
  liabilities: { groups: SubtypeGroup[]; total: Decimal };
  equity: { groups: SubtypeGroup[]; total: Decimal; retainedEarningsOfPeriod: Decimal };
  imbalanced: boolean;
  imbalanceDelta: Decimal;
  preliminary: boolean;
  /** Cuentas no-contra con balance negativo (signo opuesto a su naturaleza). */
  oppositeSignAccounts: BalanceSheetOppositeSignAccount[];
};

export type BalanceSheet = {
  orgId: string;
  current: BalanceSheetCurrent;
  comparative?: BalanceSheetCurrent;
  columns?: StatementColumn[];
};

// ── Estado de Resultados ──
export type IncomeStatementCurrent = {
  dateFrom: Date;
  dateTo: Date;
  income: { groups: SubtypeGroup[]; total: Decimal };
  expenses: { groups: SubtypeGroup[]; total: Decimal };
  operatingIncome: Decimal; // INGRESO_OPERATIVO − GASTO_OPERATIVO
  netIncome: Decimal; // income.total − expenses.total
  preliminary: boolean;
};

export type IncomeStatement = {
  orgId: string;
  current: IncomeStatementCurrent;
  comparative?: IncomeStatementCurrent;
  columns?: StatementColumn[];
};

// ── Inputs para los builders ──
export type AccountMetadata = {
  id: string;
  code: string;
  name: string;
  level: number;
  subtype: AccountSubtype | null;
  nature: "DEUDORA" | "ACREEDORA";
  isActive: boolean;
  /** true if this account is a contra-account (reduces the balance of its section) */
  isContraAccount: boolean;
};

export type ResolvedBalance = {
  accountId: string;
  balance: Decimal;
};

export type BuildBalanceSheetInput = {
  accounts: AccountMetadata[];
  balances: ResolvedBalance[];
  retainedEarningsOfPeriod: Decimal;
  date: Date;
  periodStatus: "OPEN" | "CLOSED" | null;
  source: "snapshot" | "on-the-fly";
};

export type MovementAggregation = {
  accountId: string;
  totalDebit: Decimal;
  totalCredit: Decimal;
  nature: "DEUDORA" | "ACREEDORA";
  subtype: AccountSubtype | null;
};

export type BuildISInput = {
  accounts: AccountMetadata[];
  movements: MovementAggregation[];
  dateFrom: Date;
  dateTo: Date;
  periodStatus: "OPEN" | "CLOSED" | null;
  source: "snapshot" | "on-the-fly";
};
