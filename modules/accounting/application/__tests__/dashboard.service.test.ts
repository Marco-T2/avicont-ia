import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JournalsService } from "../journals.service";
import type { LedgerService } from "../ledger.service";
import type { FiscalPeriodsService } from "@/modules/fiscal-periods/application/fiscal-periods.service";
import type { FinancialStatementsService } from "@/modules/accounting/financial-statements/application/financial-statements.service";
import { AccountingDashboardService } from "../dashboard.service";

type AccountTypeLit = "ACTIVO" | "PASIVO" | "PATRIMONIO" | "INGRESO" | "GASTO";

const ORG_ID = "org-1";
const ROLE = "contador" as const;

function makeJournalsStub(entries: Array<{ date: Date }>): JournalsService {
  return {
    list: async () => entries,
  } as unknown as JournalsService;
}

function makeLedgerStub(
  rows: Array<{
    accountCode: string;
    accountName: string;
    accountType: AccountTypeLit;
    totalDebit: string;
    totalCredit: string;
    balance: string;
  }>,
): LedgerService {
  return {
    getTrialBalance: async () => rows,
  } as unknown as LedgerService;
}

function makeFiscalPeriodsStub(
  current: { name: string; status: string; id: string } | null,
): FiscalPeriodsService {
  return {
    findByDate: async () => current,
  } as unknown as FiscalPeriodsService;
}

/**
 * FS stub returning duck-typed IncomeStatement per (year, month) lookup.
 *
 * The dashboard service calls `stmt.current.income.total.toFixed(2)` and
 * `stmt.current.expenses.total.toFixed(2)` — both Decimal methods. We
 * mirror that surface with a plain object exposing `.toFixed(n)`, avoiding
 * a `Prisma.Decimal` import in the test (R5 application-layer ban).
 */
function makeFsStub(
  perMonth: Map<string, { income: number; expenses: number }>,
  observer?: (args: { orgId: string; role: string; dateFrom: Date; dateTo: Date }) => void,
): FinancialStatementsService {
  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    generateIncomeStatement: async (orgId: string, role: any, input: any) => {
      observer?.({ orgId, role, dateFrom: input.dateFrom, dateTo: input.dateTo });
      const key = `${input.dateFrom.getUTCFullYear()}-${input.dateFrom.getUTCMonth()}`;
      const m = perMonth.get(key) ?? { income: 0, expenses: 0 };
      return {
        orgId,
        current: {
          income: { total: fakeDecimal(m.income) },
          expenses: { total: fakeDecimal(m.expenses) },
        },
      };
    },
  } as unknown as FinancialStatementsService;
}

function fakeDecimal(n: number) {
  return {
    toFixed: (digits: number) => n.toFixed(digits),
  };
}

