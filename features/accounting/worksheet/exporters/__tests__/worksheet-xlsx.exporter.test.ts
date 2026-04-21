/**
 * T19 — RED: XLSX exporter tests.
 *
 * Parses the buffer via ExcelJS and asserts structure/values.
 * Covers REQ-13 (accounting format, contra negation, subtotal bold, 14 columns, frozen pane).
 */

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { Prisma } from "@/generated/prisma/client";
import { exportWorksheetXlsx } from "../worksheet-xlsx.exporter";
import type { WorksheetReport } from "../../worksheet.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const z = () => D(0);

function makeZeroTotals() {
  return {
    sumasDebe: z(), sumasHaber: z(), saldoDeudor: z(), saldoAcreedor: z(),
    ajustesDebe: z(), ajustesHaber: z(), saldoAjDeudor: z(), saldoAjAcreedor: z(),
    resultadosPerdidas: z(), resultadosGanancias: z(), bgActivo: z(), bgPasPat: z(),
  };
}

/**
 * Minimal fixture report covering:
 * - One ACTIVO row (Caja: bgActivo=183848)
 * - One ACTIVO row that is a contra (Depreciación: bgActivo=-120000)
 * - One INGRESO row (Ventas: resultadosGanancias=80000)
 * - One GASTO row (Costos: resultadosPerdidas=60000)
 * - Carry-over row (Ganancia: 20000)
 */
