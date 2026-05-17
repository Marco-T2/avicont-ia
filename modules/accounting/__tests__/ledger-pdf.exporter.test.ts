/**
 * Tests para `exportLedgerPdf`.
 *
 * Cobertura:
 * - Shape del docDef (A4 portrait, 7 cols, header con cuenta + período).
 * - Opening balance row decorativa (presente si !== "0.00", ausente si "0.00").
 * - NO imbalance banner.
 * - NO watermark PRELIMINAR.
 * - Decimal serialización es-BO (paréntesis para negativos).
 * - MissingOrgNameError si !orgName.
 *
 * Mirror de `trial-balance-pdf.exporter.test.ts` (paired sister precedent).
 */

import { describe, it, expect } from "vitest";
import {
  exportLedgerPdf,
  MissingOrgNameError,
  type LedgerPdfOptions,
} from "../infrastructure/exporters/ledger/ledger-pdf.exporter";
import type { LedgerEntry } from "../presentation/dto/ledger.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides?: Partial<LedgerEntry>): LedgerEntry {
  return {
    entryId: "je-1",
    date: new Date("2025-06-15"),
    entryNumber: 1,
    voucherCode: "CI",
    displayNumber: "D2506-000001",
    description: "Ingreso por venta",
    debit: "1234567.89",
    credit: "0.00",
    balance: "1234567.89",
    ...overrides,
  };
}

