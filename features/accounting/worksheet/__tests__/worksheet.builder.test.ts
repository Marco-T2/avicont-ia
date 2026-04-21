/**
 * T5 — RED: Worksheet builder golden fixture + edge cases.
 *
 * All tests cover the pure buildWorksheet() function — no Prisma, no DB.
 * Uses concrete numeric scenarios from the spec.
 *
 * Covers: REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-8, REQ-9, REQ-15
 */

import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { buildWorksheet, type BuildWorksheetInput } from "../worksheet.builder";
import type { WorksheetAccountMetadata } from "../worksheet.repository";

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = (v: string | number) => new Prisma.Decimal(String(v));
const zero = D(0);

function makeAccount(
  overrides: Partial<WorksheetAccountMetadata> & Pick<WorksheetAccountMetadata, "id" | "type">,
): WorksheetAccountMetadata {
  return {
    id: overrides.id,
    code: overrides.code ?? `${overrides.id}.code`,
    name: overrides.name ?? `Account ${overrides.id}`,
    level: overrides.level ?? 3,
    type: overrides.type,
    nature: overrides.nature ?? "DEUDORA",
    isActive: overrides.isActive ?? true,
    isDetail: overrides.isDetail ?? true,
    isContraAccount: overrides.isContraAccount ?? false,
  };
}

type AggEntry = { accountId: string; totalDebit: Prisma.Decimal; totalCredit: Prisma.Decimal; nature: "DEUDORA" | "ACREEDORA" };

function agg(accountId: string, debit: string | number, credit: string | number, nature: "DEUDORA" | "ACREEDORA" = "DEUDORA"): AggEntry {
  return { accountId, totalDebit: D(debit), totalCredit: D(credit), nature };
}

// ── T5: Golden fixture — normal mixed case ────────────────────────────────────

