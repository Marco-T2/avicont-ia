import type { FiscalPeriodsService } from "@/modules/fiscal-periods/application/fiscal-periods.service";
import type { Role } from "@/modules/permissions/domain/permissions";
import type {
  AccountingDashboardDTO,
  DashboardMonthlyTrendPoint,
} from "./dto/dashboard.types";
import type { FinancialStatementsService } from "../financial-statements/application/financial-statements.service";
import type { IncomeStatement } from "../financial-statements/domain/types/financial-statements.types";
import type { JournalsService } from "./journals.service";
import type { LedgerService } from "./ledger.service";

type AccountTypeLiteral = "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO";

const TREND_MONTHS = 12;

/**
 * Application-layer dashboard composition for the accounting hub.
 *
 * Orchestrates journal counts, current-period lookup, trial-balance
 * aggregates, and a trailing 12-month Ingresos vs Egresos series into a
 * single `AccountingDashboardDTO`. All monetary fields cross the boundary
 * as fixed-2 decimal strings — recharts and any other client consumer
 * never see `Prisma.Decimal` or `decimal.js`.
 *
 * The Decimal type from `IncomeStatement.current.income.total` arrives as
 * a TYPE ONLY (no runtime `Prisma` import in this file) and is consumed
 * via `.toFixed(2)`, a method shared by `decimal.js` and our fake-decimal
 * test stub. R5 (application/ must not import Prisma) preserved.
 *
 * `closeStatus` still returns `null` — monthly-close integration deferred.
 */
export class AccountingDashboardService {
  constructor(
    private readonly journals: JournalsService,
    private readonly ledger: LedgerService,
    private readonly fiscalPeriods: FiscalPeriodsService,
    private readonly financialStatements: FinancialStatementsService,
  ) {}

  async load(orgId: string, userRole: Role): Promise<AccountingDashboardDTO> {
    const today = new Date();
    const buckets = buildMonthBuckets(today, TREND_MONTHS);

    const [entries, currentPeriodRaw, ...trendStatements] = await Promise.all([
      this.journals.list(orgId),
      this.fiscalPeriods.findByDate(orgId, today),
      ...buckets.map((b) =>
        this.financialStatements.generateIncomeStatement(orgId, userRole, {
          dateFrom: b.dateFrom,
          dateTo: b.dateTo,
        }),
      ),
    ]);

    const currentPeriod = currentPeriodRaw
      ? {
          id: currentPeriodRaw.id,
          name: currentPeriodRaw.name,
          statusValue: readPeriodStatus(currentPeriodRaw),
        }
      : null;

    const trialBalance = currentPeriod
      ? await this.ledger.getTrialBalance(orgId, currentPeriod.id)
      : [];

    return {
      kpi: {
        totalEntries: entries.length,
        lastEntryDate: latestEntryDateISO(entries),
        currentPeriod: currentPeriod
          ? {
              name: currentPeriod.name,
              status: currentPeriod.statusValue === "CLOSED" ? "CERRADO" : "ABIERTO",
            }
          : null,
        activoTotal: aggregateByType(trialBalance, "ACTIVO"),
        pasivoTotal: aggregateByType(trialBalance, "PASIVO"),
        patrimonioTotal: aggregateByType(trialBalance, "PATRIMONIO"),
      },
      topAccounts: topTen(trialBalance),
      monthlyTrend: foldTrend(buckets, trendStatements),
      closeStatus: null,
    };
  }
}

interface FiscalPeriodLike {
  id: string;
  name: string;
  status: "OPEN" | "CLOSED" | { value: "OPEN" | "CLOSED" };
}

function readPeriodStatus(period: FiscalPeriodLike): "OPEN" | "CLOSED" {
  return typeof period.status === "string" ? period.status : period.status.value;
}

function latestEntryDateISO(entries: Array<{ date: Date }>): string | null {
  if (entries.length === 0) return null;
  const max = entries.reduce(
    (acc, e) => (e.date.getTime() > acc.getTime() ? e.date : acc),
    entries[0].date,
  );
  return max.toISOString().slice(0, 10);
}

interface TrialBalanceRowLike {
  accountCode: string;
  accountName: string;
  accountType: AccountTypeLiteral;
  totalDebit: string;
  totalCredit: string;
}

function aggregateByType(
  rows: TrialBalanceRowLike[],
  type: AccountTypeLiteral,
): string {
  // Activo / Pasivo / Patrimonio surface the absolute net position for the
  // type — running sum of (debit - credit) then take |result|. Per-row abs
  // would double-count internal nettings between accounts of the same type.
  // Number arithmetic is acceptable here: KPI surfacing, not partida-doble
  // ledger math (which lives in `shared/domain/money.utils` Decimal helpers).
  const net = rows
    .filter((r) => r.accountType === type)
    .reduce(
      (acc, r) => acc + Number(r.totalDebit) - Number(r.totalCredit),
      0,
    );
  return Math.abs(net).toFixed(2);
}

function topTen(rows: TrialBalanceRowLike[]) {
  return rows
    .map((r) => ({
      code: r.accountCode,
      name: r.accountName,
      movement: Math.abs(Number(r.totalDebit)) + Math.abs(Number(r.totalCredit)),
    }))
    .sort((a, b) => b.movement - a.movement)
    .slice(0, 10)
    .map(({ code, name, movement }) => ({
      code,
      name,
      movementTotal: movement.toFixed(2),
    }));
}

interface MonthBucket {
  month: string;
  dateFrom: Date;
  dateTo: Date;
}

/**
 * Builds N trailing month buckets ending at the month of `today`,
 * ascending order. Each bucket's `dateFrom` is the first UTC midnight of
 * the month and `dateTo` is the last UTC midnight of the month
 * (`Date.UTC(y, m+1, 0)`). Labels are `YYYY-MM` zero-padded.
 */
function buildMonthBuckets(today: Date, count: number): MonthBucket[] {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const buckets: MonthBucket[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const m = month - offset;
    const dateFrom = new Date(Date.UTC(year, m, 1));
    const dateTo = new Date(Date.UTC(year, m + 1, 0));
    const y = dateFrom.getUTCFullYear();
    const mm = String(dateFrom.getUTCMonth() + 1).padStart(2, "0");
    buckets.push({ month: `${y}-${mm}`, dateFrom, dateTo });
  }
  return buckets;
}

function foldTrend(
  buckets: MonthBucket[],
  statements: IncomeStatement[],
): DashboardMonthlyTrendPoint[] {
  return buckets.map((b, i) => ({
    month: b.month,
    ingresos: statements[i].current.income.total.toFixed(2),
    egresos: statements[i].current.expenses.total.toFixed(2),
  }));
}
