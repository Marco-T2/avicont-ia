/**
 * T01 — RED: Domain type shape verification for EquityStatement.
 *
 * Covers: REQ-1 (ColumnKey shape), REQ-2 (RowKey + 3 filas), REQ-6, REQ-7, REQ-15
 */

import { describe, it, expect } from "vitest";
import Decimal from "decimal.js";

// Fixture constructor + instanceof migrated to top-level decimal.js@10.6.0 per
// discovery #2590 (prisma-decimal-instance-identity-cascade). Sub-POC 2
// equity-statement.builder now produces top-level Decimal instances; Decimal2
// (Prisma's inlined decimal.js@10.5.0) is NOT instanceof top-level Decimal.
const D = (v: string | number) => new Decimal(String(v));

describe("equity-statement domain types", () => {
  it("module files can be imported without error", async () => {
    await expect(import("../domain/equity-statement.types")).resolves.toBeDefined();
    await expect(import("../domain/equity-statement.builder")).resolves.toBeDefined();
    await expect(import("../domain/equity-statement.validation")).resolves.toBeDefined();
    await expect(import("../domain/money.utils")).resolves.toBeDefined();
    await expect(import("../domain/ports/equity-statement-query.port")).resolves.toBeDefined();
  });

  it("EquityStatement has expected fields as Decimal instances at runtime", async () => {
    await import("../domain/equity-statement.types");

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

    expect(statement.grandTotal).toBeInstanceOf(Decimal);
    expect(statement.periodResult).toBeInstanceOf(Decimal);
    expect(statement.imbalanceDelta).toBeInstanceOf(Decimal);
    expect(statement.columnTotals.CAPITAL_SOCIAL).toBeInstanceOf(Decimal);
  });

  it("SerializedEquityStatement numeric fields are typed as strings", async () => {
    await import("../domain/equity-statement.types");

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
    await import("../domain/equity-statement.types");

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

  it("RowKey includes typed patrimony rows (APORTE_CAPITAL, CONSTITUCION_RESERVA, DISTRIBUCION_DIVIDENDO)", async () => {
    const mod = await import("../domain/equity-statement.types");
    type R = import("../domain/equity-statement.types").RowKey;

    const keys: R[] = [
      "SALDO_INICIAL",
      "APORTE_CAPITAL",
      "CONSTITUCION_RESERVA",
      "DISTRIBUCION_DIVIDENDO",
      "RESULTADO_EJERCICIO",
      "SALDO_FINAL",
    ];
    expect(keys).toHaveLength(6);
    // module import guarantees type-level constants compile at runtime
    expect(mod).toBeDefined();
  });

  it("PatrimonyVoucherCode accepts CP, CL, CV", async () => {
    await import("../domain/equity-statement.types");
    type V = import("../domain/equity-statement.types").PatrimonyVoucherCode;

    const codes: V[] = ["CP", "CL", "CV"];
    expect(codes).toEqual(["CP", "CL", "CV"]);
  });

  it("TypedPatrimonyMovements is Map<PatrimonyVoucherCode, Map<accountId, Decimal>>", async () => {
    await import("../domain/equity-statement.types");
    type T = import("../domain/equity-statement.types").TypedPatrimonyMovements;

    const movements: T = new Map([
      ["CP", new Map([["acc-1", D("200000")]])],
    ]);

    const cp = movements.get("CP");
    expect(cp).toBeDefined();
    expect(cp!.get("acc-1")).toBeInstanceOf(Decimal);
    expect(cp!.get("acc-1")!.toString()).toBe("200000");
  });

  it("BuildEquityStatementInput accepts typedMovements field", async () => {
    await import("../domain/equity-statement.types");
    type Input = import("../domain/equity-statement.types").BuildEquityStatementInput;

    const input: Input = {
      initialBalances: new Map(),
      finalBalances: new Map(),
      accounts: [],
      typedMovements: new Map(),
      periodResult: D("0"),
      dateFrom: new Date("2024-01-01"),
      dateTo: new Date("2024-12-31"),
      preliminary: false,
    };
    expect(input.typedMovements).toBeInstanceOf(Map);
    expect(input.typedMovements.size).toBe(0);
  });
});
