/**
 * Tests del builder de asientos contables de Ventas.
 *
 * PR1 — Tasks 1.1 (RED): Baseline de regresión para buildSaleEntryLines
 * sin IvaBook — bloquea el comportamiento actual antes de cualquier cambio.
 */

import { describe, it, expect } from "vitest";
import {
  buildSaleEntryLines,
  IVA_DEBITO_FISCAL,
  type SaleDetailForEntry,
  type SaleOrgSettings,
  type IvaBookForEntry,
} from "../sale.utils";

// ── Fixtures compartidos ──────────────────────────────────────────────────────

const settings: SaleOrgSettings = {
  cxcAccountCode: "1.1.3",
};

const contactId = "contact-test-001";

// ── describe: buildSaleEntryLines — non-IVA path (regression baseline) ────────

describe("buildSaleEntryLines — non-IVA path (regression baseline)", () => {
  it("con 1 detalle: devuelve 1 línea DR CxC + 1 línea CR ingreso (total 2 líneas)", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1" },
    ];

    const lines = buildSaleEntryLines(100, details, settings, contactId);

    expect(lines).toHaveLength(2);

    // DR CxC
    expect(lines[0]).toMatchObject({
      accountCode: "1.1.3",
      debit: 100,
      credit: 0,
      contactId,
    });

    // CR Ingreso
    expect(lines[1]).toMatchObject({
      accountCode: "4.1.1",
      debit: 0,
      credit: 100,
    });
  });

  it("con 3 detalles: devuelve 1 línea DR CxC + 3 líneas CR ingreso (total 4 líneas)", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 50, incomeAccountCode: "4.1.1", description: "Línea A" },
      { lineAmount: 30, incomeAccountCode: "4.1.2", description: "Línea B" },
      { lineAmount: 20, incomeAccountCode: "4.1.3", description: "Línea C" },
    ];

    const lines = buildSaleEntryLines(100, details, settings, contactId);

    expect(lines).toHaveLength(4);

    // DR CxC por el total
    expect(lines[0]).toMatchObject({
      accountCode: "1.1.3",
      debit: 100,
      credit: 0,
      contactId,
    });

    // CRs por cada detalle
    expect(lines[1]).toMatchObject({ accountCode: "4.1.1", debit: 0, credit: 50 });
    expect(lines[2]).toMatchObject({ accountCode: "4.1.2", debit: 0, credit: 30 });
    expect(lines[3]).toMatchObject({ accountCode: "4.1.3", debit: 0, credit: 20 });
  });

  it("asiento está balanceado: suma débitos === suma créditos", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 60, incomeAccountCode: "4.1.1" },
      { lineAmount: 40, incomeAccountCode: "4.1.2" },
    ];

    const lines = buildSaleEntryLines(100, details, settings, contactId);

    const totalDebits = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredits = lines.reduce((sum, l) => sum + l.credit, 0);

    expect(totalDebits).toBe(totalCredits);
  });

  it("ivaBook = undefined produce el mismo resultado que no pasarlo (SPEC-3 doble cobertura)", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1" },
    ];

    const withoutArg = buildSaleEntryLines(100, details, settings, contactId);
    const withUndefined = buildSaleEntryLines(100, details, settings, contactId, undefined);

    expect(withUndefined).toEqual(withoutArg);
  });
});

// ── describe: buildSaleEntryLines — con IvaBook (PR2) ─────────────────────────

