/**
 * Tests del builder de asientos contables de Compras.
 *
 * PR1 — Task 1.2 (RED): Baseline de regresión para buildPurchaseEntryLines
 * sin IvaBook — bloquea el comportamiento actual para todos los 4 tipos.
 */

import { describe, it, expect } from "vitest";
import {
  buildPurchaseEntryLines,
  type PurchaseDetailForEntry,
  type PurchaseOrgSettings,
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