const fixtureReport: WorksheetReport = {
  orgId: "org-1",
  dateFrom: new Date("2025-01-01"),
  dateTo: new Date("2025-12-31"),
  groups: [
    {
      accountType: "ACTIVO",
      rows: [
        {
          accountId: "caja",
          code: "1.1.1",
          name: "Caja",
          isContraAccount: false,
          accountType: "ACTIVO",
          isCarryOver: false,
          sumasDebe: D("207000"), sumasHaber: D("23152"),
          saldoDeudor: D("183848"), saldoAcreedor: z(),
          ajustesDebe: z(), ajustesHaber: z(),
          saldoAjDeudor: D("183848"), saldoAjAcreedor: z(),
          resultadosPerdidas: z(), resultadosGanancias: z(),
          bgActivo: D("183848"), bgPasPat: z(),
        },
        {
          accountId: "depr",
          code: "1.2.6",
          name: "Depreciación Acumulada",
          isContraAccount: true,
          accountType: "ACTIVO",
          isCarryOver: false,
          sumasDebe: z(), sumasHaber: D("120000"),
          saldoDeudor: z(), saldoAcreedor: D("120000"),
          ajustesDebe: z(), ajustesHaber: z(),
          saldoAjDeudor: z(), saldoAjAcreedor: D("120000"),
          resultadosPerdidas: z(), resultadosGanancias: z(),
          bgActivo: D("-120000"), bgPasPat: z(),
        },
      ],
      subtotals: {
        ...makeZeroTotals(),
        sumasDebe: D("207000"), sumasHaber: D("143152"),
        saldoDeudor: D("183848"), saldoAcreedor: D("120000"),
        saldoAjDeudor: D("183848"), saldoAjAcreedor: D("120000"),
        bgActivo: D("63848"),
      },
    },
    {
      accountType: "INGRESO",
      rows: [
        {
          accountId: "vtas",
          code: "4.1.1",
          name: "Ventas",
          isContraAccount: false,
          accountType: "INGRESO",
          isCarryOver: false,
          sumasDebe: z(), sumasHaber: D("80000"),
          saldoDeudor: z(), saldoAcreedor: D("80000"),
          ajustesDebe: z(), ajustesHaber: z(),
          saldoAjDeudor: z(), saldoAjAcreedor: D("80000"),
          resultadosPerdidas: z(), resultadosGanancias: D("80000"),
          bgActivo: z(), bgPasPat: z(),
        },
      ],
      subtotals: { ...makeZeroTotals(), sumasHaber: D("80000"), saldoAcreedor: D("80000"), saldoAjAcreedor: D("80000"), resultadosGanancias: D("80000") },
    },
    {
      accountType: "GASTO",
      rows: [
        {
          accountId: "costo",
          code: "5.1.1",
          name: "Costo de Ventas",
          isContraAccount: false,
          accountType: "GASTO",
          isCarryOver: false,
          sumasDebe: D("60000"), sumasHaber: z(),
          saldoDeudor: D("60000"), saldoAcreedor: z(),
          ajustesDebe: z(), ajustesHaber: z(),
          saldoAjDeudor: D("60000"), saldoAjAcreedor: z(),
          resultadosPerdidas: D("60000"), resultadosGanancias: z(),
          bgActivo: z(), bgPasPat: z(),
        },
      ],
      subtotals: { ...makeZeroTotals(), sumasDebe: D("60000"), saldoDeudor: D("60000"), saldoAjDeudor: D("60000"), resultadosPerdidas: D("60000") },
    },
  ],
  carryOverRow: {
    accountId: "__carry_over__",
    code: "—",
    name: "Ganancia del Ejercicio",
    isContraAccount: false,
    accountType: "INGRESO",
    isCarryOver: true,
    sumasDebe: z(), sumasHaber: z(), saldoDeudor: z(), saldoAcreedor: z(),
    ajustesDebe: z(), ajustesHaber: z(), saldoAjDeudor: z(), saldoAjAcreedor: z(),
    resultadosPerdidas: D("20000"), resultadosGanancias: z(),
    bgActivo: z(), bgPasPat: D("20000"),
  },
  grandTotals: {
    sumasDebe: D("267000"), sumasHaber: D("223152"),
    saldoDeudor: D("243848"), saldoAcreedor: D("200000"),
    ajustesDebe: z(), ajustesHaber: z(),
    saldoAjDeudor: D("243848"), saldoAjAcreedor: D("200000"),
    resultadosPerdidas: D("80000"), resultadosGanancias: D("80000"),
    bgActivo: D("83848"), bgPasPat: D("20000"),
  },
  imbalanced: true,
  imbalanceDelta: D("63848"),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("exportWorksheetXlsx (REQ-13)", () => {
  let buffer: Buffer<ArrayBufferLike>;
  let workbook: ExcelJS.Workbook;
  let ws: ExcelJS.Worksheet;

  it("produces a Buffer (not null/undefined)", async () => {
    buffer = await exportWorksheetXlsx(fixtureReport, "Test Org");
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("can be parsed by ExcelJS", async () => {
    workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
    ws = workbook.worksheets[0];
    expect(ws).toBeDefined();
  });

  it("REQ-13.S4: exactly 14 columns (A=Código, B=Cuenta, C-N=12 numeric)", () => {
    // Header row 7 should have values in columns 1-14
    const headerRow = ws.getRow(7);
    // C7 = "Debe" (Sumas Debe)
    expect(headerRow.getCell(3).value).toBe("Debe");
    // M7 = "Activo" (BG Activo)
    expect(headerRow.getCell(13).value).toBe("Activo");
    // N7 = "Pas-Pat"
    expect(headerRow.getCell(14).value).toBe("Pas-Pat");
  });

  it("REQ-13.S1: numeric cells have accounting numFmt", () => {
    // Find the Caja row (first data row after headers in row 8+)
    let cajaRow: ExcelJS.Row | undefined;
    ws.eachRow((row) => {
      if (row.getCell(1).value === "1.1.1") {
        cajaRow = row;
      }
    });
    expect(cajaRow).toBeDefined();
    // Column C (sumasDebe = 207000): should have accounting format
    const cell = cajaRow!.getCell(3);
    expect(cell.numFmt).toBe("#,##0.00;(#,##0.00)");
  });

  it("REQ-13.S2: contra-account bgActivo cell value is a negative number", () => {
    // Find the Depreciación Acumulada row
    let deprRow: ExcelJS.Row | undefined;
    ws.eachRow((row) => {
      if (row.getCell(1).value === "1.2.6") {
        deprRow = row;
      }
    });
    expect(deprRow).toBeDefined();
    // Column M = bgActivo = -120000 (native negative number)
    const bgActivoCell = deprRow!.getCell(13);
    expect(typeof bgActivoCell.value).toBe("number");
    expect(bgActivoCell.value as number).toBe(-120000);
  });

  it("REQ-13.S3: subtotal rows have bold font", () => {
    // Find a subtotal row (ACTIVO subtotal should be bold)
    let subtotalFound = false;
    ws.eachRow((row) => {
      if (row.getCell(2).value === "ACTIVO" || row.getCell(2).value === "Total ACTIVO") {
        subtotalFound = true;
        // At least one bold cell in the row or whole row bold
        const cell = row.getCell(2);
        expect(cell.font?.bold).toBe(true);
      }
    });
    expect(subtotalFound).toBe(true);
  });

  it("frozen pane: xSplit=2, ySplit=7 (REQ-13, design §6)", () => {
    const views = ws.views as ExcelJS.WorksheetView[];
    expect(views).toBeDefined();
    const frozenView = views.find((v) => v.state === "frozen");
    expect(frozenView).toBeDefined();
    expect(frozenView!.xSplit).toBe(2);
    expect(frozenView!.ySplit).toBe(7);
  });

  /**
   * Option A zero-value rendering (Bolivian accounting convention):
   *   - Detail rows: zero values → empty string "" (no noise on 200-row worksheets)
   *   - Subtotal/grand-total rows: zero values → numeric 0 (renders as "0.00" via numFmt)
   * Decision confirmed by user 2026-04-20.
   */
  it("Option A: detail row zero cell is empty string (not 0)", () => {
    // Ventas row: sumasDebe = 0 (column C = index 3)
    let ventasRow: ExcelJS.Row | undefined;
    ws.eachRow((row) => {
      if (row.getCell(1).value === "4.1.1") {
        ventasRow = row;
      }
    });
    expect(ventasRow).toBeDefined();
    // sumasDebe for Ventas = 0 → must be empty string, not the number 0
    const sumasDebeCell = ventasRow!.getCell(3);
    expect(sumasDebeCell.value).toBe("");
  });

  it("Option A: subtotal row zero cell is numeric 0 (not empty string)", () => {
    // GASTO subtotal: ajustesDebe and ajustesHaber are both 0
    // Locate the GASTO subtotal row (bold + col2 contains "GASTO" or "Total GASTO")
    let gastoSubtotalRow: ExcelJS.Row | undefined;
    ws.eachRow((row) => {
      const c2 = row.getCell(2).value;
      if (typeof c2 === "string" && c2.includes("GASTO") && row.getCell(2).font?.bold) {
        gastoSubtotalRow = row;
      }
    });
    expect(gastoSubtotalRow).toBeDefined();
    // ajustesDebe = col G (index 7) — subtotal for GASTO group is 0 → must be numeric 0
    const ajustesDebeCell = gastoSubtotalRow!.getCell(7);
    expect(typeof ajustesDebeCell.value).toBe("number");
    expect(ajustesDebeCell.value as number).toBe(0);
  });

  it("Option A: grand total row zero cell is numeric 0", () => {
    // Grand totals row: ajustesDebe = 0 (col G = index 7)
    // Grand totals is the last row with double-border — look for the row that has all 12 numeric cells
    // It follows the carry-over row. We identify it by bold font on col2 and a non-empty col3.
    let grandTotalRow: ExcelJS.Row | undefined;
    ws.eachRow((row) => {
      const c2 = row.getCell(2).value;
      if (typeof c2 === "string" && c2.toLowerCase().includes("total")) {
        const c3 = row.getCell(3).value;
        if (typeof c3 === "number" && (c3 as number) > 0) {
          grandTotalRow = row;
        }
      }
    });
    expect(grandTotalRow).toBeDefined();
    // ajustesDebe in grand totals = 0 → numeric 0
    const ajustesDebeCell = grandTotalRow!.getCell(7);
    expect(typeof ajustesDebeCell.value).toBe("number");
    expect(ajustesDebeCell.value as number).toBe(0);
  });

  it("Option A: non-zero detail cell is numeric value", () => {
    // Caja row: sumasDebe = 207000 (col C = index 3) — non-zero → numeric number
    let cajaRow: ExcelJS.Row | undefined;
    ws.eachRow((row) => {
      if (row.getCell(1).value === "1.1.1") {
        cajaRow = row;
      }
    });
    expect(cajaRow).toBeDefined();
    const cell = cajaRow!.getCell(3);
    expect(typeof cell.value).toBe("number");
    expect(cell.value as number).toBe(207000);
  });
});
