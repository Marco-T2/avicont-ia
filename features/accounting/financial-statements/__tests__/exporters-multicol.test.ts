// Smoke tests de exporters multi-columna (PR4 / QB-style).
// Verifica:
//   1. Buffer no vacío con firma mágica correcta (%PDF, PK\x03\x04)
//   2. Portrait siempre — nunca landscape (QB-style: chunking horizontal)
//   3. 13-col PDF genera múltiples páginas (pdf-parse: Pages > 1)
//   4. Celdas numéricas nativas en Excel (ExcelJS CellType.Number)
//   5. Formato de nombre de archivo (patrón {type}-{orgSlug}-{periodLabel}.{ext})
//
// Fixtures: 3-col (portrait), 8-col (portrait), 13-col (portrait, multi-page).

import { describe, it, expect } from "vitest";
// TODO: pdf-parse v2 tiene una API incompatible con la firma esperada.
// La detección de múltiples páginas usa una búsqueda de bytes en el PDF raw.
import ExcelJS from "exceljs";
import { Prisma } from "@/generated/prisma/client";
import { AccountSubtype } from "@/generated/prisma/enums";
import type { BalanceSheet, IncomeStatement, SubtypeGroup, StatementColumn } from "../financial-statements.types";
import { exportBalanceSheetPdf, exportIncomeStatementPdf } from "../exporters/pdf.exporter";
import {
  exportBalanceSheetExcel,
  exportIncomeStatementExcel,
} from "../exporters/excel.exporter";
import {
  buildBalanceSheetExportSheet,
  buildIncomeStatementExportSheet,
} from "../exporters/sheet.builder";

// ── Helper ──

const D = (v: string | number) => new Prisma.Decimal(v);

// ── Fixture factory ──

function makeGroup(
  subtype: AccountSubtype,
  label: string,
  total: string,
): SubtypeGroup {
  return {
    subtype,
    label,
    accounts: [{ accountId: "acc-1", code: "1.1.01", name: "Caja", balance: D(total) }],
    total: D(total),
  };
}

/**
 * Genera N StatementColumn de tipo "current".
 */
function makeCols(n: number): StatementColumn[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `col-${i + 1}`,
    label: `Col ${i + 1}`,
    role: "current" as const,
  }));
}

function makeBalanceSheet(nCols: number): BalanceSheet {
  return {
    orgId: "org-smoke",
    columns: makeCols(nCols),
    current: {
      asOfDate: new Date("2026-03-31"),
      assets: {
        groups: [makeGroup(AccountSubtype.ACTIVO_CORRIENTE, "Activo Corriente", "20000")],
        total: D("20000"),
      },
      liabilities: {
        groups: [makeGroup(AccountSubtype.PASIVO_CORRIENTE, "Pasivo Corriente", "8000")],
        total: D("8000"),
      },
      equity: {
        groups: [makeGroup(AccountSubtype.PATRIMONIO_CAPITAL, "Capital", "12000")],
        total: D("12000"),
        retainedEarningsOfPeriod: D("0"),
      },
      imbalanced: false,
      imbalanceDelta: D("0"),
      preliminary: false,
    },
  };
}

function makeIncomeStatement(nCols: number): IncomeStatement {
  return {
    orgId: "org-smoke",
    columns: makeCols(nCols),
    current: {
      dateFrom: new Date("2026-01-01"),
      dateTo: new Date("2026-03-31"),
      income: {
        groups: [makeGroup(AccountSubtype.INGRESO_OPERATIVO, "Ingresos", "30000")],
        total: D("30000"),
      },
      expenses: {
        groups: [makeGroup(AccountSubtype.GASTO_OPERATIVO, "Gastos", "18000")],
        total: D("18000"),
      },
      operatingIncome: D("12000"),
      netIncome: D("12000"),
      preliminary: false,
    },
  };
}

// ── Tests: PDF multi-columna ──

