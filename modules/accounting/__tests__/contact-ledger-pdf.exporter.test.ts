/**
 * Tests para `exportContactLedgerPdf`.
 *
 * Cobertura (mirror del sister `ledger-pdf.exporter.test.ts` adaptado a
 * contact-ledger — 8 columnas + subtítulo nombre contacto + Estado):
 * - Shape del docDef (A4 portrait, 8 cols).
 * - Header con `Cuenta: {contactName}` en lugar de cuenta contable.
 * - Logo image presente / ausente.
 * - Opening balance row decorativa (presente si !== "0.00").
 * - Footer dual columns ("Generado: ..." izq + "Página X de Y" der).
 * - Header continuation pg2+ (null para page 1).
 * - dontBreakRows=true + anchos fijos (no `*`).
 * - es-BO negativos con paréntesis.
 * - Estado cell: status human + ATRASADO derivado + "Sin auxiliar".
 * - Tipo cell: voucherTypeHuman + payment method append.
 * - MissingOrgNameError cuando orgName empty.
 * - Buffer signature `%PDF`.
 *
 * Sister precedent paired (apply directly per [[paired_sister_default_no_surface]]):
 *   modules/accounting/__tests__/ledger-pdf.exporter.test.ts
 *
 * Expected RED failure mode per [[red_acceptance_failure_mode]]:
 *   El módulo `infrastructure/exporters/contact-ledger/contact-ledger-pdf.exporter`
 *   no existe → import resolution fails (ERR_MODULE_NOT_FOUND / vitest path-resolve).
 *   El error cae al collect phase, no a test runtime.
 */

import { describe, it, expect } from "vitest";
import {
  exportContactLedgerPdf,
  MissingOrgNameError,
  type ContactLedgerPdfOptions,
} from "../infrastructure/exporters/contact-ledger/contact-ledger-pdf.exporter";
import type { ContactLedgerEntry } from "../presentation/dto/ledger.types";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEntry(overrides?: Partial<ContactLedgerEntry>): ContactLedgerEntry {
  return {
    entryId: "je-1",
    date: new Date("2025-06-15"),
    entryNumber: 1,
    voucherCode: "CD",
    displayNumber: "D2506-000001",
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
    ...overrides,
  };
}

function makeOpts(
  overrides?: Partial<ContactLedgerPdfOptions>,
): ContactLedgerPdfOptions {
  return {
    contactName: "Distribuidora ACME SRL",
    dateFrom: "2025-01-01",
    dateTo: "2025-12-31",
    openingBalance: "0.00",
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("exportContactLedgerPdf — page layout", () => {
  it("docDef pageOrientation es 'portrait' y pageSize es 'A4'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    expect(docDef.pageOrientation).toBe("portrait");
    expect(docDef.pageSize).toBe("A4");
  });
});

describe("exportContactLedgerPdf — column count (8 cols vs sister 7)", () => {
  it("data row tiene exactamente 8 cells (Fecha|Tipo|Nº|Estado|Desc|Debe|Haber|Saldo)", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table);
    expect(tableBlock).toBeDefined();
    const body = tableBlock!.table!.body;
    const dataRow = body[1] as unknown[];
    expect(dataRow).toHaveLength(8);
  });

  it("header row tiene los 8 column headers en orden", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const headerRow = tableBlock.table!.body[0] as Array<{ text: string }>;
    expect(headerRow[0].text).toBe("Fecha");
    expect(headerRow[1].text).toBe("Tipo");
    expect(headerRow[2].text).toBe("Nº");
    expect(headerRow[3].text).toBe("Estado");
    expect(headerRow[4].text).toBe("Descripción");
    expect(headerRow[5].text).toBe("Debe");
    expect(headerRow[6].text).toBe("Haber");
    expect(headerRow[7].text).toBe("Saldo");
  });
});

