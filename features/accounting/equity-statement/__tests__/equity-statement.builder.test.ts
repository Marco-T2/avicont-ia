/**
 * T02 — RED: Column mapping tests.
 * T03 will extend this file with builder fixture tests.
 *
 * Covers: REQ-1 (column mapping by account code prefix)
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const D = (v: string | number) => new Prisma.Decimal(String(v));

describe("mapAccountCodeToColumn — longest-prefix-wins", () => {
  it("'3.1.4' → CAPITAL_SOCIAL", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.1.4")).toBe("CAPITAL_SOCIAL");
  });

  it("'3.2.1' → APORTES_CAPITALIZAR (NOT AJUSTE_CAPITAL)", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.2.1")).toBe("APORTES_CAPITALIZAR");
    expect(mapAccountCodeToColumn("3.2.1")).not.toBe("AJUSTE_CAPITAL");
  });

  it("'3.2.5' → AJUSTE_CAPITAL", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.2.5")).toBe("AJUSTE_CAPITAL");
  });

  it("'3.3.2' → RESERVA_LEGAL", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.3.2")).toBe("RESERVA_LEGAL");
  });

  it("'3.4.1' → RESULTADOS_ACUMULADOS", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.4.1")).toBe("RESULTADOS_ACUMULADOS");
  });

  it("'3.5.1' → RESULTADOS_ACUMULADOS", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.5.1")).toBe("RESULTADOS_ACUMULADOS");
  });

  it("'3.9.1' (no match) → OTROS_PATRIMONIO", async () => {
    const { mapAccountCodeToColumn } = await import("../equity-statement.builder");
    expect(mapAccountCodeToColumn("3.9.1")).toBe("OTROS_PATRIMONIO");
  });

  it("COLUMNS_ORDER has exactly 6 elements in canonical order", async () => {
    const { COLUMNS_ORDER } = await import("../equity-statement.builder");
    expect(COLUMNS_ORDER).toHaveLength(6);
    expect(COLUMNS_ORDER[0]).toBe("CAPITAL_SOCIAL");
    expect(COLUMNS_ORDER[1]).toBe("APORTES_CAPITALIZAR");
    expect(COLUMNS_ORDER[2]).toBe("AJUSTE_CAPITAL");
    expect(COLUMNS_ORDER[3]).toBe("RESERVA_LEGAL");
    expect(COLUMNS_ORDER[4]).toBe("RESULTADOS_ACUMULADOS");
    expect(COLUMNS_ORDER[5]).toBe("OTROS_PATRIMONIO");
  });
});