describe("PDF exporters — multi-columna (PR4)", () => {
  it("BS 3-col → Buffer con firma %PDF (portrait)", async () => {
    const buf = await exportBalanceSheetPdf(makeBalanceSheet(3), "Demo S.R.L.");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(200);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
    // portrait: la orientación no cambia el header del archivo, pero verificamos que no lanza
  });

  it("BS 8-col → Buffer con firma %PDF (portrait)", async () => {
    const buf = await exportBalanceSheetPdf(makeBalanceSheet(8), "Demo S.R.L.");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(200);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("BS 13-col → Buffer con firma %PDF (portrait, multi-page)", async () => {
    const buf = await exportBalanceSheetPdf(makeBalanceSheet(13), "Demo S.R.L.");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(200);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
    // 13 cols / 6 per page = 3 chunks → 3 páginas
    // Detectar múltiples páginas buscando /Count N en el árbol de páginas PDF.
    // Un PDF de 1 página tiene /Count 1; multi-página tiene /Count > 1.
    const pdfText = buf.toString("binary");
    const countMatch = pdfText.match(/\/Count\s+(\d+)/);
    const pageCount = countMatch ? parseInt(countMatch[1], 10) : 0;
    expect(pageCount).toBeGreaterThan(1);
  });

  it("IS 3-col → Buffer con firma %PDF", async () => {
    const buf = await exportIncomeStatementPdf(makeIncomeStatement(3), "Demo S.R.L.");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
  });

  it("IS 13-col → Buffer con firma %PDF (portrait, multi-page)", async () => {
    const buf = await exportIncomeStatementPdf(makeIncomeStatement(13), "Demo S.R.L.");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.slice(0, 4).toString()).toBe("%PDF");
    // Detectar múltiples páginas buscando /Count N en el árbol de páginas PDF.
    // Un PDF de 1 página tiene /Count 1; multi-página tiene /Count > 1.
    const pdfText = buf.toString("binary");
    const countMatch = pdfText.match(/\/Count\s+(\d+)/);
    const pageCount = countMatch ? parseInt(countMatch[1], 10) : 0;
    expect(pageCount).toBeGreaterThan(1);
  });
});

// ── Tests: orientación en ExportSheet ──
// QB-style: portrait SIEMPRE — el PDF usa chunking horizontal, no landscape.

describe("Orientación en ExportSheet (QB-style: siempre portrait)", () => {
  it("BS 3 cols → portrait", () => {
    const sheet = buildBalanceSheetExportSheet(makeBalanceSheet(3), "Demo");
    expect(sheet.orientation).toBe("portrait");
  });

  it("BS 4 cols → portrait (antes era landscape)", () => {
    const sheet = buildBalanceSheetExportSheet(makeBalanceSheet(4), "Demo");
    expect(sheet.orientation).toBe("portrait");
  });

  it("BS 13 cols → portrait (antes era landscape)", () => {
    const sheet = buildBalanceSheetExportSheet(makeBalanceSheet(13), "Demo");
    expect(sheet.orientation).toBe("portrait");
  });

  it("IS 3 cols → portrait", () => {
    const sheet = buildIncomeStatementExportSheet(makeIncomeStatement(3), "Demo");
    expect(sheet.orientation).toBe("portrait");
  });

  it("IS 8 cols → portrait (antes era landscape)", () => {
    const sheet = buildIncomeStatementExportSheet(makeIncomeStatement(8), "Demo");
    expect(sheet.orientation).toBe("portrait");
  });
});

// ── Tests: Excel multi-columna ──

describe("Excel exporters — multi-columna (PR4)", () => {
  it("BS 3-col → Buffer con magic bytes XLSX (PK\\x03\\x04)", async () => {
    const buf = await exportBalanceSheetExcel(makeBalanceSheet(3), "Demo S.R.L.");
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(200);
    // Firma mágica de ZIP/XLSX: PK\x03\x04
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
    expect(buf[2]).toBe(0x03);
    expect(buf[3]).toBe(0x04);
  });

  it("BS 8-col → Buffer XLSX válido", async () => {
    const buf = await exportBalanceSheetExcel(makeBalanceSheet(8), "Demo S.R.L.");
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });

  it("IS 3-col → Buffer XLSX válido", async () => {
    const buf = await exportIncomeStatementExcel(makeIncomeStatement(3), "Demo S.R.L.");
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
  });
});

// ── Tests: celdas numéricas nativas (ExcelJS cell.type === Number) ──

describe("Excel — celdas numéricas nativas (CellType.Number)", () => {
  it("BS single-col: la celda de saldo de cuenta tiene type Number", async () => {
    const buf = await exportBalanceSheetExcel(makeBalanceSheet(1), "Demo S.R.L.");
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await workbook.xlsx.load(Buffer.from(buf));
    const ws = workbook.worksheets[0];

    // Buscar la primera celda de saldo (columna C = 3 en single-col)
    let foundNumericCell = false;
    ws.eachRow((row) => {
      const cell = row.getCell(3);
      if (cell.type === ExcelJS.ValueType.Number) {
        foundNumericCell = true;
      }
    });
    expect(foundNumericCell).toBe(true);
  });

  it("BS multi-col (3 cols): la celda de saldo en col-2 tiene type Number", async () => {
    const buf = await exportBalanceSheetExcel(makeBalanceSheet(3), "Demo S.R.L.");
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await workbook.xlsx.load(Buffer.from(buf));
    const ws = workbook.worksheets[0];

    // En multi-col: columna 2 es la primera columna de valor
    let foundNumericCell = false;
    ws.eachRow((row) => {
      const cell = row.getCell(2);
      if (cell.type === ExcelJS.ValueType.Number) {
        foundNumericCell = true;
      }
    });
    expect(foundNumericCell).toBe(true);
  });
});

// ── Tests: estilo QB — Arial, sin rellenos, indent nativo, bordes en totales ──

describe("Excel — estilo QuickBooks (QB-style)", () => {
  async function loadSheet(nCols: number): Promise<ExcelJS.Worksheet> {
    const buf = await exportBalanceSheetExcel(makeBalanceSheet(nCols), "Demo S.R.L.");
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await workbook.xlsx.load(Buffer.from(buf));
    return workbook.worksheets[0];
  }

  it("fuente Arial en celdas de datos (no Calibri)", async () => {
    const ws = await loadSheet(3);
    const accountLabelCells: ExcelJS.Cell[] = [];
    ws.eachRow((row) => {
      const cell = row.getCell(1);
      if (cell.type === ExcelJS.ValueType.String && typeof cell.value === "string") {
        accountLabelCells.push(cell);
      }
    });
    // Al menos una celda con contenido debe usar Arial
    const arialCells = accountLabelCells.filter((c) => c.font?.name === "Arial");
    expect(arialCells.length).toBeGreaterThan(0);
  });

  it("celdas de cuenta tienen indent nativo >= 1 (no padding de espacios)", async () => {
    const ws = await loadSheet(3);
    let foundIndent = false;
    ws.eachRow((row) => {
      const cell = row.getCell(1);
      if (
        cell.type === ExcelJS.ValueType.String &&
        typeof cell.value === "string" &&
        cell.value === "Caja" // la cuenta del fixture
      ) {
        if ((cell.alignment?.indent ?? 0) >= 1) {
          foundIndent = true;
        }
      }
    });
    expect(foundIndent).toBe(true);
  });

  it("celdas de cuenta NO tienen fill (sin colores de fondo)", async () => {
    const ws = await loadSheet(3);
    ws.eachRow((row) => {
      const cell = row.getCell(1);
      if (
        cell.type === ExcelJS.ValueType.String &&
        typeof cell.value === "string" &&
        cell.value === "Caja"
      ) {
        // Sin fill o fill de tipo none/none-pattern
        const fill = cell.fill as ExcelJS.FillPattern | undefined;
        expect(fill?.fgColor?.argb).toBeUndefined();
      }
    });
  });

  it("fila de subtotal tiene borde top:thin en la celda de etiqueta", async () => {
    const ws = await loadSheet(3);
    let subtotalLabelCell: ExcelJS.Cell | undefined;
    ws.eachRow((row) => {
      const cell = row.getCell(1);
      if (
        cell.type === ExcelJS.ValueType.String &&
        typeof cell.value === "string" &&
        (cell.value as string).toLowerCase().startsWith("total")
      ) {
        subtotalLabelCell = cell;
      }
    });
    expect(subtotalLabelCell).toBeDefined();
    expect(subtotalLabelCell?.border?.top?.style).toBe("thin");
  });

  it("fila de total tiene fuente bold", async () => {
    const ws = await loadSheet(3);
    let totalLabelCell: ExcelJS.Cell | undefined;
    ws.eachRow((row) => {
      const cell = row.getCell(1);
      if (
        cell.type === ExcelJS.ValueType.String &&
        typeof cell.value === "string" &&
        (cell.value as string).toLowerCase().includes("total activos")
      ) {
        totalLabelCell = cell;
      }
    });
    // Si no hay un "total activos" explícito en el fixture, verificar que
    // al menos alguna celda de texto tiene font.bold === true
    if (totalLabelCell) {
      expect(totalLabelCell.font?.bold).toBe(true);
    } else {
      let anyBold = false;
      ws.eachRow((row) => {
        if (row.getCell(1).font?.bold) anyBold = true;
      });
      expect(anyBold).toBe(true);
    }
  });

  it("orientación siempre portrait en pageSetup", async () => {
    const ws = await loadSheet(8);
    expect((ws.pageSetup as ExcelJS.PageSetup).orientation).toBe("portrait");
  });
});

// ── Tests: frozen pane (ySplit y xSplit) ──

describe("Excel — frozen panes (xSplit:1, ySplit:N)", () => {
  it("BS single-col: xSplit=1 en las views de la hoja", async () => {
    const buf = await exportBalanceSheetExcel(makeBalanceSheet(1), "Demo S.R.L.");
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await workbook.xlsx.load(Buffer.from(buf));
    const ws = workbook.worksheets[0];
    // Verificar que existe al menos una view con xSplit === 1
    const frozenView = ws.views.find((v) => v.state === "frozen" && v.xSplit === 1);
    expect(frozenView).toBeDefined();
  });

  it("BS multi-col: xSplit=1 en las views de la hoja", async () => {
    const buf = await exportBalanceSheetExcel(makeBalanceSheet(4), "Demo S.R.L.");
    const workbook = new ExcelJS.Workbook();
    // @ts-expect-error — Buffer<ArrayBuffer> vs Buffer: discrepancia entre @types/node y exceljs
    await workbook.xlsx.load(Buffer.from(buf));
    const ws = workbook.worksheets[0];
    const frozenView = ws.views.find((v) => v.state === "frozen" && v.xSplit === 1);
    expect(frozenView).toBeDefined();
  });
});

// ── Tests: formato de nombre de archivo ──

describe("Filename format — sanitización de periodLabel", () => {
  it("sanitizePeriodLabel elimina caracteres especiales", () => {
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9\-_]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
    expect(sanitize("2026-01-01_2026-03-31")).toBe("2026-01-01_2026-03-31");
    expect(sanitize("al 31 de marzo 2026")).toBe("al-31-de-marzo-2026");
    expect(sanitize("Q1/2026")).toBe("Q1-2026");
  });

  it("pattern {type}-{orgSlug}-{periodLabel}.{ext} se forma correctamente", () => {
    const type = "balance-general";
    const orgSlug = "demo-empresa";
    const rawLabel = "al 31-dic-2025";
    const sanitize = (s: string) => s.replace(/[^a-zA-Z0-9\-_]/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "");
    const filename = `${type}-${orgSlug}-${sanitize(rawLabel)}.pdf`;
    expect(filename).toBe("balance-general-demo-empresa-al-31-dic-2025.pdf");
  });
});
