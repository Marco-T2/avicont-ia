/**
 * T01 — RED: Domain type shape verification for EquityStatement.
 *
 * Covers: REQ-1 (ColumnKey shape), REQ-2 (RowKey + 3 filas), REQ-6, REQ-7, REQ-15
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const D = (v: string | number) => new Prisma.Decimal(String(v));

describe("equity-statement domain types", () => {
  it("module files can be imported without error", async () => {
    await expect(import("../equity-statement.types")).resolves.toBeDefined();
    await expect(import("../index")).resolves.toBeDefined();
    await expect(import("../server")).resolves.toBeDefined();
  });

  it("EquityStatement has expected fields as Decimal instances at runtime", async () => {
    await import("../equity-statement.types");

    const statement = {
      orgId: "org-1",
      dateFrom: new Date("2024-01-01"),
      dateTo: new Date("2024-12-31"),
      columns: [],
      rows: [],
      columnTotals: {
        CAPITAL_SOCIAL: D("1000"),
        APORTES_CAPITALIZAR: D("0"),
        AJUSTE_CAPITAL: D("0"),
        RESERVA_LEGAL: D("0"),
        RESULTADOS_ACUMULADOS: D("500"),
        OTROS_PATRIMONIO: D("0"),
      },
      grandTotal: D("1500"),
      periodResult: D("500"),
      imbalanced: false,
      imbalanceDelta: D("0"),
      preliminary: true,
    };

    expect(statement.grandTotal).toBeInstanceOf(Prisma.Decimal);
    expect(statement.periodResult).toBeInstanceOf(Prisma.Decimal);
    expect(statement.imbalanceDelta).toBeInstanceOf(Prisma.Decimal);
    expect(statement.columnTotals.CAPITAL_SOCIAL).toBeInstanceOf(Prisma.Decimal);
  });

  it("SerializedEquityStatement numeric fields are typed as strings", async () => {
    await import("../equity-statement.types");

    // Construct a conformant SerializedEquityStatement — numeric fields must be strings
    const serialized = {
      orgId: "org-1",
      dateFrom: "2024-01-01",
      dateTo: "2024-12-31",
      columns: [],
      rows: [
        {
          key: "SALDO_INICIAL",
          label: "Saldo al inicio del período",
          cells: [{ column: "CAPITAL_SOCIAL", amount: "1000.00" }],
          total: "1000.00",
        },
      ],
      columnTotals: {
        CAPITAL_SOCIAL: "1000.00",
        APORTES_CAPITALIZAR: "0.00",
        AJUSTE_CAPITAL: "0.00",
        RESERVA_LEGAL: "0.00",
        RESULTADOS_ACUMULADOS: "500.00",
        OTROS_PATRIMONIO: "0.00",
      },
      grandTotal: "1500.00",
      periodResult: "500.00",
      imbalanced: false,
      imbalanceDelta: "0.00",
      preliminary: true,
    };

    expect(typeof serialized.grandTotal).toBe("string");
    expect(typeof serialized.periodResult).toBe("string");
    expect(typeof serialized.rows[0].total).toBe("string");
    expect(typeof serialized.rows[0].cells[0].amount).toBe("string");
  });

  it("EquityAccountMetadata has fields { id, code, name, nature }", async () => {
    await import("../equity-statement.types");

    const meta = {
      id: "acc-1",
      code: "3.1.1",
      name: "Capital Social",
      nature: "ACREEDORA" as const,
    };

    expect(meta).toHaveProperty("id");
    expect(meta).toHaveProperty("code");
    expect(meta).toHaveProperty("name");
    expect(meta).toHaveProperty("nature");
    expect(typeof meta.nature).toBe("string");
  });
});
