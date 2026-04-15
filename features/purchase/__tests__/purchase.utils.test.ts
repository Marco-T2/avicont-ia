/**
 * Tests del builder de asientos contables de Compras.
 *
 * PR1 — Task 1.2 (RED): Baseline de regresión para buildPurchaseEntryLines
 * sin IvaBook — bloquea el comportamiento actual para todos los 4 tipos.
 *
 * PR3 — Tasks 3.1 / 3.2 (RED): IVA-aware path para los 4 tipos de compra,
 * collapse multi-detalle, exento residual e invariante de balance.
 */

import { describe, it, expect } from "vitest";
import {
  buildPurchaseEntryLines,
  IVA_CREDITO_FISCAL,
  type PurchaseDetailForEntry,
  type PurchaseOrgSettings,
  type IvaBookForEntry,
} from "../purchase.utils";

// ── Fixtures compartidos ──────────────────────────────────────────────────────

const settings: PurchaseOrgSettings = {
  cxpAccountCode: "2.1.1",
  fleteExpenseAccountCode: "5.2.1",
  polloFaenadoCOGSAccountCode: "5.1.1",
};

const contactId = "contact-test-001";

// ── describe: buildPurchaseEntryLines — non-IVA path (regression baseline) ───

describe("buildPurchaseEntryLines — non-IVA path (regression baseline)", () => {
  describe("FLETE", () => {
    it("devuelve 1 línea DR flete + 1 línea CR CxP (total 2 líneas)", () => {
      const details: PurchaseDetailForEntry[] = [
        { lineAmount: 500, description: "Flete Bolivia" },
      ];

      const lines = buildPurchaseEntryLines("FLETE", 500, details, settings, contactId);

      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({
        accountCode: "5.2.1",
        debit: 500,
        credit: 0,
      });
      expect(lines[1]).toMatchObject({
        accountCode: "2.1.1",
        debit: 0,
        credit: 500,
        contactId,
      });
    });

    it("asiento FLETE está balanceado", () => {
      const lines = buildPurchaseEntryLines(
        "FLETE",
        700,
        [{ lineAmount: 700 }],
        settings,
        contactId,
      );
      const totalDebits = lines.reduce((s, l) => s + l.debit, 0);
      const totalCredits = lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebits).toBe(totalCredits);
    });
  });

  describe("POLLO_FAENADO", () => {
    it("devuelve 1 línea DR COGS pollo + 1 línea CR CxP (total 2 líneas)", () => {
      const details: PurchaseDetailForEntry[] = [
        { lineAmount: 2000, description: "Pollo faenado batch 1" },
      ];

      const lines = buildPurchaseEntryLines(
        "POLLO_FAENADO",
        2000,
        details,
        settings,
        contactId,
      );

      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({
        accountCode: "5.1.1",
        debit: 2000,
        credit: 0,
      });
      expect(lines[1]).toMatchObject({
        accountCode: "2.1.1",
        debit: 0,
        credit: 2000,
        contactId,
      });
    });
  });

  describe("COMPRA_GENERAL", () => {
    it("con 1 detalle: devuelve 1 línea DR gasto + 1 línea CR CxP (total 2 líneas)", () => {
      const details: PurchaseDetailForEntry[] = [
        { lineAmount: 300, expenseAccountCode: "5.3.1", description: "Insumos" },
      ];

      const lines = buildPurchaseEntryLines(
        "COMPRA_GENERAL",
        300,
        details,
        settings,
        contactId,
      );

      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({
        accountCode: "5.3.1",
        debit: 300,
        credit: 0,
      });
      expect(lines[1]).toMatchObject({
        accountCode: "2.1.1",
        debit: 0,
        credit: 300,
        contactId,
      });
    });

    it("con 3 detalles: devuelve 3 líneas DR gasto + 1 línea CR CxP (total 4 líneas)", () => {
      const details: PurchaseDetailForEntry[] = [
        { lineAmount: 100, expenseAccountCode: "5.3.1" },
        { lineAmount: 80, expenseAccountCode: "5.3.2" },
        { lineAmount: 70, expenseAccountCode: "5.3.3" },
      ];

      const lines = buildPurchaseEntryLines(
        "COMPRA_GENERAL",
        250,
        details,
        settings,
        contactId,
      );

      expect(lines).toHaveLength(4);
      expect(lines[0]).toMatchObject({ accountCode: "5.3.1", debit: 100, credit: 0 });
      expect(lines[1]).toMatchObject({ accountCode: "5.3.2", debit: 80, credit: 0 });
      expect(lines[2]).toMatchObject({ accountCode: "5.3.3", debit: 70, credit: 0 });
      expect(lines[3]).toMatchObject({ accountCode: "2.1.1", debit: 0, credit: 250, contactId });
    });
  });

  describe("SERVICIO", () => {
    it("con 1 detalle: devuelve 1 línea DR gasto servicio + 1 línea CR CxP (total 2 líneas)", () => {
      const details: PurchaseDetailForEntry[] = [
        { lineAmount: 150, expenseAccountCode: "5.4.1", description: "Servicio contable" },
      ];

      const lines = buildPurchaseEntryLines(
        "SERVICIO",
        150,
        details,
        settings,
        contactId,
      );

      expect(lines).toHaveLength(2);
      expect(lines[0]).toMatchObject({
        accountCode: "5.4.1",
        debit: 150,
        credit: 0,
      });
      expect(lines[1]).toMatchObject({
        accountCode: "2.1.1",
        debit: 0,
        credit: 150,
        contactId,
      });
    });
  });

  it("ivaBook = undefined produce el mismo resultado que no pasarlo (SPEC-3 doble cobertura)", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 500, expenseAccountCode: "5.3.1" },
    ];

    const withoutArg = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      500,
      details,
      settings,
      contactId,
    );
    const withUndefined = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      500,
      details,
      settings,
      contactId,
      undefined,
    );

    expect(withUndefined).toEqual(withoutArg);
  });
});

