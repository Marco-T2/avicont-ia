/**
 * Tests del builder de asientos contables de Compras.
 *
 * Convención SIN Bolivia (Form. 200):
 * - baseIvaSujetoCf = "Importe Base SIAT" (ya incluye IVA conceptualmente)
 * - dfCfIva = baseIvaSujetoCf × 0.13 (alícuota nominal)
 * - Línea Gasto = baseIvaSujetoCf − dfCfIva (≈ 87% del Importe Base)
 * - Invariante: baseIvaSujetoCf + exentos = importeTotal
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

  it("ivaBook = undefined produce el mismo resultado que no pasarlo", () => {
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

// ── describe: buildPurchaseEntryLines — con IvaBook activo ────────────────────

describe("buildPurchaseEntryLines — con IvaBook activo (alícuota nominal SIN)", () => {
  // Fixture A: COMPRA_GENERAL — base = total (sin exento), 3 líneas
  it("Fixture A — COMPRA_GENERAL: base=100, IVA=13, total=100 → 3 líneas (Gasto=87, IVA=13, CxP=100)", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 100, expenseAccountCode: "5.3.1", description: "Insumos" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
    };

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      100,
      details,
      settings,
      contactId,
      ivaBook,
    );

    expect(lines).toHaveLength(3);
    // DR Gasto neto = base − IVA = 87
    expect(lines[0]).toMatchObject({ accountCode: "5.3.1", debit: 87, credit: 0 });
    // DR IVA Crédito Fiscal
    expect(lines[1]).toMatchObject({ accountCode: IVA_CREDITO_FISCAL, debit: 13, credit: 0 });
    // CR CxP por el total
    expect(lines[2]).toMatchObject({ accountCode: "2.1.1", debit: 0, credit: 100, contactId });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(dr).toBe(cr);
  });

  // Fixture B: FLETE — usa fleteExpenseAccountCode
  it("Fixture B — FLETE: base=100, IVA=13, total=100 → DR flete + DR 1.1.8 + CR CxP", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 100, description: "Flete Bolivia" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
    };

    const lines = buildPurchaseEntryLines("FLETE", 100, details, settings, contactId, ivaBook);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ accountCode: "5.2.1", debit: 87, credit: 0 });
    expect(lines[1]).toMatchObject({ accountCode: IVA_CREDITO_FISCAL, debit: 13, credit: 0 });
    expect(lines[2]).toMatchObject({ accountCode: "2.1.1", debit: 0, credit: 100, contactId });
  });

  // Fixture C: POLLO_FAENADO — usa polloFaenadoCOGSAccountCode
  it("Fixture C — POLLO_FAENADO: base=100, IVA=13, total=100 → DR COGS + DR 1.1.8 + CR CxP", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 100, description: "Pollo faenado" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
    };

    const lines = buildPurchaseEntryLines(
      "POLLO_FAENADO",
      100,
      details,
      settings,
      contactId,
      ivaBook,
    );

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ accountCode: "5.1.1", debit: 87, credit: 0 });
    expect(lines[1]).toMatchObject({ accountCode: IVA_CREDITO_FISCAL, debit: 13, credit: 0 });
    expect(lines[2]).toMatchObject({ accountCode: "2.1.1", debit: 0, credit: 100, contactId });
  });

  // Fixture D: SERVICIO — usa expenseAccountCode del detalle
  it("Fixture D — SERVICIO: base=100, IVA=13, total=100 → DR servicio + DR 1.1.8 + CR CxP", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 100, expenseAccountCode: "5.4.1", description: "Servicio contable" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
    };

    const lines = buildPurchaseEntryLines("SERVICIO", 100, details, settings, contactId, ivaBook);

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ accountCode: "5.4.1", debit: 87, credit: 0 });
    expect(lines[1]).toMatchObject({ accountCode: IVA_CREDITO_FISCAL, debit: 13, credit: 0 });
    expect(lines[2]).toMatchObject({ accountCode: "2.1.1", debit: 0, credit: 100, contactId });
  });

  // Fixture E: collapse multi-detalle → 1 línea DR gasto
  it("Fixture E — COMPRA_GENERAL multi-detalle con IvaBook: colapsa a 3 líneas; cuenta del primer detalle", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 50, expenseAccountCode: "5.3.1", description: "Insumo A" },
      { lineAmount: 30, expenseAccountCode: "5.3.2", description: "Insumo B" },
      { lineAmount: 20, expenseAccountCode: "5.3.3", description: "Insumo C" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 100,
    };

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      100,
      details,
      settings,
      contactId,
      ivaBook,
    );

    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatchObject({ accountCode: "5.3.1", debit: 87 });
    expect(lines[1]).toMatchObject({ accountCode: IVA_CREDITO_FISCAL, debit: 13 });
    expect(lines[2]).toMatchObject({ accountCode: "2.1.1", credit: 100 });
  });

  // Fixture F: exento residual → 4ta línea DR gasto
  it("Fixture F — exento residual: base=100, IVA=13, total=150 → 4 líneas (Gasto=87, IVA=13, Exentos=50, CxP=150)", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 150, expenseAccountCode: "5.3.1", description: "Compra mixta" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 150,
      // exentos no pasados → auto-compute: 150 - 100 = 50
    };

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      150,
      details,
      settings,
      contactId,
      ivaBook,
    );

    expect(lines).toHaveLength(4);
    expect(lines[0]).toMatchObject({ accountCode: "5.3.1", debit: 87, credit: 0 });
    expect(lines[1]).toMatchObject({ accountCode: IVA_CREDITO_FISCAL, debit: 13, credit: 0 });
    expect(lines[2]).toMatchObject({ accountCode: "5.3.1", debit: 50, credit: 0 });
    expect(lines[3]).toMatchObject({ accountCode: "2.1.1", debit: 0, credit: 150, contactId });

    const dr = lines.reduce((s, l) => s + l.debit, 0);
    const cr = lines.reduce((s, l) => s + l.credit, 0);
    expect(Math.abs(dr - cr)).toBeLessThan(0.01);
  });

  // Fixture G: sin ivaBook → comportamiento sin cambio
  it("Fixture G — sin ivaBook: retorna N líneas DR gasto + 1 CR CxP (cero regresión)", () => {
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

// ── describe: buildPurchaseEntryLines — REQ-8: sin líneas IT ─────────────────
//
// FOLLOWUP-3: Positive assertion that purchases NEVER emit IT lines.
// IT account defaults come from OrgSettings (prisma/schema.prisma):
//   itExpenseAccountCode @default("5.3.3")
//   itPayableAccountCode @default("2.1.7")
// PurchaseOrgSettings does NOT include these fields — structural guarantee.
// These tests lock in that behavioral invariant explicitly.

const IT_EXPENSE_CODE = "5.3.3"; // OrgSettings.itExpenseAccountCode default
const IT_PAYABLE_CODE = "2.1.7"; // OrgSettings.itPayableAccountCode default

describe("buildPurchaseEntryLines — REQ-8: no genera líneas IT en compras", () => {
  // FOLLOWUP-3a: COMPRA_GENERAL con IVA crédito fiscal — nunca emite cuentas IT
  it("FOLLOWUP-3a — COMPRA_GENERAL con IvaBook activo: ninguna línea tiene cuentas IT", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 500, expenseAccountCode: "5.3.1", description: "Insumos con IVA" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 500,
      dfCfIva: 65,
      importeTotal: 500,
    };

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      500,
      details,
      settings,
      contactId,
      ivaBook,
    );

    const itLines = lines.filter(
      (l) => l.accountCode === IT_EXPENSE_CODE || l.accountCode === IT_PAYABLE_CODE,
    );
    expect(itLines).toHaveLength(0);
  });

  // FOLLOWUP-3b: COMPRA_GENERAL sin IVA (non-IVA path) — nunca emite cuentas IT
  it("FOLLOWUP-3b — COMPRA_GENERAL sin IvaBook (non-IVA): ninguna línea tiene cuentas IT", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 800, expenseAccountCode: "5.3.2", description: "Compra sin factura IVA" },
    ];

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      800,
      details,
      settings,
      contactId,
    );

    const itLines = lines.filter(
      (l) => l.accountCode === IT_EXPENSE_CODE || l.accountCode === IT_PAYABLE_CODE,
    );
    expect(itLines).toHaveLength(0);
  });
});

// ── describe: buildPurchaseEntryLines — invariante de balance ────────────────

describe("buildPurchaseEntryLines — invariante de balance", () => {
  it("lanza error cuando base + exentos explícitos ≠ importeTotal", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 120, expenseAccountCode: "5.3.1" },
    ];
    const badIvaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      exentos: 5, // explícito: 100 + 5 = 105 ≠ 120 → DEBE lanzar
      importeTotal: 120,
    };

    expect(() =>
      buildPurchaseEntryLines(
        "COMPRA_GENERAL",
        120,
        details,
        settings,
        contactId,
        badIvaBook,
      ),
    ).toThrow();
  });

  it("auto-computa exentos residuales cuando exentos no es explícito (no lanza)", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 150, expenseAccountCode: "5.3.1" },
    ];
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 100,
      dfCfIva: 13,
      importeTotal: 150, // residual auto = 50
    };

    expect(() =>
      buildPurchaseEntryLines(
        "COMPRA_GENERAL",
        150,
        details,
        settings,
        contactId,
        ivaBook,
      ),
    ).not.toThrow();
  });
});