describe("exportContactLedgerPdf — header metadata", () => {
  it("renderiza Empresa, NIT, contacto en el header", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts({
        contactName: "Distribuidora ACME SRL",
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      }),
      "Avicont SA",
      "1001",
      "Av. Principal 123",
    );
    const content = docDef.content as Array<{
      text?: string;
      columns?: Array<{ stack?: Array<{ text?: string }> }>;
    }>;

    const headerBlock = content.find((c) => Array.isArray(c.columns));
    expect(headerBlock).toBeDefined();
    const orgStack = headerBlock!.columns![0].stack!;
    const orgTexts = orgStack.map((s) => s.text ?? "");

    expect(orgTexts.some((t) => t.includes("Empresa: Avicont SA"))).toBe(true);
    expect(orgTexts.some((t) => t.includes("NIT: 1001"))).toBe(true);
    expect(orgTexts.some((t) => t.includes("Dirección: Av. Principal 123"))).toBe(true);

    // Subtítulo "Contacto: ..." es item text directo en content (NO cuenta contable).
    const contactoLine = content.find(
      (c) =>
        typeof c.text === "string" &&
        c.text.includes("Contacto:") &&
        c.text.includes("Distribuidora ACME SRL"),
    );
    expect(contactoLine).toBeDefined();

    const periodoLine = content.find(
      (c) =>
        typeof c.text === "string" &&
        c.text.includes("Del 01/01/2025") &&
        c.text.includes("al 31/12/2025"),
    );
    expect(periodoLine).toBeDefined();
  });

  it("título es 'LIBRO MAYOR POR CONTACTO' (uppercase)", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ text?: string }>;
    const titleLine = content.find(
      (c) => typeof c.text === "string" && c.text === "LIBRO MAYOR POR CONTACTO",
    );
    expect(titleLine).toBeDefined();
  });

  it("logoDataUrl presente → image renderizada en col der del header", async () => {
    const fakeLogo =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGBgAAAABQABh6FO1AAAAABJRU5ErkJggg==";
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts({ logoDataUrl: fakeLogo }),
      "Avicont SA",
    );
    const content = docDef.content as Array<{
      columns?: Array<{ stack?: Array<{ image?: string; width?: number; alignment?: string }> }>;
    }>;
    const headerBlock = content.find((c) => Array.isArray(c.columns));
    const logoStack = headerBlock!.columns![1].stack!;
    const imageItem = logoStack.find((s) => typeof s.image === "string");
    expect(imageItem).toBeDefined();
    expect(imageItem!.width).toBe(55);
    expect(imageItem!.alignment).toBe("right");
  });

  it("logoDataUrl undefined → header SIN image (placeholder vacío)", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{
      columns?: Array<{ stack?: Array<{ image?: string }> }>;
    }>;
    const headerBlock = content.find((c) => Array.isArray(c.columns));
    const logoStack = headerBlock!.columns![1].stack!;
    const hasImage = logoStack.some((s) => typeof s.image === "string");
    expect(hasImage).toBe(false);
  });
});

describe("exportContactLedgerPdf — opening balance row", () => {
  it("openingBalance !== '0.00' → primera fila bold 'Saldo inicial acumulado'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts({ openingBalance: "5000.00" }),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const body = tableBlock.table!.body;
    const openingRow = body[1] as Array<{ text: string; bold: boolean }>;
    // Column 4 (index 4) en 8-col layout es "Descripción"
    expect(openingRow[4].text).toBe("Saldo inicial acumulado");
    expect(openingRow[4].bold).toBe(true);
    // Saldo column (index 7)
    expect(openingRow[7].text).toBe("5.000,00");
  });

  it("openingBalance === '0.00' → NO hay fila 'Saldo inicial acumulado'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts({ openingBalance: "0.00" }),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const body = tableBlock.table!.body;
    const firstRow = body[1] as Array<{ text: string }>;
    expect(firstRow[4].text).not.toBe("Saldo inicial acumulado");
  });
});

describe("exportContactLedgerPdf — Estado column", () => {
  it("withoutAuxiliary=true → Estado cell 'Sin auxiliar'", async () => {
    const { docDef } = await exportContactLedgerPdf(
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
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    // Column 3 (index 3) = Estado en 8-col layout
    expect(dataRow[3].text).toBe("Sin auxiliar");
  });

  it("status=PENDING y dueDate < hoy → Estado 'ATRASADO'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [
        makeEntry({
          status: "PENDING",
          dueDate: "2020-01-01T00:00:00.000Z",
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    expect(dataRow[3].text).toBe("ATRASADO");
  });

  it("status=PAID → Estado 'Pagado'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry({ status: "PAID" })],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    expect(dataRow[3].text).toBe("Pagado");
  });

  it("sourceType=receipt + status=null → Estado '—'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry({ sourceType: "receipt", status: null })],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    expect(dataRow[3].text).toBe("—");
  });
});

describe("exportContactLedgerPdf — Tipo column", () => {
  it("sourceType=receipt + paymentMethod=EFECTIVO → 'Cobranza (efectivo)'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [
        makeEntry({
          sourceType: "receipt",
          paymentMethod: "EFECTIVO",
          bankAccountName: null,
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    // Column 1 (index 1) = Tipo
    expect(dataRow[1].text).toBe("Cobranza (efectivo)");
  });

  it("sourceType=payment + TRANSFERENCIA + bankAccountName → 'Pago (transferencia BNB)'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [
        makeEntry({
          sourceType: "payment",
          paymentMethod: "TRANSFERENCIA",
          bankAccountName: "BNB Cta Cte",
        }),
      ],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    expect(dataRow[1].text).toBe("Pago (transferencia BNB Cta Cte)");
  });

  it("sourceType=sale → voucherTypeHuman ('Nota de despacho')", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry({ sourceType: "sale", voucherTypeHuman: "Nota de despacho" })],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    expect(dataRow[1].text).toBe("Nota de despacho");
  });

  it("sourceType=null (manual) → Tipo 'Ajuste'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry({ sourceType: null, status: null, withoutAuxiliary: true })],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    expect(dataRow[1].text).toBe("Ajuste");
  });
});

