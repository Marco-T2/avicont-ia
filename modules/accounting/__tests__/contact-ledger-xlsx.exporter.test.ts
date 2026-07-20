/**
 * Tests para `exportContactLedgerXlsx`.
 *
 * Cobertura (mirror del sister `ledger-xlsx.exporter.test.ts` adaptado a
 * contact-ledger — 8 columnas + subtítulo nombre contacto + Estado):
 * - Sheet name "Libro Mayor por Contacto".
 * - Header rows con empresa + nombre contacto + período.
 * - Column headers en row 7 (8 cols).
 * - Opening balance row decorativa.
 * - Decimal numFmt es-BO.
 * - Frozen pane ySplit=7.
 * - Buffer ZIP válido.
 * - Estado cell humanizado.
 * - Tipo cell humanizado.
 *
 * Sister precedent paired (apply directly per [[paired_sister_default_no_surface]]):
 *   modules/accounting/__tests__/ledger-xlsx.exporter.test.ts
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   El módulo `infrastructure/exporters/contact-ledger/contact-ledger-xlsx.exporter`
 *   no existe → import resolution fails.
 */

import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";
import {
  exportContactLedgerXlsx,
  type ContactLedgerXlsxOptions,
} from "../infrastructure/exporters/contact-ledger/contact-ledger-xlsx.exporter";
import type { ContactLedgerEntry } from "../domain/ledger.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides?: Partial<ContactLedgerEntry>): ContactLedgerEntry {
  return {
    entryId: "je-1",
    date: new Date("2025-06-15"),
    entryNumber: 1,
    voucherCode: "CD",
    description: "Venta a cliente",
    debit: "1234567.89",
    credit: "0.00",
    balance: "1234567.89",
    status: "PENDING",
    dueDate: null,
    voucherTypeHuman: "Nota de despacho",
    sourceType: "sale",
    paymentMethod: null,
    bankAccountName: null,
    withoutAuxiliary: false,
    paymentDirection: null,
    documentTypeCode: null,
    documentReferenceNumber: null,
    ...overrides,
  };
}

function makeOpts(
  overrides?: Partial<ContactLedgerXlsxOptions>,
): ContactLedgerXlsxOptions {
  return {
    contactName: "Distribuidora ACME SRL",
    dateFrom: "2025-01-01",
    dateTo: "2025-12-31",
    openingBalance: "0.00",
    ...overrides,
  };
}

async function parseWorkbook(buffer: any): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

const SHEET = "Libro Mayor por Contacto";

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("exportContactLedgerXlsx — sheet structure", () => {
  it("sheet name es 'Libro Mayor por Contacto'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    expect(wb.getWorksheet(SHEET)).toBeDefined();
  });
});

describe("exportContactLedgerXlsx — header rows", () => {
  it("row 1 título 'LIBRO MAYOR POR CONTACTO'; row 2 empresa", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
      "1001",
      "Av. Principal 123",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(1).getCell(1).value).toBe("LIBRO MAYOR POR CONTACTO");
    expect(sheet.getRow(2).getCell(1).value).toBe("Empresa: Avicont SA");
  });

  it("row 3 contiene NIT + dirección", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
      "1001",
      "Av. Principal 123",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    const line3 = sheet.getRow(3).getCell(1).value as string;
    expect(line3).toContain("NIT: 1001");
    expect(line3).toContain("Av. Principal 123");
  });

  it("row 4 muestra 'Contacto: {contactName}'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts({ contactName: "Distribuidora ACME SRL" }),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    const contactoCell = sheet.getRow(4).getCell(1).value as string;
    expect(contactoCell).toContain("Contacto:");
    expect(contactoCell).toContain("Distribuidora ACME SRL");
  });

  it("row 5 muestra período DD/MM/YYYY", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts({ dateFrom: "2025-01-01", dateTo: "2025-12-31" }),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    const period = sheet.getRow(5).getCell(1).value as string;
    expect(period).toContain("01/01/2025");
    expect(period).toContain("31/12/2025");
  });

  it("row 6 es '(Expresado en Bolivianos)'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    const expresado = sheet.getRow(6).getCell(1).value as string;
    expect(expresado).toBe("(Expresado en Bolivianos)");
  });
});

