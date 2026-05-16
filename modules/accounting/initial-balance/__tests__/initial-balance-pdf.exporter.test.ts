/**
 * T13 — PDF exporter smoke tests.
 *
 * Covers:
 * - A4 portrait page setup
 * - Org header with left-aligned Bolivian legal format:
 *   "De: {representanteLegal}" line, separate dirección + ciudad lines
 * - Section labels ACTIVO / PASIVO Y PATRIMONIO (centered)
 * - Detail rows show "{code} — {name}" format (em dash, Bolivian legal format)
 * - Footer mentions ciudad + fecha, single representante legal signature
 * - Zero-amount detail rows are skipped
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { exportInitialBalancePdf } from "../infrastructure/exporters/initial-balance-pdf.exporter";
import { buildInitialBalance } from "../domain/initial-balance.builder";
import type { InitialBalanceRow } from "../domain/initial-balance.types";

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
    // zero-amount row — must be excluded from PDF detail rows
    {
      accountId: "acc-6",
      code: "1300",
      name: "Cuenta Sin Saldo",
      subtype: "ACTIVO_CORRIENTE",
      amount: D("0"),
    },
  ];

  return buildInitialBalance({
    orgId: "org-test",
    org: {
      razonSocial: "Cooperativa Avicont S.A.",
      nit: "123456789",
      representanteLegal: "Juan Pérez García",
      direccion: "Av. Arce 123",
      ciudad: "Vinto-Cochabamba",
    },
    dateAt: new Date("2018-01-02"),
    rows,
    caCount: 1,
  });
}

describe("exportInitialBalancePdf — smoke tests", () => {
  it("buffer starts with %PDF", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    expect(result.buffer.slice(0, 4).toString()).toBe("%PDF");
  });

  it("page size is A4 portrait", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    expect(result.docDef.pageSize).toBe("A4");
    expect(result.docDef.pageOrientation).toBe("portrait");
    expect(json).toMatch(/A4/);
  });

  it("docDef contains org header strings (razonSocial, nit, representanteLegal)", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    expect(json).toContain("Cooperativa Avicont S.A.");
    expect(json).toContain("123456789");
    expect(json).toContain("Juan Pérez García");
  });

  it("docDef contains 'De: ' prefix for representante legal line", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    expect(json).toContain("De: ");
  });

  it("docDef contains dirección and ciudad as separate fields", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    expect(json).toContain("Av. Arce 123");
    expect(json).toContain("Vinto-Cochabamba");
  });

  it("docDef contains section labels ACTIVO and PASIVO Y PATRIMONIO", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    expect(json).toContain("ACTIVO");
    expect(json).toContain("PASIVO Y PATRIMONIO");
  });

  it("detail rows contain '{code}  {NAME}' format (code first, name uppercased)", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    // Staircase BCB layout: code prefix + double space + name in MAYÚS.
    // Previo: "1100 — Caja" (em dash, legal format) — refactor a estilo BCB.
    expect(json).toContain("1100  CAJA");
    expect(json).toContain("1200  BANCO NACIONAL");
  });

  it("footer contains ciudad in the closing line", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    // Footer: "{ciudad}, {fechaLarga}"
    expect(json).toContain("Vinto-Cochabamba");
  });

  it("zero-amount detail row (Cuenta Sin Saldo) is not rendered", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    expect(json).not.toContain("Cuenta Sin Saldo");
  });
});
