/**
 * Tests del builder de asientos contables de Ventas.
 *
 * PR1 — Tasks 1.1 (RED): Baseline de regresión para buildSaleEntryLines
 * sin IvaBook — bloquea el comportamiento actual antes de cualquier cambio.
 */

import { describe, it, expect } from "vitest";
import {
  buildSaleEntryLines,
  type SaleDetailForEntry,
  type SaleOrgSettings,
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