describe("exportContactLedgerXlsx — column headers (row 7, 8 cols)", () => {
  it("row 7 tiene los 8 column headers", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    const row7 = sheet.getRow(7);
    expect(row7.getCell(1).value).toBe("Fecha");
    expect(row7.getCell(2).value).toBe("Tipo");
    expect(row7.getCell(3).value).toBe("Nº");
    expect(row7.getCell(4).value).toBe("Estado");
    expect(row7.getCell(5).value).toBe("Descripción");
    expect(row7.getCell(6).value).toBe("Debe");
    expect(row7.getCell(7).value).toBe("Haber");
    expect(row7.getCell(8).value).toBe("Saldo");
  });
});

describe("exportContactLedgerXlsx — opening balance row", () => {
  it("opening !== '0.00' → row 8 es 'Saldo inicial acumulado' (col 5 = Descripción)", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts({ openingBalance: "5000.00" }),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(5).value).toBe("Saldo inicial acumulado");
    expect(sheet.getRow(8).getCell(8).value).toBe(5000);
  });

  it("opening === '0.00' → row 8 es primera fila de datos (sin opening)", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts({ openingBalance: "0.00" }),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(5).value).not.toBe("Saldo inicial acumulado");
    // Col 3 = Nº; raw entryNumber (REQ-DISPLAY-2 — displayNumber retired T2.2)
    expect(sheet.getRow(8).getCell(3).value).toBe(1);
  });
});

describe("exportContactLedgerXlsx — data row Estado/Tipo cells", () => {
  it("withoutAuxiliary=true (sin documentTypeCode) → Estado '—' (collapsed muted dash per Marco bug #3 fix), Tipo 'Ajuste' (fallback)", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          status: null,
          sourceType: null,
          withoutAuxiliary: true,
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    // row 8 col 4 = Estado, col 2 = Tipo
    expect(sheet.getRow(8).getCell(4).value).toBe("—");
    expect(sheet.getRow(8).getCell(2).value).toBe("Ajuste");
  });

  it("withoutAuxiliary=true + documentTypeCode='RC' → Estado '—', Tipo 'RC' (Marco bug #3 fix: asiento manual con doc físico — code wins over withoutAuxiliary)", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          status: null,
          sourceType: null,
          withoutAuxiliary: true,
          documentTypeCode: "RC",
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(4).value).toBe("—");
    expect(sheet.getRow(8).getCell(2).value).toBe("RC");
  });

  it("status=PENDING + dueDate < hoy → 'ATRASADO'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          status: "PENDING",
          dueDate: "2020-01-01T00:00:00.000Z",
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(4).value).toBe("ATRASADO");
  });

  it("sourceType=receipt + EFECTIVO → Tipo 'Cobranza (efectivo)'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          sourceType: "receipt",
          paymentMethod: "EFECTIVO",
          bankAccountName: null,
          status: null,
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(2).value).toBe("Cobranza (efectivo)");
  });

  it("BF3 — sourceType=payment + paymentDirection=COBRO + EFECTIVO → Tipo 'Cobranza (efectivo)' (bug #1 root)", async () => {
    // Bug #1: producción crea TODOS los payments con sourceType="payment"
    // (el valor "receipt" no se usa runtime). renderTipo en XLSX exporter
    // pasa a usar paymentDirection como discriminador.
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          sourceType: "payment",
          paymentDirection: "COBRO",
          paymentMethod: "EFECTIVO",
          bankAccountName: null,
          status: null,
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(2).value).toBe("Cobranza (efectivo)");
  });

  // ── DT — código operacional físico (Marco QA) ──

  it("DT — sourceType=sale + documentTypeCode='VG' → Tipo 'VG'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          sourceType: "sale",
          documentTypeCode: "VG",
          voucherTypeHuman: "Nota de despacho",
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(2).value).toBe("VG");
  });

  it("DT — sourceType=payment + documentTypeCode='RC' + EFECTIVO → Tipo 'RC (efectivo)'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          sourceType: "payment",
          paymentDirection: "COBRO",
          paymentMethod: "EFECTIVO",
          bankAccountName: null,
          documentTypeCode: "RC",
          status: null,
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(2).value).toBe("RC (efectivo)");
  });

  it("DT — sourceType=dispatch + documentTypeCode='ND' → Tipo 'ND' plano", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          sourceType: "dispatch",
          documentTypeCode: "ND",
          voucherTypeHuman: "Nota de despacho",
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(2).value).toBe("ND");
  });

  it("DT — sourceType=purchase + documentTypeCode='FL' → Tipo 'FL' plano", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          sourceType: "purchase",
          documentTypeCode: "FL",
          voucherTypeHuman: "Compra de flete",
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(2).value).toBe("FL");
  });
});