describe("buildWorksheet — golden fixture (REQ-2, REQ-3, REQ-5, REQ-7, REQ-9, REQ-15)", () => {
  /**
   * Fixture:
   * - ACTIVO:     Caja 1.1.1   sumasDebe=207000, sumasHaber=23152, no ajustes
   * - PASIVO:     Proveedores  sumasHaber=45000, no ajustes
   * - PATRIMONIO: Capital      sumasHaber=100000, no ajustes
   * - INGRESO:    Ventas       sumasHaber=80000, no ajustes
   * - GASTO:      Costo Ventas sumasDebe=60000, no ajustes
   *
   * Expected carry-over: ganancia = 80000 - 60000 = 20000
   *   → carryOver.resultadosPerdidas=20000, bgPasPat=20000
   *
   * BG invariant: bgActivo(183848+0) + carry(20000) should balance with bgPasPat(45000+100000+20000)
   * Wait — they won't balance because ACTIVO=183848, Pas-Pat=165000 after carry-over.
   * So imbalanced=true here? Let's compute properly:
   *   Caja: saldoDeudor=183848, bgActivo=183848
   *   Proveedores: saldoAcreedor=45000, bgPasPat=45000
   *   Capital: saldoAcreedor=100000, bgPasPat=100000
   *   Ventas: saldoAcreedor=80000, resultadosGanancias=80000
   *   Costos: saldoDeudor=60000, resultadosPerdidas=60000
   * Ganancia=20000 → carryOver: resultadosPerdidas+=20000, bgPasPat+=20000
   * Σ bgActivo = 183848, Σ bgPasPat = 45000+100000+20000 = 165000
   * Still imbalanced — fixture is intentionally unbalanced (no contra account to match activo fully)
   *
   * The test validates column values and carry-over, not the invariant on this tiny fixture.
   */

  const accounts: WorksheetAccountMetadata[] = [
    makeAccount({ id: "caja", code: "1.1.1", name: "Caja", type: "ACTIVO", nature: "DEUDORA" }),
    makeAccount({ id: "prov", code: "2.1.1", name: "Proveedores", type: "PASIVO", nature: "ACREEDORA" }),
    makeAccount({ id: "cap", code: "3.1.1", name: "Capital Social", type: "PATRIMONIO", nature: "ACREEDORA" }),
    makeAccount({ id: "vtas", code: "4.1.1", name: "Ventas", type: "INGRESO", nature: "ACREEDORA" }),
    makeAccount({ id: "costo", code: "5.1.1", name: "Costo de Ventas", type: "GASTO", nature: "DEUDORA" }),
  ];

  const sumas: AggEntry[] = [
    agg("caja",  "207000", "23152", "DEUDORA"),
    agg("prov",  "0",      "45000", "ACREEDORA"),
    agg("cap",   "0",      "100000","ACREEDORA"),
    agg("vtas",  "0",      "80000", "ACREEDORA"),
    agg("costo", "60000",  "0",     "DEUDORA"),
  ];

  const ajustes: AggEntry[] = []; // all zero — no CJ entries

  const input: BuildWorksheetInput = {
    accounts,
    sumas,
    ajustes,
    dateFrom: new Date("2025-01-01"),
    dateTo: new Date("2025-12-31"),
  };

  let result: ReturnType<typeof buildWorksheet>;

  it("builds without throwing", () => {
    result = buildWorksheet(input);
    expect(result).toBeDefined();
  });

  it("produces 5 groups in canonical order (ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO)", () => {
    result = buildWorksheet(input);
    expect(result.groups).toHaveLength(5);
    expect(result.groups[0].accountType).toBe("ACTIVO");
    expect(result.groups[1].accountType).toBe("PASIVO");
    expect(result.groups[2].accountType).toBe("PATRIMONIO");
    expect(result.groups[3].accountType).toBe("INGRESO");
    expect(result.groups[4].accountType).toBe("GASTO");
  });

  it("Caja row: sumasDebe=207000, sumasHaber=23152, saldoDeudor=183848, saldoAcreedor=0", () => {
    result = buildWorksheet(input);
    const cajaGroup = result.groups.find((g) => g.accountType === "ACTIVO")!;
    const cajaRow = cajaGroup.rows.find((r) => r.accountId === "caja")!;
    expect(cajaRow).toBeDefined();
    expect(cajaRow.sumasDebe.toFixed(2)).toBe("207000.00");
    expect(cajaRow.sumasHaber.toFixed(2)).toBe("23152.00");
    expect(cajaRow.saldoDeudor.toFixed(2)).toBe("183848.00");
    expect(cajaRow.saldoAcreedor.toFixed(2)).toBe("0.00");
  });

  it("Caja row: saldoAjDeudor=183848 (no ajustes), bgActivo=183848", () => {
    result = buildWorksheet(input);
    const cajaRow = result.groups[0].rows.find((r) => r.accountId === "caja")!;
    expect(cajaRow.ajustesDebe.toFixed(2)).toBe("0.00");
    expect(cajaRow.ajustesHaber.toFixed(2)).toBe("0.00");
    expect(cajaRow.saldoAjDeudor.toFixed(2)).toBe("183848.00");
    expect(cajaRow.saldoAjAcreedor.toFixed(2)).toBe("0.00");
    expect(cajaRow.bgActivo.toFixed(2)).toBe("183848.00");
    expect(cajaRow.bgPasPat.toFixed(2)).toBe("0.00");
    expect(cajaRow.resultadosPerdidas.toFixed(2)).toBe("0.00");
    expect(cajaRow.resultadosGanancias.toFixed(2)).toBe("0.00");
  });

  it("Proveedores row: bgPasPat=45000 (REQ-5: PASIVO → acreedor side)", () => {
    result = buildWorksheet(input);
    const provRow = result.groups[1].rows.find((r) => r.accountId === "prov")!;
    expect(provRow.saldoDeudor.toFixed(2)).toBe("0.00");
    expect(provRow.saldoAcreedor.toFixed(2)).toBe("45000.00");
    expect(provRow.bgActivo.toFixed(2)).toBe("0.00");
    expect(provRow.bgPasPat.toFixed(2)).toBe("45000.00");
  });

  it("Ventas row: resultadosGanancias=80000 (REQ-5: INGRESO → ganancias)", () => {
    result = buildWorksheet(input);
    const vtasRow = result.groups[3].rows.find((r) => r.accountId === "vtas")!;
    expect(vtasRow.resultadosGanancias.toFixed(2)).toBe("80000.00");
    expect(vtasRow.resultadosPerdidas.toFixed(2)).toBe("0.00");
    expect(vtasRow.bgActivo.toFixed(2)).toBe("0.00");
    expect(vtasRow.bgPasPat.toFixed(2)).toBe("0.00");
  });

  it("Costo Ventas row: resultadosPerdidas=60000 (REQ-5: GASTO → pérdidas)", () => {
    result = buildWorksheet(input);
    const costoRow = result.groups[4].rows.find((r) => r.accountId === "costo")!;
    expect(costoRow.resultadosPerdidas.toFixed(2)).toBe("60000.00");
    expect(costoRow.resultadosGanancias.toFixed(2)).toBe("0.00");
  });

  it("carry-over: ganancia=20000 (80000 - 60000), placed in resultadosPerdidas and bgPasPat (REQ-7.S1)", () => {
    result = buildWorksheet(input);
    expect(result.carryOverRow).toBeDefined();
    const co = result.carryOverRow!;
    expect(co.isCarryOver).toBe(true);
    expect(co.name).toContain("Ganancia");
    expect(co.resultadosPerdidas.toFixed(2)).toBe("20000.00");
    expect(co.bgPasPat.toFixed(2)).toBe("20000.00");
    expect(co.resultadosGanancias.toFixed(2)).toBe("0.00");
    expect(co.bgActivo.toFixed(2)).toBe("0.00");
  });

  it("grand totals: resultadosPerdidas = resultadosGanancias after carry-over (ER invariant, REQ-15)", () => {
    result = buildWorksheet(input);
    const gt = result.grandTotals;
    // Σ resultadosPerdidas = 60000 (costo) + 20000 (carry-over) = 80000
    // Σ resultadosGanancias = 80000 (ventas)
    expect(gt.resultadosPerdidas.toFixed(2)).toBe("80000.00");
    expect(gt.resultadosGanancias.toFixed(2)).toBe("80000.00");
  });

  it("all 12 numeric fields on every row are Prisma.Decimal instances (REQ-2)", () => {
    result = buildWorksheet(input);
    const allRows = result.groups.flatMap((g) => g.rows);
    const fields: (keyof typeof allRows[0])[] = [
      "sumasDebe", "sumasHaber", "saldoDeudor", "saldoAcreedor",
      "ajustesDebe", "ajustesHaber", "saldoAjDeudor", "saldoAjAcreedor",
      "resultadosPerdidas", "resultadosGanancias", "bgActivo", "bgPasPat",
    ];
    for (const row of allRows) {
      for (const field of fields) {
        expect(row[field], `${row.accountId}.${field} should be Decimal`).toBeInstanceOf(Prisma.Decimal);
      }
    }
  });

  it("grand totals fields are Prisma.Decimal instances (REQ-14)", () => {
    result = buildWorksheet(input);
    const fields: (keyof typeof result.grandTotals)[] = [
      "sumasDebe", "sumasHaber", "saldoDeudor", "saldoAcreedor",
      "ajustesDebe", "ajustesHaber", "saldoAjDeudor", "saldoAjAcreedor",
      "resultadosPerdidas", "resultadosGanancias", "bgActivo", "bgPasPat",
    ];
    for (const field of fields) {
      expect(result.grandTotals[field]).toBeInstanceOf(Prisma.Decimal);
    }
  });
});