// ── describe: buildPurchaseEntryLines — con IvaBook activo (PR3) ──────────────

describe("buildPurchaseEntryLines — con IvaBook activo (SPEC-2, SPEC-8)", () => {
  // Fixture A: COMPRA_GENERAL — base 100% del total, 3 líneas
  it("Fixture A — COMPRA_GENERAL: base 100, IVA 13, total 113 → 3 líneas balanceadas", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 113, expenseAccountCode: "5.3.1", description: "Insumos" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 113,
    };

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      113,
      details,
      settings,
      contactId,
      ivaBook,
    );

    expect(lines).toHaveLength(3);

    // DR Gasto (base gravable)
    expect(lines[0]).toMatchObject({
      accountCode: "5.3.1",
      debit: 100,
      credit: 0,
    });

    // DR IVA Crédito Fiscal
    expect(lines[1]).toMatchObject({
      accountCode: IVA_CREDITO_FISCAL,
      debit: 13,
      credit: 0,
    });

    // CR CxP (total)
    expect(lines[2]).toMatchObject({
      accountCode: "2.1.1",
      debit: 0,
      credit: 113,
      contactId,
    });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture B: FLETE — usa fleteExpenseAccountCode
  it("Fixture B — FLETE: base 100, IVA 13, total 113 → DR flete + DR 1.1.8 + CR CxP", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 113, description: "Flete Bolivia" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 113,
    };

    const lines = buildPurchaseEntryLines(
      "FLETE",
      113,
      details,
      settings,
      contactId,
      ivaBook,
    );

    expect(lines).toHaveLength(3);

    expect(lines[0]).toMatchObject({
      accountCode: "5.2.1", // fleteExpenseAccountCode
      debit: 100,
      credit: 0,
    });
    expect(lines[1]).toMatchObject({
      accountCode: IVA_CREDITO_FISCAL,
      debit: 13,
      credit: 0,
    });
    expect(lines[2]).toMatchObject({
      accountCode: "2.1.1",
      debit: 0,
      credit: 113,
      contactId,
    });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture C: POLLO_FAENADO — usa polloFaenadoCOGSAccountCode
  it("Fixture C — POLLO_FAENADO: base 100, IVA 13, total 113 → DR COGS + DR 1.1.8 + CR CxP", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 113, description: "Pollo faenado" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 113,
    };

    const lines = buildPurchaseEntryLines(
      "POLLO_FAENADO",
      113,
      details,
      settings,
      contactId,
      ivaBook,
    );

    expect(lines).toHaveLength(3);

    expect(lines[0]).toMatchObject({
      accountCode: "5.1.1", // polloFaenadoCOGSAccountCode
      debit: 100,
      credit: 0,
    });
    expect(lines[1]).toMatchObject({
      accountCode: IVA_CREDITO_FISCAL,
      debit: 13,
      credit: 0,
    });
    expect(lines[2]).toMatchObject({
      accountCode: "2.1.1",
      debit: 0,
      credit: 113,
      contactId,
    });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture D: SERVICIO — usa expenseAccountCode del detalle
  it("Fixture D — SERVICIO: base 100, IVA 13, total 113 → DR servicio + DR 1.1.8 + CR CxP", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 113, expenseAccountCode: "5.4.1", description: "Servicio contable" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 113,
    };

    const lines = buildPurchaseEntryLines(
      "SERVICIO",
      113,
      details,
      settings,
      contactId,
      ivaBook,
    );

    expect(lines).toHaveLength(3);

    expect(lines[0]).toMatchObject({
      accountCode: "5.4.1",
      debit: 100,
      credit: 0,
    });
    expect(lines[1]).toMatchObject({
      accountCode: IVA_CREDITO_FISCAL,
      debit: 13,
      credit: 0,
    });
    expect(lines[2]).toMatchObject({
      accountCode: "2.1.1",
      debit: 0,
      credit: 113,
      contactId,
    });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture E: collapse multi-detalle → 1 línea DR gasto (SPEC-8)
  it("Fixture E — COMPRA_GENERAL multi-detalle con IvaBook: colapsa a 3 líneas (no N+1); cuenta del primer detalle", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 50, expenseAccountCode: "5.3.1", description: "Insumo A" },
      { lineAmount: 40, expenseAccountCode: "5.3.2", description: "Insumo B" },
      { lineAmount: 23, expenseAccountCode: "5.3.3", description: "Insumo C" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 113,
    };

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      113,
      details,
      settings,
      contactId,
      ivaBook,
    );

    // SPEC-8: collapse a exactamente 3 líneas (no 5)
    expect(lines).toHaveLength(3);

    // DR Gasto — usa cuenta del primer detalle
    expect(lines[0]).toMatchObject({ accountCode: "5.3.1", debit: 100 });

    // DR IVA Crédito Fiscal
    expect(lines[1]).toMatchObject({ accountCode: IVA_CREDITO_FISCAL, debit: 13 });

    // CR CxP
    expect(lines[2]).toMatchObject({ accountCode: "2.1.1", credit: 113 });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture F: exento residual → 4ta línea DR gasto
  it("Fixture F — exento residual: base 80, IVA 10.40, exentos 39.60, total 130 → 4 líneas balanceadas", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 130, expenseAccountCode: "5.3.1", description: "Compra mixta" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 80,
      dfCfIva: 10.4,
      importeTotal: 130,
      // exentos no pasados → auto-compute: 130 - 80 - 10.40 = 39.60
    };

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      130,
      details,
      settings,
      contactId,
      ivaBook,
    );

    expect(lines).toHaveLength(4);

    expect(lines[0]).toMatchObject({ accountCode: "5.3.1", debit: 80, credit: 0 });
    expect(lines[1]).toMatchObject({ accountCode: IVA_CREDITO_FISCAL, debit: 10.4, credit: 0 });
    expect(lines[2]).toMatchObject({ accountCode: "5.3.1", debit: expect.closeTo(39.6, 2), credit: 0 });
    expect(lines[3]).toMatchObject({ accountCode: "2.1.1", debit: 0, credit: 130, contactId });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(Math.abs(dr - cr)).toBeLessThan(0.01);
  });

  // Fixture G: sin ivaBook → comportamiento sin cambio (SPEC-3)
  it("Fixture G — sin ivaBook: retorna N líneas DR gasto + 1 CR CxP (cero regresión, SPEC-3)", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 200, expenseAccountCode: "5.3.1" },
    ];

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      200,
      details,
      settings,
      contactId,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ accountCode: "5.3.1", debit: 200 });
    expect(lines[1]).toMatchObject({ accountCode: "2.1.1", credit: 200 });
  });
});

