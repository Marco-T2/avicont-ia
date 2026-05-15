/**
 * Canonical hex DTO — accounting dashboard composition.
 *
 * Monetary values cross the application/presentation boundary as
 * pre-formatted decimal strings (`"123456.78"`), never as
 * `Prisma.Decimal`. This keeps the client bundle free of
 * `decimal.js` and matches the dashboard service's serialization
 * contract.
 */

export type FiscalPeriodStatus = "ABIERTO" | "CERRADO" | "PRE_CIERRE";

export interface DashboardKpi {
  totalEntries: number;
  lastEntryDate: string | null;
  currentPeriod: { name: string; status: FiscalPeriodStatus } | null;
  activoTotal: string;
  pasivoTotal: string;
  patrimonioTotal: string;
}

export interface DashboardTopAccount {
  code: string;
  name: string;
  movementTotal: string;
}

export interface DashboardMonthlyTrendPoint {
  month: string;
  ingresos: string;
  egresos: string;
}

export interface DashboardCloseStatus {
  period: string;
  closed: boolean;
}

export interface AccountingDashboardDTO {
  kpi: DashboardKpi;
  topAccounts: DashboardTopAccount[];
  monthlyTrend: DashboardMonthlyTrendPoint[];
  closeStatus: DashboardCloseStatus | null;
}