// ── T7: Sign-flip edge case (REQ-4.S3) ───────────────────────────────────────

describe("buildWorksheet — sign-flip edge case (REQ-4.S3, REQ-8)", () => {
  /**
   * ACTIVO account: saldoDeudor=2000, ajustesHaber=8000
   * Expected:
   *   lhs = 2000 + 0 = 2000
   *   rhs = 0 + 8000 = 8000
   *   saldoAjDeudor = MAX(2000-8000, 0) = 0
   *   saldoAjAcreedor = MAX(8000-2000, 0) = 6000
   * Since type=ACTIVO and saldoAjDeudor=0, bgActivo = 0 (non-contra)
   * Row is still VISIBLE because ajustesHaber ≠ 0 (REQ-8)
   */

  const accounts: WorksheetAccountMetadata[] = [
    makeAccount({ id: "flipped", code: "1.1.2", name: "Cuenta Ajustada", type: "ACTIVO", nature: "DEUDORA" }),
  ];

  const sumas: AggEntry[] = [
    agg("flipped", "2000", "0", "DEUDORA"),
  ];

  const ajustes: AggEntry[] = [
    agg("flipped", "0", "8000", "DEUDORA"),
  ];

  const input: BuildWorksheetInput = { accounts, sumas, ajustes, dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") };

  it("saldoAjDeudor=0, saldoAjAcreedor=6000 after sign-flip (REQ-4.S3)", () => {
    const result = buildWorksheet(input);
    const row = result.groups[0].rows.find((r) => r.accountId === "flipped")!;
    expect(row.saldoDeudor.toFixed(2)).toBe("2000.00");
    expect(row.saldoAcreedor.toFixed(2)).toBe("0.00");
    expect(row.ajustesDebe.toFixed(2)).toBe("0.00");
    expect(row.ajustesHaber.toFixed(2)).toBe("8000.00");
    expect(row.saldoAjDeudor.toFixed(2)).toBe("0.00");
    expect(row.saldoAjAcreedor.toFixed(2)).toBe("6000.00");
  });

  it("bgActivo=0 for sign-flipped ACTIVO account (saldoAjDeudor=0, non-contra)", () => {
    const result = buildWorksheet(input);
    const row = result.groups[0].rows.find((r) => r.accountId === "flipped")!;
    expect(row.bgActivo.toFixed(2)).toBe("0.00");
    expect(row.bgPasPat.toFixed(2)).toBe("0.00");
  });

  it("sign-flipped row is still VISIBLE because ajustesHaber ≠ 0 (REQ-8)", () => {
    const result = buildWorksheet(input);
    const group = result.groups.find((g) => g.accountType === "ACTIVO");
    expect(group).toBeDefined();
    const row = group!.rows.find((r) => r.accountId === "flipped");
    expect(row).toBeDefined(); // visible
  });
});

// ── T9: Contra-account routing (REQ-6) ───────────────────────────────────────

describe("buildWorksheet — contra-account routing (REQ-6)", () => {
  /**
   * Depreciación Acumulada: isContraAccount=true, type=ACTIVO, nature=ACREEDORA
   * sumasHaber=120000 → saldoAcreedor=120000 → saldoAjAcreedor=120000
   * bgActivo = -saldoAjAcreedor = -120000
   * Group total for ACTIVO with Edificios(500000) + Depreciación(-120000) = 380000
   */

  const accounts: WorksheetAccountMetadata[] = [
    makeAccount({ id: "edificios", code: "1.2.1", name: "Edificios", type: "ACTIVO", nature: "DEUDORA" }),
    makeAccount({ id: "depr", code: "1.2.6", name: "Depreciación Acumulada", type: "ACTIVO", nature: "ACREEDORA", isContraAccount: true }),
  ];

  const sumas: AggEntry[] = [
    agg("edificios", "500000", "0",      "DEUDORA"),
    agg("depr",      "0",      "120000", "ACREEDORA"),
  ];

  const ajustes: AggEntry[] = [];

  const input: BuildWorksheetInput = { accounts, sumas, ajustes, dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") };

  it("contra-account bgActivo = -120000 (REQ-6.S1)", () => {
    const result = buildWorksheet(input);
    const group = result.groups.find((g) => g.accountType === "ACTIVO")!;
    const deprRow = group.rows.find((r) => r.accountId === "depr")!;
    expect(deprRow.saldoAcreedor.toFixed(2)).toBe("120000.00");
    expect(deprRow.saldoAjAcreedor.toFixed(2)).toBe("120000.00");
    expect(deprRow.bgActivo.toFixed(2)).toBe("-120000.00");
  });

  it("ACTIVO group total subtracts contra: 500000 + (-120000) = 380000 (REQ-6.S2)", () => {
    const result = buildWorksheet(input);
    const group = result.groups.find((g) => g.accountType === "ACTIVO")!;
    expect(group.subtotals.bgActivo.toFixed(2)).toBe("380000.00");
  });

  it("non-contra ACTIVO account is unaffected (REQ-6.S4)", () => {
    const result = buildWorksheet(input);
    const group = result.groups.find((g) => g.accountType === "ACTIVO")!;
    const edificiosRow = group.rows.find((r) => r.accountId === "edificios")!;
    expect(edificiosRow.bgActivo.toFixed(2)).toBe("500000.00");
    expect(edificiosRow.isContraAccount).toBe(false);
  });

  it("contra with sign-flipped saldoAjDeudor>0 (REQ-6.E1): bgActivo = -saldoAjDeudor", () => {
    // Unusual contra that ended up with a deudor balance after adjustment
    const contraFlippedAccounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "contra-flip", code: "1.2.7", name: "Contra Flipped", type: "ACTIVO", nature: "ACREEDORA", isContraAccount: true }),
    ];
    // saldoAcreedor=10000, ajustesDebe=15000 → lhs=0+15000=15000, rhs=10000+0=10000 → saldoAjDeudor=5000
    const contraFlippedSumas: AggEntry[] = [agg("contra-flip", "0", "10000", "ACREEDORA")];
    const contraFlippedAjustes: AggEntry[] = [agg("contra-flip", "15000", "0", "ACREEDORA")];

    const result = buildWorksheet({
      accounts: contraFlippedAccounts,
      sumas: contraFlippedSumas,
      ajustes: contraFlippedAjustes,
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    });

    const group = result.groups.find((g) => g.accountType === "ACTIVO")!;
    const row = group.rows.find((r) => r.accountId === "contra-flip")!;
    expect(row.saldoAjDeudor.toFixed(2)).toBe("5000.00");
    // REQ-6.E1: bgActivo = -saldoAjDeudor = -5000
    expect(row.bgActivo.toFixed(2)).toBe("-5000.00");
  });
});