// ── describe: buildPurchaseEntryLines — compra exenta (dfCfIva = 0) ───────────

describe("buildPurchaseEntryLines — compra exenta con IvaBook (dfCfIva = 0)", () => {
  const ivaBookExenta: IvaBookForEntry = {
    baseIvaSujetoCf: 500,
    dfCfIva: 0,
    importeTotal: 500,
  };

  it("COMPRA_GENERAL — dfCfIva=0: cae al path no-IVA, sin línea 1.1.8", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 300, expenseAccountCode: "5.3.1" },
      { lineAmount: 200, expenseAccountCode: "5.3.2" },
    ];

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      500,
      details,
      settings,
      contactId,
      ivaBookExenta,
    );

    const ivaLine = lines.find((l) => l.accountCode === IVA_CREDITO_FISCAL);
    expect(ivaLine).toBeUndefined();

    // Cae al path N-detalle: 2 DR + 1 CR
    expect(lines).toHaveLength(3);
  });

  it("FLETE — dfCfIva=0: cae al path no-IVA, sin línea 1.1.8", () => {
    const lines = buildPurchaseEntryLines(
      "FLETE",
      500,
      [{ lineAmount: 500 }],
      settings,
      contactId,
      ivaBookExenta,
    );

    const ivaLine = lines.find((l) => l.accountCode === IVA_CREDITO_FISCAL);
    expect(ivaLine).toBeUndefined();
    expect(lines).toHaveLength(2);
  });

  it("POLLO_FAENADO — dfCfIva=0: cae al path no-IVA, sin línea 1.1.8", () => {
    const lines = buildPurchaseEntryLines(
      "POLLO_FAENADO",
      500,
      [{ lineAmount: 500 }],
      settings,
      contactId,
      ivaBookExenta,
    );

    const ivaLine = lines.find((l) => l.accountCode === IVA_CREDITO_FISCAL);
    expect(ivaLine).toBeUndefined();
    expect(lines).toHaveLength(2);
  });

  it("SERVICIO — dfCfIva=0: cae al path no-IVA, sin línea 1.1.8", () => {
    const lines = buildPurchaseEntryLines(
      "SERVICIO",
      500,
      [{ lineAmount: 500, expenseAccountCode: "5.4.1" }],
      settings,
      contactId,
      ivaBookExenta,
    );

    const ivaLine = lines.find((l) => l.accountCode === IVA_CREDITO_FISCAL);
    expect(ivaLine).toBeUndefined();
    expect(lines).toHaveLength(2);
  });
});

// ── describe: buildPurchaseEntryLines — invariante de balance ────────────────

describe("buildPurchaseEntryLines — invariante de balance", () => {
  it("lanza error descriptivo cuando base + IVA + exentos explícitos ≠ importeTotal", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 120, expenseAccountCode: "5.3.1" },
    ];
    const badIvaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      exentos: 5, // explícito
      importeTotal: 120, // 100 + 13 + 5 = 118 ≠ 120 → DEBE lanzar
    };

    expect(() =>
      buildPurchaseEntryLines(
        "COMPRA_GENERAL",
        120,
        details,
        settings,
        contactId,
        badIvaBook,
      )
    ).toThrow();
  });

  it("auto-computa exentos residuales cuando exentos no es explícito (no lanza)", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 150, expenseAccountCode: "5.3.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 150, // residual = 37, auto-compute
    };

    expect(() =>
      buildPurchaseEntryLines(
        "COMPRA_GENERAL",
        150,
        details,
        settings,
        contactId,
        ivaBook,
      )
    ).not.toThrow();
  });
});
