/**
 * T09 — XLSX exporter smoke tests.
 *
 * Covers: REQ-7 (pérdida parentheses via numFmt), REQ-11 (xlsx format), REQ-12 (A4 landscape sheet)
 */

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { Prisma } from "@/generated/prisma/client";
import { exportEquityStatementXlsx } from "../equity-statement-xlsx.exporter";
import type { EquityStatement } from "../../equity-statement.types";

const D = (v: string | number) => new Prisma.Decimal(String(v));

function makeStatement(overrides: Partial<EquityStatement> = {}): EquityStatement {
  const ZERO = D("0");
  const columnTotals = {
    CAPITAL_SOCIAL: D("5000"),
    APORTES_CAPITALIZAR: ZERO,
    AJUSTE_CAPITAL: ZERO,
    RESERVA_LEGAL: ZERO,
    RESULTADOS_ACUMULADOS: D("1000"),
    OTROS_PATRIMONIO: ZERO,
  };

  return {
    orgId: "org-1",
    dateFrom: new Date("2024-01-01"),
    dateTo: new Date("2024-12-31"),
    columns: [
      { key: "CAPITAL_SOCIAL",        label: "Capital Social",        visible: true  },
      { key: "APORTES_CAPITALIZAR",   label: "Aportes p/ Capitalizar", visible: true },
      { key: "AJUSTE_CAPITAL",        label: "Ajuste de Capital",      visible: true  },
      { key: "RESERVA_LEGAL",         label: "Reserva Legal",          visible: true  },
      { key: "RESULTADOS_ACUMULADOS", label: "Resultados Acumulados",  visible: true  },
      { key: "OTROS_PATRIMONIO",      label: "Otros Patrimonio",       visible: false },
    ],
    rows: [
      {
        key: "SALDO_INICIAL",
        label: "Saldo al inicio del período",
        cells: [
          { column: "CAPITAL_SOCIAL",        amount: D("5000") },
          { column: "APORTES_CAPITALIZAR",   amount: ZERO },
          { column: "AJUSTE_CAPITAL",        amount: ZERO },
          { column: "RESERVA_LEGAL",         amount: ZERO },
          { column: "RESULTADOS_ACUMULADOS", amount: ZERO },
          { column: "OTROS_PATRIMONIO",      amount: ZERO },
        ],
        total: D("5000"),
      },
      {
        key: "RESULTADO_EJERCICIO",
        label: "Resultado del ejercicio",
        cells: [
          { column: "CAPITAL_SOCIAL",        amount: ZERO },
          { column: "APORTES_CAPITALIZAR",   amount: ZERO },
          { column: "AJUSTE_CAPITAL",        amount: ZERO },
          { column: "RESERVA_LEGAL",         amount: ZERO },
          { column: "RESULTADOS_ACUMULADOS", amount: D("1000") },
          { column: "OTROS_PATRIMONIO",      amount: ZERO },
        ],
        total: D("1000"),
      },
      {
        key: "SALDO_FINAL",
        label: "Saldo al cierre del período",
        cells: [
          { column: "CAPITAL_SOCIAL",        amount: D("5000") },
          { column: "APORTES_CAPITALIZAR",   amount: ZERO },
          { column: "AJUSTE_CAPITAL",        amount: ZERO },
          { column: "RESERVA_LEGAL",         amount: ZERO },
          { column: "RESULTADOS_ACUMULADOS", amount: D("1000") },
          { column: "OTROS_PATRIMONIO",      amount: ZERO },
        ],
        total: D("6000"),
      },
    ],
    columnTotals,
    grandTotal: D("6000"),
    periodResult: D("1000"),
    imbalanced: false,
    imbalanceDelta: ZERO,
    preliminary: false,
    ...overrides,
  };
}

async function loadWorkbook(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  // Cast required: ExcelJS types expect the narrow Buffer without generic param
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  return wb;
}