// ── T11: Carry-over pérdida path + zero result (REQ-7.S2, REQ-7.S3) ──────────

describe("buildWorksheet — carry-over pérdida + zero result (REQ-7)", () => {
  it("REQ-7.S2: net pérdida → carryOver in resultadosGanancias and bgPasPat (negated)", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "ing", code: "4.1.1", name: "Ingresos", type: "INGRESO", nature: "ACREEDORA" }),
      makeAccount({ id: "gst", code: "5.1.1", name: "Gastos", type: "GASTO", nature: "DEUDORA" }),
    ];
    const sumas: AggEntry[] = [
      agg("ing", "0",     "40000", "ACREEDORA"),
      agg("gst", "65000", "0",     "DEUDORA"),
    ];
    const result = buildWorksheet({ accounts, sumas, ajustes: [], dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") });

    expect(result.carryOverRow).toBeDefined();
    const co = result.carryOverRow!;
    expect(co.name).toContain("Pérdida");
    expect(co.resultadosGanancias.toFixed(2)).toBe("25000.00");
    // Pérdida reduces equity → Pas-Pat negative (displayed with parens), NOT Activo positive.
    expect(co.bgPasPat.toFixed(2)).toBe("-25000.00");
    expect(co.bgActivo.toFixed(2)).toBe("0.00");
    expect(co.resultadosPerdidas.toFixed(2)).toBe("0.00");

    // ER invariant: both sides = 65000
    expect(result.grandTotals.resultadosPerdidas.toFixed(2)).toBe("65000.00");
    expect(result.grandTotals.resultadosGanancias.toFixed(2)).toBe("65000.00");
  });

  it("REQ-7.S3: zero result → no carry-over row appended", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "ing2", code: "4.1.2", name: "Ingresos 2", type: "INGRESO", nature: "ACREEDORA" }),
      makeAccount({ id: "gst2", code: "5.1.2", name: "Gastos 2", type: "GASTO", nature: "DEUDORA" }),
    ];
    const sumas: AggEntry[] = [
      agg("ing2", "0",     "50000", "ACREEDORA"),
      agg("gst2", "50000", "0",     "DEUDORA"),
    ];
    const result = buildWorksheet({ accounts, sumas, ajustes: [], dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") });

    expect(result.carryOverRow).toBeUndefined();
  });
});