describe("AccountingDashboardService.load", () => {
  beforeEach(() => {
    // Freeze the clock so monthly-trend bucket math is deterministic.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-15T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty-safe DTO when the org has no data", async () => {
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub([]),
      makeFiscalPeriodsStub(null),
      makeFsStub(new Map()),
    );

    const dto = await service.load(ORG_ID, ROLE);

    expect(dto.kpi).toEqual({
      totalEntries: 0,
      lastEntryDate: null,
      currentPeriod: null,
      activoTotal: "0.00",
      pasivoTotal: "0.00",
      patrimonioTotal: "0.00",
    });
    expect(dto.topAccounts).toEqual([]);
    expect(dto.closeStatus).toBeNull();
    // Monthly trend always 12 points, even on an empty org.
    expect(dto.monthlyTrend).toHaveLength(12);
    dto.monthlyTrend.forEach((p) => {
      expect(p.ingresos).toBe("0.00");
      expect(p.egresos).toBe("0.00");
    });
  });

  it("counts entries and surfaces the most recent date as ISO string", async () => {
    const entries = [
      { date: new Date("2026-03-10T00:00:00Z") },
      { date: new Date("2026-05-15T00:00:00Z") },
      { date: new Date("2026-04-22T00:00:00Z") },
    ];
    const service = new AccountingDashboardService(
      makeJournalsStub(entries),
      makeLedgerStub([]),
      makeFiscalPeriodsStub(null),
      makeFsStub(new Map()),
    );

    const dto = await service.load(ORG_ID, ROLE);

    expect(dto.kpi.totalEntries).toBe(3);
    expect(dto.kpi.lastEntryDate).toBe("2026-05-15");
  });

  it("aggregates trial-balance rows into Activo/Pasivo/Patrimonio totals", async () => {
    const rows = [
      tbRow("1101", "Caja", "ACTIVO", "1000.00", "200.00"),
      tbRow("1201", "Bancos", "ACTIVO", "500.00", "100.00"),
      tbRow("2101", "Proveedores", "PASIVO", "50.00", "800.00"),
      tbRow("3101", "Capital", "PATRIMONIO", "0.00", "400.00"),
      tbRow("4101", "Ventas", "INGRESO", "0.00", "2000.00"),
    ];
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub(rows),
      makeFiscalPeriodsStub({ id: "p1", name: "Mayo 2026", status: "ABIERTO" }),
      makeFsStub(new Map()),
    );

    const dto = await service.load(ORG_ID, ROLE);

    expect(dto.kpi.activoTotal).toBe("1200.00");
    expect(dto.kpi.pasivoTotal).toBe("750.00");
    expect(dto.kpi.patrimonioTotal).toBe("400.00");
  });

  it("returns top-10 accounts sorted by abs(debit)+abs(credit) descending", async () => {
    const rows = Array.from({ length: 12 }, (_, i) =>
      tbRow(`A${i.toString().padStart(2, "0")}`, `Cuenta ${i}`, "ACTIVO", String(i * 100), "0.00"),
    );
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub(rows),
      makeFiscalPeriodsStub({ id: "p1", name: "Mayo 2026", status: "ABIERTO" }),
      makeFsStub(new Map()),
    );

    const dto = await service.load(ORG_ID, ROLE);

    expect(dto.topAccounts).toHaveLength(10);
    expect(dto.topAccounts[0].code).toBe("A11");
    expect(dto.topAccounts[0].movementTotal).toBe("1100.00");
    expect(dto.topAccounts[9].code).toBe("A02");
    expect(dto.topAccounts[9].movementTotal).toBe("200.00");
  });

  it("surfaces current fiscal period when findByDate resolves a match", async () => {
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub([]),
      makeFiscalPeriodsStub({ id: "p1", name: "Mayo 2026", status: "OPEN" }),
      makeFsStub(new Map()),
    );

    const dto = await service.load(ORG_ID, ROLE);

    expect(dto.kpi.currentPeriod).toEqual({
      name: "Mayo 2026",
      status: "ABIERTO",
    });
  });

  it("serializes monetary fields as fixed-2 decimal strings (no Decimal leak)", async () => {
    const rows = [tbRow("1101", "Caja", "ACTIVO", "100.5", "0.0")];
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub(rows),
      makeFiscalPeriodsStub({ id: "p1", name: "Mayo 2026", status: "OPEN" }),
      makeFsStub(new Map()),
    );

    const dto = await service.load(ORG_ID, ROLE);

    expect(dto.kpi.activoTotal).toBe("100.50");
    expect(dto.topAccounts[0].movementTotal).toBe("100.50");
    expect(typeof dto.kpi.activoTotal).toBe("string");
    expect(typeof dto.topAccounts[0].movementTotal).toBe("string");
  });

  // ── Monthly trend wiring (accounting-dashboard-monthly-trend) ──

  it("returns monthlyTrend with exactly 12 points in ascending month order", async () => {
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub([]),
      makeFiscalPeriodsStub(null),
      makeFsStub(new Map()),
    );

    const dto = await service.load(ORG_ID, ROLE);

    expect(dto.monthlyTrend).toHaveLength(12);
    const months = dto.monthlyTrend.map((p) => p.month);
    const sorted = [...months].sort();
    expect(months).toEqual(sorted);
  });

  it("formats each month label as YYYY-MM zero-padded", async () => {
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub([]),
      makeFiscalPeriodsStub(null),
      makeFsStub(new Map()),
    );

    const dto = await service.load(ORG_ID, ROLE);

    dto.monthlyTrend.forEach((p) => {
      expect(p.month).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
    });
  });

  it("aligns first point at 11 months ago and last point at current month (frozen at 2026-05-15)", async () => {
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub([]),
      makeFiscalPeriodsStub(null),
      makeFsStub(new Map()),
    );

    const dto = await service.load(ORG_ID, ROLE);

    expect(dto.monthlyTrend[0].month).toBe("2025-06");
    expect(dto.monthlyTrend[11].month).toBe("2026-05");
  });

  it("populates ingresos/egresos from FS service per matching month bucket; misses fall back to 0.00", async () => {
    const perMonth = new Map([
      // 2026-05 → UTC year=2026, month=4 (0-indexed) → key "2026-4"
      ["2026-4", { income: 8500, expenses: 3200 }],
      // 2025-06 → key "2025-5"
      ["2025-5", { income: 100, expenses: 50 }],
    ]);
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub([]),
      makeFiscalPeriodsStub(null),
      makeFsStub(perMonth),
    );

    const dto = await service.load(ORG_ID, ROLE);

    const may2026 = dto.monthlyTrend.find((p) => p.month === "2026-05");
    expect(may2026?.ingresos).toBe("8500.00");
    expect(may2026?.egresos).toBe("3200.00");

    const jun2025 = dto.monthlyTrend.find((p) => p.month === "2025-06");
    expect(jun2025?.ingresos).toBe("100.00");
    expect(jun2025?.egresos).toBe("50.00");

    const oct2025 = dto.monthlyTrend.find((p) => p.month === "2025-10");
    expect(oct2025?.ingresos).toBe("0.00");
    expect(oct2025?.egresos).toBe("0.00");
  });

  it("forwards userRole to every generateIncomeStatement invocation (12 total)", async () => {
    const calls: Array<{ orgId: string; role: string; dateFrom: Date; dateTo: Date }> = [];
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub([]),
      makeFiscalPeriodsStub(null),
      makeFsStub(new Map(), (a) => calls.push(a)),
    );

    await service.load(ORG_ID, ROLE);

    expect(calls).toHaveLength(12);
    calls.forEach((c) => {
      expect(c.orgId).toBe(ORG_ID);
      expect(c.role).toBe(ROLE);
    });
    // Each bucket's dateFrom is the first day of its month UTC.
    calls.forEach((c) => {
      expect(c.dateFrom.getUTCDate()).toBe(1);
      expect(c.dateFrom.getUTCHours()).toBe(0);
    });
  });
});

function tbRow(
  accountCode: string,
  accountName: string,
  accountType: AccountTypeLit,
  totalDebit: string,
  totalCredit: string,
) {
  return { accountCode, accountName, accountType, totalDebit, totalCredit, balance: "0.00" };
}
