import type { Prisma } from "@/generated/prisma/client";
import type { AccountSubtype } from "@/generated/prisma/enums";

// Alias local para Decimal — se usa en todo el pipeline sin conversión a number
export type Decimal = Prisma.Decimal;

// ── Período del estado financiero ──
// Preparado para comparativos en v2 (campo comparative opcional)
export type StatementPeriod = {
  fiscalPeriodId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  asOfDate: Date;
};

// ── Línea de detalle dentro de un grupo de subtipo ──
export type StatementLine = {
  accountId: string;
  accountCode: string;
  accountName: string;
  level: number;
  subtype: AccountSubtype | null;
  balance: Decimal;
};

// ── Grupo de cuentas agrupadas por subtipo ──
export type SubtypeGroup = {
  subtype: AccountSubtype;
  label: string; // etiqueta en español, ej "Activo Corriente"
  accounts: Array<{
    accountId: string;
    code: string;
    name: string;
    balance: Decimal;
  }>;
  total: Decimal;
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
};

export type BalanceSheet = {
  orgId: string;
  current: BalanceSheetCurrent;
  comparative?: BalanceSheetCurrent; // v2 — comparativos
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
  comparative?: IncomeStatementCurrent; // v2 — comparativos
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