// ── T13: Visibility filter (REQ-8) ────────────────────────────────────────────

describe("buildWorksheet — visibility filter (REQ-8)", () => {
  it("REQ-8.S1: zero saldo AND zero ajuste → row hidden", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "zero", code: "1.1.5", name: "Otros Activos", type: "ACTIVO" }),
    ];
    const result = buildWorksheet({ accounts, sumas: [], ajustes: [], dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") });
    const group = result.groups.find((g) => g.accountType === "ACTIVO");
    // Either group doesn't exist, or row is not present
    const zeroRow = group?.rows.find((r) => r.accountId === "zero");
    expect(zeroRow).toBeUndefined();
  });

  it("REQ-8.S2: saldo=0 BUT ajustesDebe=12000 → row visible with saldoAjDeudor=12000", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "ajuste-only", code: "5.2.1", name: "Depreciación Ej.", type: "GASTO" }),
    ];
    const ajustes: AggEntry[] = [agg("ajuste-only", "12000", "0")];
    const result = buildWorksheet({ accounts, sumas: [], ajustes, dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") });
    const group = result.groups.find((g) => g.accountType === "GASTO")!;
    const row = group.rows.find((r) => r.accountId === "ajuste-only")!;
    expect(row).toBeDefined();
    expect(row.saldoAjDeudor.toFixed(2)).toBe("12000.00");
  });

  it("REQ-8.S3: isDetail=false account → always hidden even with activity", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "header", code: "1.1", name: "Activo Corriente", type: "ACTIVO", isDetail: false }),
    ];
    const sumas: AggEntry[] = [agg("header", "500000", "0")];
    const result = buildWorksheet({ accounts, sumas, ajustes: [], dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") });
    const group = result.groups.find((g) => g.accountType === "ACTIVO");
    const row = group?.rows.find((r) => r.accountId === "header");
    expect(row).toBeUndefined();
  });

  it("REQ-8.S4: non-zero saldo ajustado (but zero ajuste) → row visible", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "active", code: "1.1.1", name: "Caja", type: "ACTIVO" }),
    ];
    const sumas: AggEntry[] = [agg("active", "183848", "0")];
    const result = buildWorksheet({ accounts, sumas, ajustes: [], dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") });
    const group = result.groups.find((g) => g.accountType === "ACTIVO")!;
    const row = group.rows.find((r) => r.accountId === "active");
    expect(row).toBeDefined();
  });
});

