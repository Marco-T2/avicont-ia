import { describe, it, expect } from "vitest";
import {
  buildBalanceSheetTableRows,
  buildIncomeStatementTableRows,
  buildRowId,
} from "../statement-table-rows.utils";

// ── Fixtures mínimos para pruebas ──

const mockColumn = { id: "col-current", label: "Total", role: "current" as const };

const mockAsset = {
  accountId: "acc1",
  code: "1.1.01",
  name: "Caja",
  balance: "1000.00",
};

const mockSubtypeGroup = {
  subtype: "ACTIVO_CORRIENTE",
  label: "Activo Corriente",
  accounts: [mockAsset],
  total: "1000.00",
};

const mockBS = {
  orgId: "org-1",
  current: {
    asOfDate: "2026-01-31",
    assets: { groups: [mockSubtypeGroup], total: "1000.00" },
    liabilities: { groups: [], total: "0.00" },
    equity: {
      groups: [],
      total: "0.00",
      retainedEarningsOfPeriod: "0.00",
    },
    imbalanced: false,
    imbalanceDelta: "0.00",
    preliminary: false,
  },
  columns: [mockColumn],
};

const mockIncome = {
  orgId: "org-1",
  current: {
    dateFrom: "2026-01-01",
    dateTo: "2026-01-31",
    income: {
      groups: [
        {
          subtype: "INGRESO_OPERATIVO",
          label: "Ingreso Operativo",
          accounts: [{ accountId: "acc2", code: "4.1.01", name: "Ventas", balance: "5000.00" }],
          total: "5000.00",
        },
      ],
      total: "5000.00",
    },
    expenses: {
      groups: [
        {
          subtype: "GASTO_OPERATIVO",
          label: "Gasto Operativo",
          accounts: [{ accountId: "acc3", code: "5.1.01", name: "Sueldos", balance: "2000.00" }],
          total: "2000.00",
        },
      ],
      total: "2000.00",
    },
    operatingIncome: "3000.00",
    netIncome: "3000.00",
    preliminary: false,
  },
  columns: [mockColumn],
};

describe("buildRowId", () => {
  it("construye id con section y subtype", () => {
    expect(buildRowId("activo", "activo-corriente", "acc1")).toBe(
      "row-activo_activo-corriente_acc1",
    );
  });

  it("usa __total para filas de total", () => {
    expect(buildRowId("activo", "activo-corriente", "__total")).toBe(
      "row-activo_activo-corriente___total",
    );
  });

  it("construye id de sección (sin subtype ni accountId)", () => {
    expect(buildRowId("activo")).toBe("row-activo");
  });

  it("construye id de total de sección", () => {
    expect(buildRowId("activo", "__total")).toBe("row-activo___total");
  });
});

describe("buildBalanceSheetTableRows", () => {
  it("retorna una fila de sección Activo en el primer nivel", () => {
    const rows = buildBalanceSheetTableRows(mockBS);
    const activoSection = rows.find((r) => r.id === "row-activo");
    expect(activoSection).toBeDefined();
    expect(activoSection?.semanticClass).toBe("top-level-grouped-row");
    expect(activoSection?.name).toBe("Activo");
    expect(activoSection?.indent).toBe(0);
  });

  it("cada sección tiene subRows de subtipos", () => {
    const rows = buildBalanceSheetTableRows(mockBS);
    const activoSection = rows.find((r) => r.id === "row-activo");
    expect(activoSection?.subRows?.length).toBeGreaterThan(0);
    const subtypeRow = activoSection?.subRows?.[0];
    expect(subtypeRow?.semanticClass).toBe("custom-grouped-row");
    expect(subtypeRow?.indent).toBe(1);
  });

  it("cada subtipo tiene subRows de cuentas", () => {
    const rows = buildBalanceSheetTableRows(mockBS);
    const activoSection = rows.find((r) => r.id === "row-activo");
    const subtypeRow = activoSection?.subRows?.[0];
    // subRows del subtipo = cuentas + fila total
    const accountRows = subtypeRow?.subRows?.filter((r) => r.semanticClass === "custom-bg-white");
    expect(accountRows?.length).toBe(1);
    expect(accountRows?.[0].name).toBe("Caja");
  });

  it("incluye fila de total de subtipo con semanticClass total-row", () => {
    const rows = buildBalanceSheetTableRows(mockBS);
    const activoSection = rows.find((r) => r.id === "row-activo");
    const subtypeRow = activoSection?.subRows?.[0];
    const totalSubtype = subtypeRow?.subRows?.find((r) => r.semanticClass === "total-row");
    expect(totalSubtype).toBeDefined();
  });

  it("incluye fila de total de sección como subRow al final", () => {
    const rows = buildBalanceSheetTableRows(mockBS);
    const activoSection = rows.find((r) => r.id === "row-activo");
    const sectionTotal = activoSection?.subRows?.find((r) => r.semanticClass === "total-row");
    expect(sectionTotal).toBeDefined();
    expect(sectionTotal?.columnValues["col-current"]).toBe("1000.00");
  });

  it("popula columnValues con el id de columna correcto", () => {
    const rows = buildBalanceSheetTableRows(mockBS);
    const activoSection = rows.find((r) => r.id === "row-activo");
    const subtypeRow = activoSection?.subRows?.[0];
    const accountRow = subtypeRow?.subRows?.find((r) => r.semanticClass === "custom-bg-white");
    expect(accountRow?.columnValues["col-current"]).toBe("1000.00");
  });

  it("genera filas para las 3 secciones (Activo, Pasivo, Patrimonio)", () => {
    const rows = buildBalanceSheetTableRows(mockBS);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("row-activo");
    expect(ids).toContain("row-pasivo");
    expect(ids).toContain("row-patrimonio");
  });
});

describe("buildIncomeStatementTableRows", () => {
  it("retorna sección Ingresos en el primer nivel", () => {
    const rows = buildIncomeStatementTableRows(mockIncome);
    const ingresosSection = rows.find((r) => r.id === "row-ingresos");
    expect(ingresosSection).toBeDefined();
    expect(ingresosSection?.semanticClass).toBe("top-level-grouped-row");
  });

  it("retorna sección Gastos en el primer nivel", () => {
    const rows = buildIncomeStatementTableRows(mockIncome);
    const gastosSection = rows.find((r) => r.id === "row-gastos");
    expect(gastosSection).toBeDefined();
  });

  it("incluye fila de Utilidad Neta como top-level total-row", () => {
    const rows = buildIncomeStatementTableRows(mockIncome);
    const utilidadRow = rows.find((r) => r.id === "row-utilidad-neta");
    expect(utilidadRow).toBeDefined();
    expect(utilidadRow?.semanticClass).toBe("total-row");
    expect(utilidadRow?.columnValues["col-current"]).toBe("3000.00");
  });

  it("las cuentas de ingresos están en subRows del subtipo", () => {
    const rows = buildIncomeStatementTableRows(mockIncome);
    const ingresos = rows.find((r) => r.id === "row-ingresos");
    const subtypeRow = ingresos?.subRows?.[0];
    const accounts = subtypeRow?.subRows?.filter((r) => r.semanticClass === "custom-bg-white");
    expect(accounts?.length).toBe(1);
    expect(accounts?.[0].name).toBe("Ventas");
  });
});