describe("buildSaleEntryLines — con IvaBook activo y base IVA completa (SPEC-1, SPEC-8)", () => {
  // Fixture A: 1 detalle, base gravable completa (sin exentos)
  it("Fixture A — 1 detalle, base 100, IVA 13, total 113: genera exactamente 3 líneas balanceadas", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 113, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 113,
    };

    const lines = buildSaleEntryLines(113, details, settings, contactId, ivaBook);

    expect(lines).toHaveLength(3);

    // DR CxC por el total
    expect(lines[0]).toMatchObject({
      accountCode: "1.1.3",
      debit: 113,
      credit: 0,
      contactId,
    });

    // CR Ventas por base IVA (baseIvaSujetoCf)
    expect(lines[1]).toMatchObject({
      accountCode: "4.1.1",
      debit: 0,
      credit: 100,
    });

    // CR IVA Débito Fiscal
    expect(lines[2]).toMatchObject({
      accountCode: IVA_DEBITO_FISCAL,
      debit: 0,
      credit: 13,
    });

    // balance invariant
    const totalDebits = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredits = lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebits).toBe(totalCredits);
  });

  // Fixture B: 3 detalles, collapse a 1 línea CR ingreso (SPEC-8)
  it("Fixture B — 3 detalles con IvaBook: colapsa a 3 líneas (no 5); usa cuenta del primer detalle", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 50, incomeAccountCode: "4.1.1", description: "Detalle 1" },
      { lineAmount: 40, incomeAccountCode: "4.1.2", description: "Detalle 2" },
      { lineAmount: 23, incomeAccountCode: "4.1.3", description: "Detalle 3" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 113,
    };

    const lines = buildSaleEntryLines(113, details, settings, contactId, ivaBook);

    // SPEC-8: exactly 3 lines (not 5)
    expect(lines).toHaveLength(3);

    // DR CxC
    expect(lines[0]).toMatchObject({ accountCode: "1.1.3", debit: 113, credit: 0 });

    // CR Ventas — primer detalle's account
    expect(lines[1]).toMatchObject({ accountCode: "4.1.1", credit: 100 });

    // CR IVA
    expect(lines[2]).toMatchObject({ accountCode: IVA_DEBITO_FISCAL, credit: 13 });

    // balance
    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture D: exento residual → 4ta línea (Design Risk-1)
  it("Fixture D — exento residual: base 100, IVA 13, exentos 37, total 150 → 4 líneas balanceadas", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 150, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 150,
    };

    const lines = buildSaleEntryLines(150, details, settings, contactId, ivaBook);

    expect(lines).toHaveLength(4);

    // DR CxC 150
    expect(lines[0]).toMatchObject({ accountCode: "1.1.3", debit: 150, credit: 0 });

    // CR Ventas base gravable
    expect(lines[1]).toMatchObject({ accountCode: "4.1.1", credit: 100 });

    // CR IVA 2.1.6
    expect(lines[2]).toMatchObject({ accountCode: IVA_DEBITO_FISCAL, credit: 13 });

    // CR Ventas exento residual (150 - 100 - 13 = 37)
    expect(lines[3]).toMatchObject({ accountCode: "4.1.1", credit: 37 });

    // balance invariant
    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture E: rounding edge — debe balancear sin throw
  it("Fixture E — edge de redondeo: base 100.01, IVA 13.00, total 113.01 → balanceado, sin throw", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 113.01, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100.01,
      dfCfIva: 13,
      importeTotal: 113.01,
    };

    expect(() =>
      buildSaleEntryLines(113.01, details, settings, contactId, ivaBook)
    ).not.toThrow();

    const lines = buildSaleEntryLines(113.01, details, settings, contactId, ivaBook);
    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(Math.abs(dr - cr)).toBeLessThan(0.01);
  });
});

// ── describe: buildSaleEntryLines — venta exenta (SPEC-4) ─────────────────────

describe("buildSaleEntryLines — venta exenta con IvaBook (dfCfIva = 0) (SPEC-4)", () => {
  // Fixture C: dfCfIva = 0 → sin línea 2.1.6, cae a path no-IVA
  it("Fixture C — dfCfIva=0: no genera línea 2.1.6 y usa N líneas de detalle", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 50, incomeAccountCode: "4.1.1" },
      { lineAmount: 50, incomeAccountCode: "4.1.2" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 0,
      importeTotal: 100,
    };

    const lines = buildSaleEntryLines(100, details, settings, contactId, ivaBook);

    // No line with accountCode 2.1.6
    const ivaLine = lines.find((l) => l.accountCode === IVA_DEBITO_FISCAL);
    expect(ivaLine).toBeUndefined();

    // Falls back to N-detail path: 1 DR + 2 CR
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ accountCode: "1.1.3", debit: 100 });
  });
});

// ── describe: buildSaleEntryLines — invariante de balance (SPEC-8) ─────────────

describe("buildSaleEntryLines — invariante de balance (SPEC-8)", () => {
  it("lanza error descriptivo cuando base + IVA + exentos ≠ importeTotal (residual > 0.005)", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 113, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 120, // deliberadamente no cierra: 100 + 13 + residual(7) → pero el residual se emite como 4ta línea, así que ponemos totales que NO baten
      exentos: 0, // override explicit exentos=0 so residual gets auto-computed...
      // Actually we need a case where base+iva+explicit_exentos != importeTotal.
      // The spec says builder throws when invariant violated with explicit exentos provided.
      // We'll test passing explicit exentos that don't match: base=100, iva=13, exentos=5, total=120 → 100+13+5=118 ≠ 120
    };
    // Override: use explicit exentos that causes mismatch
    const badIvaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      exentos: 5, // explicitly provided
      importeTotal: 120, // 100 + 13 + 5 = 118 ≠ 120 → MUST throw
    };

    expect(() =>
      buildSaleEntryLines(120, details, settings, contactId, badIvaBook)
    ).toThrow();
  });
});