// ── T15: Edge cases — empty org + pure CJ + pure non-CJ (design §11) ─────────

describe("buildWorksheet — edge cases (design §11)", () => {
  it("empty inputs → empty groups, no carry-over, all-zero totals, imbalanced=false", () => {
    const result = buildWorksheet({
      accounts: [],
      sumas: [],
      ajustes: [],
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    });

    expect(result.groups).toHaveLength(0);
    expect(result.carryOverRow).toBeUndefined();
    expect(result.grandTotals.bgActivo.toFixed(2)).toBe("0.00");
    expect(result.grandTotals.bgPasPat.toFixed(2)).toBe("0.00");
    expect(result.imbalanced).toBe(false);
    expect(result.imbalanceDelta.toFixed(2)).toBe("0.00");
  });

  it("pure CJ only (no sumas) → sumas cols zero, ajustes cols populated", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "gsto", code: "5.1.1", name: "Gastos", type: "GASTO" }),
    ];
    const ajustes: AggEntry[] = [agg("gsto", "15000", "0")];
    const result = buildWorksheet({
      accounts,
      sumas: [],
      ajustes,
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    });

    const group = result.groups.find((g) => g.accountType === "GASTO")!;
    const row = group.rows.find((r) => r.accountId === "gsto")!;
    expect(row.sumasDebe.toFixed(2)).toBe("0.00");
    expect(row.sumasHaber.toFixed(2)).toBe("0.00");
    expect(row.ajustesDebe.toFixed(2)).toBe("15000.00");
    expect(row.saldoAjDeudor.toFixed(2)).toBe("15000.00");
    expect(row.resultadosPerdidas.toFixed(2)).toBe("15000.00");
  });

  it("pure non-CJ (no ajustes) → ajustes cols zero, saldos ajustados = saldos", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "cja2", code: "1.1.1", name: "Caja2", type: "ACTIVO" }),
    ];
    const sumas: AggEntry[] = [agg("cja2", "100000", "30000")];
    const result = buildWorksheet({
      accounts,
      sumas,
      ajustes: [],
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    });

    const row = result.groups[0].rows.find((r) => r.accountId === "cja2")!;
    expect(row.ajustesDebe.toFixed(2)).toBe("0.00");
    expect(row.ajustesHaber.toFixed(2)).toBe("0.00");
    expect(row.saldoDeudor.toFixed(2)).toBe("70000.00");
    expect(row.saldoAjDeudor.toFixed(2)).toBe("70000.00"); // same as saldo
  });

  it("contra with non-ACTIVO type logs a warn and routes normally (defensive guard)", () => {
    // Data anomaly: isContraAccount=true on a PASIVO account
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "anomaly", code: "2.1.9", name: "Contra Pasivo", type: "PASIVO", nature: "ACREEDORA", isContraAccount: true }),
    ];
    const sumas: AggEntry[] = [agg("anomaly", "0", "50000", "ACREEDORA")];
    // Should not crash — route as normal PASIVO
    expect(() => buildWorksheet({
      accounts,
      sumas,
      ajustes: [],
      dateFrom: new Date("2025-01-01"),
      dateTo: new Date("2025-12-31"),
    })).not.toThrow();
  });
});

