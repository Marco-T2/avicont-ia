import { describe, it, expect } from "vitest";
import { exportVoucherPdf } from "@/features/accounting/exporters/voucher-pdf.exporter";
import type { VoucherPdfInput } from "@/features/accounting/exporters/voucher-pdf.types";

// Fixture base: input realista (derivado del sample del usuario).
// Los edge cases clonan y mutan sólo el campo relevante.
function baseInput(): VoucherPdfInput {
  return {
    organization: {
      name: "DEKMA",
      branchName: "DEKMA LA PAZ",
      address: "Avenida Arica Nro. 100, Zona/Barrio Senkata",
      email: "infodekma@dekmabolivia.com",
      logoDataUrl: undefined,
    },
    voucher: {
      date: "19/08/25",
      type: "EGRESO",
      reference: "9951",
      exchangeRate: "6.96",
      ufvRate: "2.82242",
      payTo: "Jhody Michael Gutierrez Aleman",
      bank: "BCO MERCANTIL M/NAL CTA CTE",
      amountLiteral: "TRES MIL SETECIENTOS SESENTA 00/100 BS",
      number: "E2508-0145",
      gestion: "2025-26",
      locality: "LLA",
      internalId: "58294",
      currency: "BS",
      glosa: "A rendir ECR Jhody Gutierrez, compra de toner y cartuchos.",
    },
    entries: [
      {
        accountCode: "1010.011.031",
        accountName: "ECR-JHODY GUTIERREZ ALEMAN",
        description: "A rendir ECR Jhody",
        debitBs: "3760.00",
        creditBs: "0.00",
        debitUsd: "540.23",
        creditUsd: "0.00",
      },
      {
        accountCode: "1000.003.003",
        accountName: "BANCO MERCANTIL SANTA CRUZ S.A.",
        description: "A rendir ECR Jhody",
        debitBs: "0.00",
        creditBs: "3760.00",
        debitUsd: "0.00",
        creditUsd: "540.23",
      },
    ],
    totals: {
      debitBs: "3760.00",
      creditBs: "3760.00",
      debitUsd: "540.23",
      creditUsd: "540.23",
    },
    signatures: {
      elaborado: { label: "ELABORADO", name: "Veronica Limachi" },
      aprobado: { label: "APROBADO" },
      vistoBueno: { label: "V°B°" },
    },
    footer: {
      nombreApellido: { label: "Nombre y Apellido", value: "Jhody Gutierrez" },
      ci: { label: "C.I.", value: "8349809 LP" },
      firma: { label: "Firma" },
    },
  };
}

describe("exportVoucherPdf — happy path", () => {
  it("retorna un Buffer no vacío que empieza con %PDF-", async () => {
    const buffer = await exportVoucherPdf(baseInput());

    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(5 * 1024); // > 5 KB
    expect(buffer.length).toBeLessThan(500 * 1024); // < 500 KB
    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("genera PDFs repetidos para el mismo input con header consistente", async () => {
    const a = await exportVoucherPdf(baseInput());
    const b = await exportVoucherPdf(baseInput());

    expect(a.subarray(0, 8).toString("ascii")).toBe(b.subarray(0, 8).toString("ascii"));
    expect(a.length).toBeGreaterThan(0);
    expect(b.length).toBeGreaterThan(0);
  });
});

describe("exportVoucherPdf — edge cases", () => {
  it("omite columnas USD cuando los USD de totales son cadena vacía", async () => {
    const input = baseInput();
    input.totals.debitUsd = "";
    input.totals.creditUsd = "";
    input.entries = input.entries.map((e) => ({ ...e, debitUsd: "", creditUsd: "" }));

    const buffer = await exportVoucherPdf(input);

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1024);
  });

  it("se renderiza sin firmas cuando signatures es {}", async () => {
    const input = baseInput();
    input.signatures = {};

    const buffer = await exportVoucherPdf(input);

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1024);
  });

  it("se renderiza sin fila de receptor cuando footer es undefined", async () => {
    const input = baseInput();
    input.footer = undefined;

    const buffer = await exportVoucherPdf(input);

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1024);
  });

  it("se renderiza sin logo cuando logoDataUrl es undefined", async () => {
    const input = baseInput();
    input.organization.logoDataUrl = undefined;

    const buffer = await exportVoucherPdf(input);

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1024);
  });

  it("acepta logoDataUrl y produce PDF más grande que sin logo", async () => {
    const tinyPng =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

    const withoutLogo = await exportVoucherPdf(baseInput());
    const inputWithLogo = baseInput();
    inputWithLogo.organization.logoDataUrl = tinyPng;
    const withLogo = await exportVoucherPdf(inputWithLogo);

    expect(withLogo.length).toBeGreaterThan(withoutLogo.length);
  });

  it("acepta glosa muy larga sin romper el exporter", async () => {
    const input = baseInput();
    input.voucher.glosa = "A rendir ECR ".repeat(50); // 650+ chars

    const buffer = await exportVoucherPdf(input);

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  });

  it("se renderiza con una sola entry", async () => {
    const input = baseInput();
    input.entries = [input.entries[0]];

    const buffer = await exportVoucherPdf(input);

    expect(buffer.subarray(0, 5).toString("ascii")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1024);
  });
});