// ── DT4 — número físico del documento en la columna Nº (QA Marco) ──
//
// Cell Nº (col C = idx 3 en 8-col layout) muestra documentReferenceNumber con
// fallback al raw entryNumber del JournalEntry cuando es null. Mirror UI/PDF.
// Formato `${prefix}-${padded}` retirado per REQ-DISPLAY-2.

describe("exportContactLedgerXlsx — Nº column (DT4 documentReferenceNumber)", () => {
  it("DT4 — sale con documentReferenceNumber='1' → cell C8 muestra '1'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          sourceType: "sale",
          documentTypeCode: "VG",
          documentReferenceNumber: "1",
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(3).value).toBe("1");
  });

  it("DT4 — payment con documentReferenceNumber='42' → cell C8 muestra '42'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          sourceType: "payment",
          paymentDirection: "COBRO",
          paymentMethod: "EFECTIVO",
          bankAccountName: null,
          documentTypeCode: "RC",
          documentReferenceNumber: "42",
          status: null,
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(3).value).toBe("42");
  });

  it("DT4 — withoutAuxiliary=true + documentReferenceNumber=null → cell C8 cae al raw entryNumber", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          entryNumber: 11,
          sourceType: null,
          status: null,
          withoutAuxiliary: true,
          documentTypeCode: null,
          documentReferenceNumber: null,
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(3).value).toBe(11);
  });

  it("DT4 — payment sin referenceNumber (documentReferenceNumber=null) → cell C8 cae al raw entryNumber", async () => {
    const buffer = await exportContactLedgerXlsx(
      [
        makeEntry({
          entryNumber: 50,
          sourceType: "payment",
          paymentDirection: "COBRO",
          paymentMethod: "EFECTIVO",
          bankAccountName: null,
          documentTypeCode: "RC",
          documentReferenceNumber: null,
          status: null,
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    expect(sheet.getRow(8).getCell(3).value).toBe(50);
  });
});

describe("exportContactLedgerXlsx — numFmt", () => {
  it("cells numéricas no-cero tienen numFmt '#,##0.00;(#,##0.00)'", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    // row 8 col 6 = Debe (en 8-col layout)
    expect(sheet.getRow(8).getCell(6).numFmt).toBe("#,##0.00;(#,##0.00)");
  });
});

describe("exportContactLedgerXlsx — frozen pane", () => {
  it("frozen pane ySplit=7 (lock header rows)", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet(SHEET)!;
    const view = sheet.views[0] as unknown as { state: string; ySplit: number };
    expect(view.state).toBe("frozen");
    expect(view.ySplit).toBe(7);
  });
});

describe("exportContactLedgerXlsx — buffer signature", () => {
  it("buffer es ZIP válido (PK magic bytes)", async () => {
    const buffer = await exportContactLedgerXlsx(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    expect(buffer[0]).toBe(0x50); // 'P'
    expect(buffer[1]).toBe(0x4b); // 'K'
  });
});
