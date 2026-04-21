/**
 * T13 — PDF exporter smoke tests.
 *
 * Covers: A4 portrait, org header, section labels ACTIVO / PASIVO Y PATRIMONIO.
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { exportInitialBalancePdf } from "../initial-balance-pdf.exporter";
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

describe("exportInitialBalancePdf — smoke tests", () => {
  it("buffer starts with %PDF", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    expect(result.buffer.slice(0, 4).toString()).toBe("%PDF");
  });

  it("page size is A4 portrait (595pt wide)", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    // A4 portrait → pageSize A4, pageOrientation portrait
    expect(result.docDef.pageSize).toBe("A4");
    expect(result.docDef.pageOrientation).toBe("portrait");
    // 595 pt is A4 portrait width — verify via stringified definition
    expect(json).toMatch(/A4/);
  });

  it("docDef contains org header strings", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    expect(json).toContain("Cooperativa Avicont S.A.");
    expect(json).toContain("123456789");
    expect(json).toContain("Juan Pérez García");
    expect(json).toContain("Av. Arce 123, La Paz");
  });

  it("docDef contains section labels ACTIVO and PASIVO Y PATRIMONIO", async () => {
    const result = await exportInitialBalancePdf(makeStatement());
    const json = JSON.stringify(result.docDef);
    expect(json).toContain("ACTIVO");
    expect(json).toContain("PASIVO Y PATRIMONIO");
  });
});
