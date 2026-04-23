// TDD — Multi-column extensions for sheet.builder y statement-shape.
// Cubre: ExportSheet.columns, ExportSheet.orientation, ExportRow.balances,
// chunkColumnsForPage (QB-style horizontal pagination), y font-size tiers.
//
// Ciclo: RED → GREEN → TRIANGULATE → REFACTOR

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import type {
  BalanceSheet,
  IncomeStatement,
  SubtypeGroup,
  StatementColumn,
} from "../financial-statements.types";
import {
  buildBalanceSheetExportSheet,
  buildIncomeStatementExportSheet,
  selectBodyFontSize,
  chunkColumnsForPage,
} from "../exporters/sheet.builder";

// ── Helper ──

const D = (v: string | number) => new Prisma.Decimal(v);

function makeGroup(
  subtype: AccountSubtype,
  label: string,
  total: string,
): SubtypeGroup {
  return {
    subtype,
    label,
    accounts: [{ accountId: "acc-1", code: "1.1.01", name: "Cuenta", balance: D(total) }],
    total: D(total),
  };
}

function makeBalanceSheet(extraColumns: StatementColumn[]): BalanceSheet {
  return {
    orgId: "org-1",
    columns: extraColumns,
    current: {
      asOfDate: new Date("2026-03-31"),
      assets: {
        groups: [makeGroup(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", "10000")],
        total: D("10000"),
      },
      liabilities: {
        groups: [makeGroup(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", "4000")],
        total: D("4000"),
      },
      equity: {
        groups: [makeGroup(AccountSubtype.PATRIMONIO_CAPITAL, "Capital", "6000")],
        total: D("6000"),
        retainedEarningsOfPeriod: D("0"),
      },
      imbalanced: false,
      imbalanceDelta: D("0"),
      preliminary: false,
    },
  };
}

function makeIncomeStatement(extraColumns: StatementColumn[]): IncomeStatement {
  return {
    orgId: "org-1",
    columns: extraColumns,
    current: {
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-03-31"),
      income: {
        groups: [makeGroup(AccountSubtype.INGRESO_OPERATIVO, "Ingreso Operativo", "30000")],
        total: D("30000"),
      },
      expenses: {
        groups: [makeGroup(AccountSubtype.GASTO_OPERATIVO, "Gasto Operativo", "18000")],
        total: D("18000"),
      },
      operatingIncome: D("12000"),
      netIncome: D("12000"),
      preliminary: false,
    },
  };
}

// ── columnas de prueba ──

const col1: StatementColumn = { id: "col-current", label: "Total", role: "current" };
const col2: StatementColumn = { id: "col-jan", label: "Ene 2026", role: "current", asOfDate: new Date("2026-01-31") };
const col3: StatementColumn = { id: "col-feb", label: "Feb 2026", role: "current", asOfDate: new Date("2026-02-28") };
const col4: StatementColumn = { id: "col-mar", label: "Mar 2026", role: "current", asOfDate: new Date("2026-03-31") };

// ── Tests: columna única (backward compat) ──

describe("buildBalanceSheetExportSheet — columna única (backward compat)", () => {
  it("portrait cuando columns.length === 1", () => {
    const bs = makeBalanceSheet([col1]);
    const sheet = buildBalanceSheetExportSheet(bs, "Demo S.R.L.");
    expect(sheet.orientation).toBe("portrait");
  });

  it("columns exportados tienen 1 elemento con id y label correctos", () => {
    const bs = makeBalanceSheet([col1]);
    const sheet = buildBalanceSheetExportSheet(bs, "Demo S.R.L.");
    expect(sheet.columns).toHaveLength(1);
    expect(sheet.columns[0].id).toBe("col-current");
    expect(sheet.columns[0].label).toBe("Total");
  });

  it("fila de cuenta tiene balance y balances['col-current'] coinciden", () => {
    const bs = makeBalanceSheet([col1]);
    const sheet = buildBalanceSheetExportSheet(bs, "Demo S.R.L.");
    const accountRow = sheet.rows.find((r) => r.type === "account");
    expect(accountRow).toBeDefined();
    expect(accountRow!.balance).toBeDefined();
    expect(accountRow!.balances?.["col-current"]).toBeDefined();
  });
});

// ── Tests: multi-columna — siempre portrait (QB-style: horizontal chunking) ──

describe("buildBalanceSheetExportSheet — orientación siempre portrait", () => {
  it("portrait cuando columns.length === 3", () => {
    const bs = makeBalanceSheet([col1, col2, col3]);
    const sheet = buildBalanceSheetExportSheet(bs, "Demo S.R.L.");
    expect(sheet.orientation).toBe("portrait");
  });

  it("portrait cuando columns.length === 4 (antes era landscape)", () => {
    const bs = makeBalanceSheet([col1, col2, col3, col4]);
    const sheet = buildBalanceSheetExportSheet(bs, "Demo S.R.L.");
    expect(sheet.orientation).toBe("portrait");
  });

  it("portrait cuando columns.length === 13 (muchas columnas)", () => {
    const manyCols = Array.from({ length: 13 }, (_, i) => ({
      id: `col-${i}`,
      label: `Col ${i}`,
      role: "current" as const,
    }));
    const bs = makeBalanceSheet(manyCols);
    const sheet = buildBalanceSheetExportSheet(bs, "Demo S.R.L.");
    expect(sheet.orientation).toBe("portrait");
  });

  it("columns exportados tienen 3 elementos", () => {
    const bs = makeBalanceSheet([col1, col2, col3]);
    const sheet = buildBalanceSheetExportSheet(bs, "Demo S.R.L.");
    expect(sheet.columns).toHaveLength(3);
  });

  it("balances Record contiene valor para cada columnId en 4 cols", () => {
    const bs = makeBalanceSheet([col1, col2, col3, col4]);
    const sheet = buildBalanceSheetExportSheet(bs, "Demo S.R.L.");
    const accountRow = sheet.rows.find((r) => r.type === "account");
    expect(accountRow!.balances?.["col-current"]).toBeDefined();
    expect(accountRow!.balances?.["col-jan"]).toBeDefined();
    expect(accountRow!.balances?.["col-mar"]).toBeDefined();
  });
});

// ── Tests: IncomeStatement — siempre portrait ──

describe("buildIncomeStatementExportSheet — orientación siempre portrait", () => {
  it("portrait cuando 3 columnas IS", () => {
    const is = makeIncomeStatement([col1, col2, col3]);
    const sheet = buildIncomeStatementExportSheet(is, "Demo S.R.L.");
    expect(sheet.orientation).toBe("portrait");
  });

  it("portrait cuando 4 columnas IS (antes era landscape)", () => {
    const is = makeIncomeStatement([col1, col2, col3, col4]);
    const sheet = buildIncomeStatementExportSheet(is, "Demo S.R.L.");
    expect(sheet.orientation).toBe("portrait");
  });
});

// ── Tests: selectBodyFontSize — shim deprecado (siempre 8) ──

describe("selectBodyFontSize (deprecated shim — siempre retorna 8)", () => {
  it("retorna 8 para 1 columna", () => {
    expect(selectBodyFontSize(1)).toBe(8);
  });

  it("retorna 8 para 8 columnas", () => {
    expect(selectBodyFontSize(8)).toBe(8);
  });

  it("retorna 8 para 13 columnas", () => {
    expect(selectBodyFontSize(13)).toBe(8);
  });
});

// ── Tests: chunkColumnsForPage (QB-style horizontal pagination) ──

describe("chunkColumnsForPage", () => {
  function makeCols(n: number): import("../exporters/statement-shape").ExportColumn[] {
    return Array.from({ length: n }, (_, i) => ({
      id: `col-${i + 1}`,
      label: `Col ${i + 1}`,
      role: "current" as const,
    }));
  }

  it("0 cols → [[]]", () => {
    expect(chunkColumnsForPage([])).toEqual([[]]);
  });

  it("1 col → chunk único de 1", () => {
    const result = chunkColumnsForPage(makeCols(1));
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(1);
  });

  it("6 cols → chunk único de 6 (maxPerPage default = 6)", () => {
    const result = chunkColumnsForPage(makeCols(6));
    expect(result).toHaveLength(1);
    expect(result[0]).toHaveLength(6);
  });

  it("7 cols → dos chunks [6, 1]", () => {
    const result = chunkColumnsForPage(makeCols(7));
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveLength(6);
    expect(result[1]).toHaveLength(1);
  });

  it("13 cols → tres chunks [6, 6, 1]", () => {
    const result = chunkColumnsForPage(makeCols(13));
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(6);
    expect(result[1]).toHaveLength(6);
    expect(result[2]).toHaveLength(1);
  });

  it("52 cols → nueve chunks [6×8, 4]", () => {
    const result = chunkColumnsForPage(makeCols(52));
    expect(result).toHaveLength(9);
    for (let i = 0; i < 8; i++) expect(result[i]).toHaveLength(6);
    expect(result[8]).toHaveLength(4);
  });

  it("preserva el orden de columnas", () => {
    const cols = makeCols(7);
    const result = chunkColumnsForPage(cols);
    expect(result[0][0].id).toBe("col-1");
    expect(result[0][5].id).toBe("col-6");
    expect(result[1][0].id).toBe("col-7");
  });

  it("maxPerPage=3 personalizado: 7 cols → [3,3,1]", () => {
    const result = chunkColumnsForPage(makeCols(7), 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toHaveLength(3);
    expect(result[1]).toHaveLength(3);
    expect(result[2]).toHaveLength(1);
  });
});