describe("exportContactLedgerPdf — es-BO formatting", () => {
  it("debit=1234567.89 → cell text '1.234.567,89'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry({ debit: "1234567.89", credit: "0.00", balance: "1234567.89" })],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    // Column 5 (index 5) = Debe en 8-col layout
    expect(dataRow[5].text).toBe("1.234.567,89");
  });

  it("balance negativo → '(1.234,56)'", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry({ debit: "0.00", credit: "1234.56", balance: "-1234.56" })],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    const dataRow = tableBlock.table!.body[1] as Array<{ text: string }>;
    // Column 7 (index 7) = Saldo
    expect(dataRow[7].text).toBe("(1.234,56)");
  });
});

describe("exportContactLedgerPdf — edge cases", () => {
  it("entries=[] + opening=0 → buffer producido (no crash), tabla con solo header", async () => {
    const { buffer, docDef } = await exportContactLedgerPdf(
      [],
      makeOpts({ openingBalance: "0.00" }),
      "Avicont SA",
    );
    expect(buffer).toBeDefined();
    expect(buffer.length).toBeGreaterThan(0);
    const content = docDef.content as Array<{ table?: { body: unknown[][] } }>;
    const tableBlock = content.find((c) => c.table)!;
    expect(tableBlock.table!.body).toHaveLength(1);
  });
});

describe("exportContactLedgerPdf — buffer signature", () => {
  it("buffer comienza con '%PDF'", async () => {
    const { buffer } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const magic = buffer.subarray(0, 4).toString("ascii");
    expect(magic).toBe("%PDF");
  });
});

describe("exportContactLedgerPdf — MissingOrgNameError", () => {
  it("orgName vacío → throws MissingOrgNameError", async () => {
    await expect(
      exportContactLedgerPdf([makeEntry()], makeOpts(), ""),
    ).rejects.toThrow(MissingOrgNameError);
  });
});

describe("exportContactLedgerPdf — paginación multi-página", () => {
  it("footer renderiza 'Generado: ...' izq + 'Página X de Y' der", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const dd = docDef as {
      footer?: (cur: number, total: number) => {
        columns: Array<{ text: string; alignment?: string }>;
      };
    };
    expect(typeof dd.footer).toBe("function");
    const footer1 = dd.footer!(1, 5);
    expect(Array.isArray(footer1.columns)).toBe(true);
    expect(footer1.columns[0].text).toMatch(/^Generado: /);
    expect(footer1.columns[1].text).toBe("Página 1 de 5");
    expect(footer1.columns[1].alignment).toBe("right");
  });

  it("header page 1 → null (cabecera completa va en content)", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const dd = docDef as { header?: (cur: number) => unknown };
    expect(typeof dd.header).toBe("function");
    expect(dd.header!(1)).toBeNull();
  });

  it("header page 2+ → resumen compacto con contacto + período + empresa", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts({
        contactName: "Distribuidora ACME SRL",
        dateFrom: "2025-01-01",
        dateTo: "2025-12-31",
      }),
      "Avicont SA",
    );
    const dd = docDef as { header?: (cur: number) => { text: string } };
    const header2 = dd.header!(2);
    expect(header2.text).toContain("Libro Mayor");
    expect(header2.text).toContain("Distribuidora ACME SRL");
    expect(header2.text).toContain("Avicont SA");
    expect(header2.text).toContain("Del 01/01/2025 al 31/12/2025");
  });

  it("tabla usa dontBreakRows=true para no cortar filas entre páginas", async () => {
    const { docDef } = await exportContactLedgerPdf(
      [makeEntry()],
      makeOpts(),
      "Avicont SA",
    );
    const content = docDef.content as Array<{
      table?: { dontBreakRows?: boolean; headerRows?: number; widths?: unknown[] };
    }>;
    const tableBlock = content.find((c) => c.table)!;
    expect(tableBlock.table!.dontBreakRows).toBe(true);
    expect(tableBlock.table!.headerRows).toBe(1);
    // 8 columnas — anchos fijos (NO `*`). pdfmake normaliza number→{type,value}
    // durante measure, así que el assertion sobre tipo numérico es post-build
    // inválido; basta verificar que ningún slot literal sea `"*"`.
    const widths = tableBlock.table!.widths!;
    expect(widths).toHaveLength(8);
    widths.forEach((w) => expect(w).not.toBe("*"));
  });
});