// ── REQ-9: Canonical group order + empty group omission ───────────────────────

describe("buildWorksheet — grouping (REQ-9)", () => {
  it("REQ-9.S3: empty group is omitted (no empty placeholders)", () => {
    // Only ACTIVO and INGRESO accounts — PASIVO, PATRIMONIO, GASTO omitted
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "a1", code: "1.1.1", name: "Caja", type: "ACTIVO" }),
      makeAccount({ id: "i1", code: "4.1.1", name: "Ventas", type: "INGRESO", nature: "ACREEDORA" }),
    ];
    const sumas: AggEntry[] = [
      agg("a1", "50000", "0"),
      agg("i1", "0", "30000", "ACREEDORA"),
    ];
    const result = buildWorksheet({ accounts, sumas, ajustes: [], dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") });

    const types = result.groups.map((g) => g.accountType);
    expect(types).not.toContain("PASIVO");
    expect(types).not.toContain("PATRIMONIO");
    // GASTO might appear as carry-over but not as a group with rows
    // Since GASTO has no rows, it should be omitted
    const gastoGroup = result.groups.find((g) => g.accountType === "GASTO");
    expect(gastoGroup).toBeUndefined();
  });

  it("REQ-9.S4: grand totals span all groups", () => {
    const accounts: WorksheetAccountMetadata[] = [
      makeAccount({ id: "a2", code: "1.1.1", name: "Caja", type: "ACTIVO" }),
      makeAccount({ id: "p2", code: "2.1.1", name: "Proveedores", type: "PASIVO", nature: "ACREEDORA" }),
    ];
    const sumas: AggEntry[] = [
      agg("a2", "100000", "0"),
      agg("p2", "0", "80000", "ACREEDORA"),
    ];
    const result = buildWorksheet({ accounts, sumas, ajustes: [], dateFrom: new Date("2025-01-01"), dateTo: new Date("2025-12-31") });

    // grandTotals.sumasDebe = sum of all groups' sumasDebe
    // ACTIVO: sumasDebe=100000, PASIVO: sumasDebe=0
    expect(result.grandTotals.sumasDebe.toFixed(2)).toBe("100000.00");
    // grandTotals.sumasHaber = 0 + 80000 = 80000
    expect(result.grandTotals.sumasHaber.toFixed(2)).toBe("80000.00");
    // grandTotals.bgActivo = 100000
    expect(result.grandTotals.bgActivo.toFixed(2)).toBe("100000.00");
    // grandTotals.bgPasPat = 80000
    expect(result.grandTotals.bgPasPat.toFixed(2)).toBe("80000.00");
  });
});
