import { describe, expect, it } from "vitest";
import {
  buildPurchaseEntryLines,
  type PurchaseDetailForEntry,
  type PurchaseOrgSettings,
} from "../build-purchase-entry-lines";

const SETTINGS: PurchaseOrgSettings = {
  cxpAccountCode: "2.1.1",
  fleteExpenseAccountCode: "5.1.4",
  polloFaenadoCOGSAccountCode: "5.1.1",
};

const CONTACT = "contact-1";

describe("buildPurchaseEntryLines — sin IVA", () => {
  it("FLETE: emits debit fleteExpense + credit cxp por totalAmount", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 800, description: "Flete L-100" },
    ];

    const lines = buildPurchaseEntryLines("FLETE", 800, details, SETTINGS, CONTACT);

    expect(lines).toEqual([
      { accountCode: "5.1.4", debit: 800, credit: 0 },
      { accountCode: "2.1.1", debit: 0, credit: 800, contactId: CONTACT },
    ]);
  });

  it("POLLO_FAENADO: emits debit polloFaenadoCOGS + credit cxp por totalAmount", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 1500, description: "Faena 100kg" },
    ];

    const lines = buildPurchaseEntryLines(
      "POLLO_FAENADO",
      1500,
      details,
      SETTINGS,
      CONTACT,
    );

    expect(lines).toEqual([
      { accountCode: "5.1.1", debit: 1500, credit: 0 },
      { accountCode: "2.1.1", debit: 0, credit: 1500, contactId: CONTACT },
    ]);
  });

  it("COMPRA_GENERAL: emits 1 debit por línea + 1 credit cxp", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 100, expenseAccountCode: "5.1.10", description: "A" },
      { lineAmount: 50, expenseAccountCode: "5.1.11", description: "B" },
    ];

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      150,
      details,
      SETTINGS,
      CONTACT,
    );

    expect(lines).toHaveLength(3);
    expect(lines[0]).toEqual({ accountCode: "5.1.10", debit: 100, credit: 0, description: "A" });
    expect(lines[1]).toEqual({ accountCode: "5.1.11", debit: 50, credit: 0, description: "B" });
    expect(lines[2]).toEqual({ accountCode: "2.1.1", debit: 0, credit: 150, contactId: CONTACT });
  });

  it("SERVICIO: emits 1 debit por línea + 1 credit cxp", () => {
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 200, expenseAccountCode: "5.1.20", description: "Servicio" },
    ];

    const lines = buildPurchaseEntryLines(
      "SERVICIO",
      200,
      details,
      SETTINGS,
      CONTACT,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]!.accountCode).toBe("5.1.20");
    expect(lines[1]!.accountCode).toBe("2.1.1");
  });
});
