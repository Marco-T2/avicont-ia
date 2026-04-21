/**
 * T15 — XLSX exporter smoke tests.
 *
 * Covers: sheet name "Balance Inicial", numFmt with 2 decimal places, A4 portrait page setup.
 */

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import { Prisma } from "@/generated/prisma/client";
import { exportInitialBalanceXlsx } from "../initial-balance-xlsx.exporter";
import { buildInitialBalance } from "../../initial-balance.builder";
import type { InitialBalanceRow } from "../../initial-balance.types";

const D = (v: string | number) => new Prisma.Decimal(String(v));

function makeStatement() {
  const rows: InitialBalanceRow[] = [
    {
      accountId: "acc-1",
      code: "1100",
      name: "Caja",
      subtype: "ACTIVO_CORRIENTE",
      amount: D("50000"),
    },
    {
      accountId: "acc-2",
      code: "1200",
      name: "Banco Nacional",
      subtype: "ACTIVO_CORRIENTE",
      amount: D("120000"),
    },
    {
      accountId: "acc-3",
      code: "1500",
      name: "Muebles y Enseres",
      subtype: "ACTIVO_NO_CORRIENTE",
      amount: D("30000"),
    },
    {
      accountId: "acc-4",
      code: "2100",
      name: "Proveedores",
      subtype: "PASIVO_CORRIENTE",
      amount: D("80000"),
    },
    {
      accountId: "acc-5",
      code: "3100",
      name: "Capital Social",
      subtype: "PATRIMONIO_CAPITAL",
      amount: D("120000"),
    },
  ];

  return buildInitialBalance({
    orgId: "org-test",
    org: {
      razonSocial: "Cooperativa Avicont S.A.",
      nit: "123456789",
      representanteLegal: "Juan Pérez García",
      direccion: "Av. Arce 123, La Paz",
    },
    dateAt: new Date("2018-01-02"),
    rows,
    caCount: 1,
  });
}

async function loadWorkbook(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as Parameters<typeof wb.xlsx.load>[0]);
  return wb;
}

describe("exportInitialBalanceXlsx — smoke tests", () => {
  it("buffer starts with PK (zip/xlsx magic bytes)", async () => {
    const buf = await exportInitialBalanceXlsx(makeStatement());
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  it("workbook has exactly one worksheet named 'Balance Inicial'", async () => {
    const buf = await exportInitialBalanceXlsx(makeStatement());
    const wb = await loadWorkbook(buf);
    expect(wb.worksheets.length).toBe(1);
    const ws = wb.getWorksheet("Balance Inicial");
    expect(ws).toBeDefined();
  });

  it("numeric amount cells have numFmt with 2 decimal places", async () => {
    const buf = await exportInitialBalanceXlsx(makeStatement());
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("Balance Inicial")!;

    // Scan all rows for numeric cells and verify their numFmt has 2 decimals
    let foundNumericCell = false;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        if (typeof cell.value === "number" && cell.numFmt) {
          foundNumericCell = true;
          // Must contain .00 or equivalent 2-decimal pattern
          expect(cell.numFmt).toMatch(/0\.00/);
        }
      });
    });
    expect(foundNumericCell).toBe(true);
  });

  it("page setup is A4 portrait", async () => {
    const buf = await exportInitialBalanceXlsx(makeStatement());
    const wb = await loadWorkbook(buf);
    const ws = wb.getWorksheet("Balance Inicial")!;
    expect(ws.pageSetup.paperSize).toBe(9); // 9 = A4
    expect(ws.pageSetup.orientation).toBe("portrait");
  });
});
