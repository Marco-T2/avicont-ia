/**
 * Tests del builder de asientos contables de Ventas.
 *
 * Convención SIN Bolivia (Form. 200):
 * - baseIvaSujetoCf = "Importe Base SIAT" (ya incluye IVA conceptualmente)
 * - dfCfIva = baseIvaSujetoCf × 0.13 (alícuota nominal)
 * - Línea Ventas = baseIvaSujetoCf − dfCfIva (≈ 87% del Importe Base)
 * - IT = importeTotal × 0.03 (Art. 74 Ley 843)
 * - Invariante: baseIvaSujetoCf + exentos = importeTotal
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
  itExpenseAccountCode: "5.3.3",
  itPayableAccountCode: "2.1.7",
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
    expect(lines[0]).toMatchObject({
      accountCode: "1.1.3",
      debit: 100,
      credit: 0,
      contactId,
    });
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
    expect(lines[0]).toMatchObject({
      accountCode: "1.1.3",
      debit: 100,
      credit: 0,
      contactId,
    });
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

  it("ivaBook = undefined produce el mismo resultado que no pasarlo", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1" },
    ];

    const withoutArg = buildSaleEntryLines(100, details, settings, contactId);
    const withUndefined = buildSaleEntryLines(100, details, settings, contactId, undefined);

    expect(withUndefined).toEqual(withoutArg);
  });
});

// ── describe: buildSaleEntryLines — con IvaBook (alícuota nominal SIN) ────────

describe("buildSaleEntryLines — con IvaBook activo y base IVA completa", () => {
  // Fixture A: total = base = 100 (sin exentos), IT = 100 × 0.03 = 3
  it("Fixture A — base=100, IVA=13, total=100: 5 líneas balanceadas (Ventas=87, IVA=13, IT=3)", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
    };

    const lines = buildSaleEntryLines(100, details, settings, contactId, ivaBook);

    // 3 base + 2 IT = 5 líneas
    expect(lines).toHaveLength(5);

    // DR CxC por el total
    expect(lines[0]).toMatchObject({
      accountCode: "1.1.3",
      debit: 100,
      credit: 0,
      contactId,
    });

    // CR Ventas (ingreso neto = base − IVA = 87)
    expect(lines[1]).toMatchObject({
      accountCode: "4.1.1",
      debit: 0,
      credit: 87,
    });

    // CR IVA Débito Fiscal
    expect(lines[2]).toMatchObject({
      accountCode: IVA_DEBITO_FISCAL,
      debit: 0,
      credit: 13,
    });

    // DR IT Gasto (100 × 0.03 = 3)
    expect(lines[3]).toMatchObject({
      accountCode: "5.3.3",
      debit: 3,
      credit: 0,
    });

    // CR IT por Pagar
    expect(lines[4]).toMatchObject({
      accountCode: "2.1.7",
      debit: 0,
      credit: 3,
    });

    // balance invariant
    const totalDebits = lines.reduce((s, l) => s + l.debit, 0);
    const totalCredits = lines.reduce((s, l) => s + l.credit, 0);
    expect(totalDebits).toBe(totalCredits);
  });

  // Fixture B: 3 detalles colapsan a 1 línea CR ingreso
  it("Fixture B — 3 detalles con IvaBook: colapsa a Ventas+IVA+IT; usa cuenta del primer detalle", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 50, incomeAccountCode: "4.1.1", description: "Detalle 1" },
      { lineAmount: 30, incomeAccountCode: "4.1.2", description: "Detalle 2" },
      { lineAmount: 20, incomeAccountCode: "4.1.3", description: "Detalle 3" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
    };

    const lines = buildSaleEntryLines(100, details, settings, contactId, ivaBook);

    expect(lines).toHaveLength(5);
    expect(lines[0]).toMatchObject({ accountCode: "1.1.3", debit: 100, credit: 0 });
    expect(lines[1]).toMatchObject({ accountCode: "4.1.1", credit: 87 });
    expect(lines[2]).toMatchObject({ accountCode: IVA_DEBITO_FISCAL, credit: 13 });
    expect(lines[3]).toMatchObject({ accountCode: "5.3.3", debit: 3 });
    expect(lines[4]).toMatchObject({ accountCode: "2.1.7", credit: 3 });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture D: exento residual → 4ta línea
  it("Fixture D — exento residual: base=100, IVA=13, total=150, exentos=50 → 6 líneas balanceadas", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 150, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 150,
    };

    const lines = buildSaleEntryLines(150, details, settings, contactId, ivaBook);

    // 4 base + 2 IT = 6 líneas
    expect(lines).toHaveLength(6);

    expect(lines[0]).toMatchObject({ accountCode: "1.1.3", debit: 150, credit: 0 });
    expect(lines[1]).toMatchObject({ accountCode: "4.1.1", credit: 87 });
    expect(lines[2]).toMatchObject({ accountCode: IVA_DEBITO_FISCAL, credit: 13 });
    // exento residual = total − base = 150 − 100 = 50
    expect(lines[3]).toMatchObject({ accountCode: "4.1.1", credit: 50 });
    // IT = 150 × 0.03 = 4.50
    expect(lines[4]).toMatchObject({ accountCode: "5.3.3", debit: 4.5 });
    expect(lines[5]).toMatchObject({ accountCode: "2.1.7", credit: 4.5 });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture E: rounding edge — debe balancear sin throw
  it("Fixture E — edge de redondeo: base=100.01, IVA=13.00, total=100.01 → balanceado", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 100.01, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100.01,
      dfCfIva: 13,
      importeTotal: 100.01,
    };

    expect(() =>
      buildSaleEntryLines(100.01, details, settings, contactId, ivaBook),
    ).not.toThrow();

    const lines = buildSaleEntryLines(100.01, details, settings, contactId, ivaBook);
    expect(lines).toHaveLength(5);
    // Ingreso = 100.01 − 13.00 = 87.01
    expect(lines[1]).toMatchObject({ accountCode: "4.1.1", credit: 87.01 });
    // IT = 100.01 × 0.03 = 3.0003 → 3.00
    expect(lines[3]).toMatchObject({ accountCode: "5.3.3", debit: 3 });
    expect(lines[4]).toMatchObject({ accountCode: "2.1.7", credit: 3 });
    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(Math.abs(dr - cr)).toBeLessThan(0.01);
  });
});

// ── describe: buildSaleEntryLines — venta exenta (dfCfIva = 0) ────────────────

describe("buildSaleEntryLines — venta exenta con IvaBook (dfCfIva = 0)", () => {
  it("Fixture C — dfCfIva=0: no genera línea 2.1.6 ni IT, cae a path no-IVA", () => {
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

    const ivaLine = lines.find((l) => l.accountCode === IVA_DEBITO_FISCAL);
    expect(ivaLine).toBeUndefined();

    // Falls back to N-detail path: 1 DR + 2 CR
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ accountCode: "1.1.3", debit: 100 });
  });
});

// ── describe: buildSaleEntryLines — invariante de balance ─────────────────────

describe("buildSaleEntryLines — invariante de balance", () => {
  it("lanza error cuando base + exentos ≠ importeTotal (residual > 0.005)", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 120, incomeAccountCode: "4.1.1" },
    ];
    const badIvaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      exentos: 5,
      importeTotal: 120, // 100 + 5 = 105 ≠ 120 → MUST throw
    };

    expect(() =>
      buildSaleEntryLines(120, details, settings, contactId, badIvaBook),
    ).toThrow();
  });
});

// ── describe: buildSaleEntryLines — IT 3% inline ──────────────────────────────

describe("buildSaleEntryLines — IT 3% inline", () => {
  it("sin IVA no genera líneas IT", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1" },
    ];

    const lines = buildSaleEntryLines(100, details, settings, contactId);

    const itLines = lines.filter(
      (l) => l.accountCode === "5.3.3" || l.accountCode === "2.1.7",
    );
    expect(itLines).toHaveLength(0);
  });

  it("dfCfIva=0 (exenta) no genera líneas IT", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 0,
      importeTotal: 100,
    };

    const lines = buildSaleEntryLines(100, details, settings, contactId, ivaBook);

    const itLines = lines.filter(
      (l) => l.accountCode === "5.3.3" || l.accountCode === "2.1.7",
    );
    expect(itLines).toHaveLength(0);
  });

  it("IT se calcula como importeTotal × 0.03 redondeado a 2 decimales", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
    };

    const lines = buildSaleEntryLines(100, details, settings, contactId, ivaBook);

    // IT = 100 × 0.03 = 3.00
    const itDebit = lines.find((l) => l.accountCode === "5.3.3");
    const itCredit = lines.find((l) => l.accountCode === "2.1.7");
    expect(itDebit?.debit).toBe(3);
    expect(itCredit?.credit).toBe(3);
  });

  it("IT con redondeo HALF_UP: total=88.55 → 88.55 × 0.03 = 2.6565 → 2.66", () => {
    const details: SaleDetailForEntry[] = [
      { lineAmount: 88.55, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 88.55,
      dfCfIva: 11.51,
      importeTotal: 88.55,
    };

    const lines = buildSaleEntryLines(88.55, details, settings, contactId, ivaBook);

    const itDebit = lines.find((l) => l.accountCode === "5.3.3");
    const itCredit = lines.find((l) => l.accountCode === "2.1.7");
    expect(itDebit?.debit).toBe(2.66);
    expect(itCredit?.credit).toBe(2.66);
  });

  it("IT usa cuentas configurables de settings", () => {
    const customSettings: SaleOrgSettings = {
      cxcAccountCode: "1.1.3",
      itExpenseAccountCode: "6.1.1",
      itPayableAccountCode: "2.2.9",
    };
    const details: SaleDetailForEntry[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
    };

    const lines = buildSaleEntryLines(100, details, customSettings, contactId, ivaBook);

    const itDebit = lines.find((l) => l.accountCode === "6.1.1");
    const itCredit = lines.find((l) => l.accountCode === "2.2.9");
    expect(itDebit).toBeDefined();
    expect(itCredit).toBeDefined();
    expect(itDebit?.debit).toBe(3);
    expect(itCredit?.credit).toBe(3);
  });
});