function makeOpts(overrides?: Partial<LedgerPdfOptions>): LedgerPdfOptions {
  return {
    accountCode: "1.1.1",
    accountName: "Caja",
    dateFrom: "2025-01-01",
    dateTo: "2025-12-31",
    openingBalance: "0.00",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("exportLedgerPdf — page layout", () => {
  it("docDef pageOrientation es 'portrait' y pageSize es 'A4'", async () => {
    const { docDef } = await exportLedgerPdf([makeEntry()], makeOpts(), "Avicont SA");
    expect(docDef.pageOrientation).toBe("portrait");
    expect(docDef.pageSize).toBe("A4");
  });
});

describe("exportLedgerPdf — column count", () => {
  it("data row tiene exactamente 7 cells (Fecha|Tipo|Nº|Desc|Debe|Haber|Saldo)", async () => {
    const { docDef } = await exportLedgerPdf([makeEntry()], makeOpts(), "Avicont SA");
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table);
    expect(tableBlock).toBeDefined();
    const body = tableBlock!.table!.body;
    // body[0] = header, body[1] = first data row
    const dataRow = body[1] as unknown[];
    expect(dataRow).toHaveLength(7);
  });
});

describe("exportLedgerPdf — header metadata", () => {
  it("renderiza Empresa, Cuenta y período en el header", async () => {
    const { docDef } = await exportLedgerPdf(
      [makeEntry()],
      makeOpts({ accountCode: "1.1.1", accountName: "Caja", dateFrom: "2025-01-01", dateTo: "2025-12-31" }),
      "Avicont SA",
      "1001",
      "Av. Principal 123",
    );
    const content = docDef.content as Array<{ text?: string | string[] }>;

    const empresaLine = content.find((c) => typeof c.text === "string" && c.text.includes("Avicont SA"));
    expect(empresaLine).toBeDefined();

    const nitLine = content.find((c) => typeof c.text === "string" && c.text.includes("NIT: 1001"));
    expect(nitLine).toBeDefined();

    // Subtítulo: "Cuenta: 1.1.1 — Caja\nDel 01/01/2025 al 31/12/2025"
    const subtitleLine = content.find(
      (c) => typeof c.text === "string" && c.text.includes("Cuenta: 1.1.1") && c.text.includes("Caja"),
    );
    expect(subtitleLine).toBeDefined();
    expect((subtitleLine!.text as string)).toContain("Del 01/01/2025");
    expect((subtitleLine!.text as string)).toContain("al 31/12/2025");
  });

  it("título es 'LIBRO MAYOR' (uppercase)", async () => {
    const { docDef } = await exportLedgerPdf([makeEntry()], makeOpts(), "Avicont SA");
    const content = docDef.content as Array<{ text?: string }>;
    const titleLine = content.find((c) => typeof c.text === "string" && c.text === "LIBRO MAYOR");
    expect(titleLine).toBeDefined();
  });
});

describe("exportLedgerPdf — opening balance row", () => {
  it("openingBalance !== '0.00' → primera fila bold 'Saldo inicial acumulado'", async () => {
    const { docDef } = await exportLedgerPdf(
      [makeEntry()],
      makeOpts({ openingBalance: "5000.00" }),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const body = tableBlock.table!.body;
    // body[0] = header, body[1] = opening row, body[2] = first data row
    const openingRow = body[1] as Array<{ text: string; bold: boolean }>;
    // Column 3 (index 3) is "Descripción"
    expect(openingRow[3].text).toBe("Saldo inicial acumulado");
    expect(openingRow[3].bold).toBe(true);
    // Saldo column (index 6) tiene el monto
    expect(openingRow[6].text).toBe("5.000,00");
  });

  it("openingBalance === '0.00' → NO hay fila 'Saldo inicial acumulado'", async () => {
    const { docDef } = await exportLedgerPdf(
      [makeEntry()],
      makeOpts({ openingBalance: "0.00" }),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const body = tableBlock.table!.body;
    // body[0] = header, body[1] = first data row (no opening)
    const firstRow = body[1] as Array<{ text: string }>;
    expect(firstRow[3].text).not.toBe("Saldo inicial acumulado");
  });
});

describe("exportLedgerPdf — es-BO formatting", () => {
  it("debit=1234567.89 → cell text '1.234.567,89'", async () => {
    const { docDef } = await exportLedgerPdf(
      [makeEntry({ debit: "1234567.89", credit: "0.00", balance: "1234567.89" })],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    // Column 4 (index 4) = Debe
    expect(dataRow[4].text).toBe("1.234.567,89");
  });

  it("balance negativo → '(1.234,56)'", async () => {
    const { docDef } = await exportLedgerPdf(
      [makeEntry({ debit: "0.00", credit: "1234.56", balance: "-1234.56" })],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    // Column 6 (index 6) = Saldo
    expect(dataRow[6].text).toBe("(1.234,56)");
  });

  it("debit=0.00 → cell text vacía (zero convention para detail)", async () => {
    const { docDef } = await exportLedgerPdf(
      [makeEntry({ debit: "0.00", credit: "100.00", balance: "-100.00" })],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    // Column 4 (index 4) = Debe (cero → "")
    expect(dataRow[4].text).toBe("");
  });
});

describe("exportLedgerPdf — sin imbalance banner / sin watermark", () => {
  it("NO hay imbalance banner (color rojo) en el content", async () => {
    const { docDef } = await exportLedgerPdf([makeEntry()], makeOpts(), "Avicont SA");
    const content = docDef.content as Array<{ color?: string }>;
    const banner = content.find((c) => c.color === "#b91c1c");
    expect(banner).toBeUndefined();
  });

  it("NO hay watermark 'PRELIMINAR' en docDef", async () => {
    const { docDef } = await exportLedgerPdf([makeEntry()], makeOpts(), "Avicont SA");
    // docDef.watermark sería un campo top-level si estuviera; verificamos null/undefined
    const dd = docDef as { watermark?: unknown };
    expect(dd.watermark).toBeUndefined();
  });
});

describe("exportLedgerPdf — edge cases", () => {
  it("entries=[] + opening=0 → buffer producido (no crash), tabla con solo header", async () => {
    const { buffer, docDef } = await exportLedgerPdf([], makeOpts({ openingBalance: "0.00" }), "Avicont SA");
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    // Sólo header (no opening, no data rows)
    expect(tableBlock.table!.body).toHaveLength(1);
  });

  it("entries=[] + opening !== 0 → opening row visible aunque no haya movimientos", async () => {
    const { docDef } = await exportLedgerPdf([], makeOpts({ openingBalance: "100.00" }), "Avicont SA");
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    // body[0]=header, body[1]=opening row → length 2
    expect(tableBlock.table!.body).toHaveLength(2);
  });
});

describe("exportLedgerPdf — buffer signature", () => {
  it("buffer comienza con '%PDF'", async () => {
    const { buffer } = await exportLedgerPdf([makeEntry()], makeOpts(), "Avicont SA");
    const magic = buffer.subarray(0, 4).toString("ascii");
    expect(magic).toBe("%PDF");
  });
});

describe("exportLedgerPdf — MissingOrgNameError", () => {
  it("orgName vacío → throws MissingOrgNameError", async () => {
    await expect(exportLedgerPdf([makeEntry()], makeOpts(), "")).rejects.toThrow(
      MissingOrgNameError,
    );
  });
});

describe("exportLedgerPdf — paginación multi-página", () => {
  it("footer renderiza 'Página X de Y'", async () => {
    const { docDef } = await exportLedgerPdf([makeEntry()], makeOpts(), "Avicont SA");
    const dd = docDef as { footer?: (cur: number, total: number) => { text: string } };
    expect(typeof dd.footer).toBe("function");
    const footer1 = dd.footer!(1, 5);
    expect(footer1.text).toBe("Página 1 de 5");
    const footer3 = dd.footer!(3, 5);
    expect(footer3.text).toBe("Página 3 de 5");
  });

  it("header page 1 → null (cabecera completa va en content)", async () => {
    const { docDef } = await exportLedgerPdf([makeEntry()], makeOpts(), "Avicont SA");
    const dd = docDef as { header?: (cur: number) => unknown };
    expect(typeof dd.header).toBe("function");
    expect(dd.header!(1)).toBeNull();
  });

  it("header page 2+ → resumen compacto con cuenta + período + empresa", async () => {
    const { docDef } = await exportLedgerPdf(
      [makeEntry()],
      makeOpts({ accountCode: "1.1.4.1", accountName: "CxC Comerciales", dateFrom: "2025-01-01", dateTo: "2025-12-31" }),
      "Avicont SA",
    );
    const dd = docDef as { header?: (cur: number) => { text: string } };
    const header2 = dd.header!(2);
    expect(header2.text).toContain("Libro Mayor");
    expect(header2.text).toContain("1.1.4.1");
    expect(header2.text).toContain("CxC Comerciales");
    expect(header2.text).toContain("Avicont SA");
    expect(header2.text).toContain("Del 01/01/2025 al 31/12/2025");
  });

  it("tabla usa dontBreakRows=true para no cortar filas entre páginas", async () => {
    const { docDef } = await exportLedgerPdf([makeEntry()], makeOpts(), "Avicont SA");
    const content = docDef.content as Array<{ table?: { dontBreakRows?: boolean; headerRows?: number } }>;
    const tableBlock = content.find((c) => c.table)!;
    expect(tableBlock.table!.dontBreakRows).toBe(true);
    expect(tableBlock.table!.headerRows).toBe(1);
  });
});
