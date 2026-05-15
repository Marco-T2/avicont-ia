import { describe, expect, it } from "vitest";
import type { JournalsService } from "../journals.service";
import type { LedgerService } from "../ledger.service";
import type { FiscalPeriodsService } from "@/modules/fiscal-periods/application/fiscal-periods.service";
import type { AccountType } from "@/generated/prisma/client";
import { AccountingDashboardService } from "../dashboard.service";

const ORG_ID = "org-1";

function makeJournalsStub(entries: Array<{ date: Date }>): JournalsService {
  return {
    list: async () => entries,
  } as unknown as JournalsService;
}

function makeLedgerStub(
  rows: Array<{
    accountCode: string;
    accountName: string;
    accountType: AccountType;
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

describe("AccountingDashboardService.load", () => {
  it("returns empty-safe DTO when the org has no data", async () => {
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub([]),
      makeFiscalPeriodsStub(null),
    );

    const dto = await service.load(ORG_ID);

    expect(dto).toEqual({
      kpi: {
        totalEntries: 0,
        lastEntryDate: null,
        currentPeriod: null,
        activoTotal: "0.00",
        pasivoTotal: "0.00",
        patrimonioTotal: "0.00",
      },
      topAccounts: [],
      monthlyTrend: [],
      closeStatus: null,
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
    );

    const dto = await service.load(ORG_ID);

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
    );

    const dto = await service.load(ORG_ID);

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
    );

    const dto = await service.load(ORG_ID);

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
    );

    const dto = await service.load(ORG_ID);

    expect(dto.kpi.currentPeriod).toEqual({
      name: "Mayo 2026",
      status: "ABIERTO",
    });
  });

  it("returns monthly trend as empty array in v1 (12m chart deferred)", async () => {
    const service = new AccountingDashboardService(
      makeJournalsStub([{ date: new Date("2026-05-15T00:00:00Z") }]),
      makeLedgerStub([]),
      makeFiscalPeriodsStub({ id: "p1", name: "Mayo 2026", status: "ABIERTO" }),
    );

    const dto = await service.load(ORG_ID);

    expect(dto.monthlyTrend).toEqual([]);
  });

  it("serializes monetary fields as fixed-2 decimal strings (no Decimal leak)", async () => {
    const rows = [tbRow("1101", "Caja", "ACTIVO", "100.5", "0.0")];
    const service = new AccountingDashboardService(
      makeJournalsStub([]),
      makeLedgerStub(rows),
      makeFiscalPeriodsStub({ id: "p1", name: "Mayo 2026", status: "OPEN" }),
    );

    const dto = await service.load(ORG_ID);

    expect(dto.kpi.activoTotal).toBe("100.50");
    expect(dto.topAccounts[0].movementTotal).toBe("100.50");
    expect(typeof dto.kpi.activoTotal).toBe("string");
    expect(typeof dto.topAccounts[0].movementTotal).toBe("string");
  });
});

function tbRow(
  accountCode: string,
  accountName: string,
  accountType: AccountType,
  totalDebit: string,
  totalCredit: string,
) {
  return { accountCode, accountName, accountType, totalDebit, totalCredit, balance: "0.00" };
}
