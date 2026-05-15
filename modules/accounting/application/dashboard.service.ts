import type { FiscalPeriodsService } from "@/modules/fiscal-periods/application/fiscal-periods.service";
import type { AccountingDashboardDTO } from "./dto/dashboard.types";
import type { JournalsService } from "./journals.service";
import type { LedgerService } from "./ledger.service";

type AccountTypeLiteral = "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO";

/**
 * Application-layer dashboard composition for the accounting hub.
 *
 * Orchestrates journal counts, current-period lookup, and trial-balance
 * aggregates into a single `AccountingDashboardDTO`. All monetary fields
 * cross the boundary as fixed-2 decimal strings — recharts and any other
 * client consumer never see `Prisma.Decimal` or `decimal.js`.
 *
 * v1 scope: KPI row + top-10 accounts. `monthlyTrend` and `closeStatus`
 * intentionally return empty/null until follow-up cycles (12m FS trend +
 * monthly-close integration) — DTO shape is forward-compatible.
 */
export class AccountingDashboardService {
  constructor(
    private readonly journals: JournalsService,
    private readonly ledger: LedgerService,
    private readonly fiscalPeriods: FiscalPeriodsService,
  ) {}

  async load(orgId: string): Promise<AccountingDashboardDTO> {
    const today = new Date();

    const [entries, currentPeriodRaw] = await Promise.all([
      this.journals.list(orgId),
      this.fiscalPeriods.findByDate(orgId, today),
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
      monthlyTrend: [],
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