describe("exportEquityStatementXlsx — smoke tests", () => {
  it("buffer starts with PK (zip/xlsx magic bytes)", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement(), "Cooperativa Test");
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  it("buffer size is in [5_000, 200_000] bytes", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement(), "Cooperativa Test");
    expect(buf.length).toBeGreaterThan(5_000);
    expect(buf.length).toBeLessThan(200_000);
  });

  it("workbook has sheet named EEPN", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement(), "Cooperativa Test");
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN");
    expect(ws).toBeDefined();
  });

  it("row 1 cell A1 contains 'ESTADO DE EVOLUCIÓN DEL PATRIMONIO NETO'", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement(), "Cooperativa Test");
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN")!;
    const cellValue = ws.getRow(1).getCell(1).value;
    expect(String(cellValue)).toContain("ESTADO DE EVOLUCIÓN DEL PATRIMONIO NETO");
  });

  it("row 2 contains org name", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement(), "Cooperativa Test");
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN")!;
    const cellValue = ws.getRow(2).getCell(1).value;
    expect(String(cellValue)).toContain("Cooperativa Test");
  });

  it("data rows start at row 8 (SALDO_INICIAL label present)", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement(), "Cooperativa Test");
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN")!;
    const cellValue = ws.getRow(8).getCell(1).value;
    expect(String(cellValue)).toContain("Saldo al inicio del período");
  });

  it("SALDO_FINAL row (row 10) has numeric value for CAPITAL_SOCIAL column", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement(), "Cooperativa Test");
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN")!;
    // Row 10 = SALDO_FINAL; column 2 = first numeric (CAPITAL_SOCIAL visible)
    const cell = ws.getRow(10).getCell(2);
    expect(typeof cell.value).toBe("number");
    expect(cell.value).toBe(5000);
  });

  it("numFmt uses accounting format #,##0.00;(#,##0.00) on SALDO_FINAL row", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement(), "Cooperativa Test");
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN")!;
    const cell = ws.getRow(10).getCell(2);
    expect(cell.numFmt).toBe("#,##0.00;(#,##0.00)");
  });

  it("pageSetup has A4 landscape orientation", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement(), "Cooperativa Test");
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN")!;
    expect(ws.pageSetup.orientation).toBe("landscape");
    expect(ws.pageSetup.paperSize).toBe(9); // 9 = A4
  });

  it("preliminary=true adds PRELIMINAR banner in row 6", async () => {
    const buf = await exportEquityStatementXlsx(makeStatement({ preliminary: true }), "Cooperativa Test");
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN")!;
    const cellValue = String(ws.getRow(6).getCell(1).value ?? "");
    expect(cellValue).toContain("PRELIMINAR");
  });

  it("imbalanced=true adds ADVERTENCIA banner in row 6", async () => {
    const buf = await exportEquityStatementXlsx(
      makeStatement({ imbalanced: true, imbalanceDelta: D("0.05") }),
      "Cooperativa Test",
    );
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN")!;
    const cellValue = String(ws.getRow(6).getCell(1).value ?? "");
    expect(cellValue).toContain("ADVERTENCIA");
  });

  it("negative total stored as negative number (numFmt parentheses handled by Excel)", async () => {
    const stmt = makeStatement({
      rows: [
        {
          key: "SALDO_INICIAL",
          label: "Saldo al inicio del período",
          cells: [
            { column: "CAPITAL_SOCIAL",        amount: D("0") },
            { column: "APORTES_CAPITALIZAR",   amount: D("0") },
            { column: "AJUSTE_CAPITAL",        amount: D("0") },
            { column: "RESERVA_LEGAL",         amount: D("0") },
            { column: "RESULTADOS_ACUMULADOS", amount: D("0") },
            { column: "OTROS_PATRIMONIO",      amount: D("0") },
          ],
          total: D("0"),
        },
        {
          key: "RESULTADO_EJERCICIO",
          label: "Resultado del ejercicio",
          cells: [
            { column: "CAPITAL_SOCIAL",        amount: D("0") },
            { column: "APORTES_CAPITALIZAR",   amount: D("0") },
            { column: "AJUSTE_CAPITAL",        amount: D("0") },
            { column: "RESERVA_LEGAL",         amount: D("0") },
            { column: "RESULTADOS_ACUMULADOS", amount: D("-15000") },
            { column: "OTROS_PATRIMONIO",      amount: D("0") },
          ],
          total: D("-15000"),
        },
        {
          key: "SALDO_FINAL",
          label: "Saldo al cierre del período",
          cells: [
            { column: "CAPITAL_SOCIAL",        amount: D("0") },
            { column: "APORTES_CAPITALIZAR",   amount: D("0") },
            { column: "AJUSTE_CAPITAL",        amount: D("0") },
            { column: "RESERVA_LEGAL",         amount: D("0") },
            { column: "RESULTADOS_ACUMULADOS", amount: D("-15000") },
            { column: "OTROS_PATRIMONIO",      amount: D("0") },
          ],
          total: D("-15000"),
        },
      ],
    });
    const buf = await exportEquityStatementXlsx(stmt, "Cooperativa Test");
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("EEPN")!;
    // Row 10 = SALDO_FINAL; last visible numeric col = RESULTADOS_ACUMULADOS (col 6 of visible = index 6)
    // Concepto(1) + CAPITAL_SOCIAL(2) + APORTES_CAPITALIZAR(3) + AJUSTE_CAPITAL(4) + RESERVA_LEGAL(5) + RESULTADOS_ACUMULADOS(6) + Total(7)
    const totalCell = ws.getRow(10).getCell(7); // Total Patrimonio column
    expect(totalCell.value).toBe(-15000);
    expect(totalCell.numFmt).toBe("#,##0.00;(#,##0.00)");
  });
});
