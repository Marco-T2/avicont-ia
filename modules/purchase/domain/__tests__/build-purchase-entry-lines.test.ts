import { describe, expect, it } from "vitest";
import {
  IVA_CREDITO_FISCAL,
  buildPurchaseEntryLines,
  type IvaBookForEntry,
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

  it("delegates to non-IVA path when ivaBook.dfCfIva === 0", () => {
    const ivaZero: IvaBookForEntry = {
      baseIvaSujetoCf: 0,
      dfCfIva: 0,
      importeTotal: 100,
    };
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 100, description: "L1" },
    ];

    const lines = buildPurchaseEntryLines(
      "FLETE",
      100,
      details,
      SETTINGS,
      CONTACT,
      ivaZero,
    );

    expect(lines).toHaveLength(2);
    expect(lines[0]!.accountCode).toBe(SETTINGS.fleteExpenseAccountCode);
  });
});

describe("buildPurchaseEntryLines — con IVA (Bolivia SIN)", () => {
  it("FLETE: emits 3 lines (debit gastoNeto + debit IVA + credit cxp) sin exentos", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 1000,
      dfCfIva: 130,
      importeTotal: 1000,
    };
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 1000, description: "Flete" },
    ];

    const lines = buildPurchaseEntryLines(
      "FLETE",
      1000,
      details,
      SETTINGS,
      CONTACT,
      ivaBook,
    );

    expect(lines).toHaveLength(3);
    // DEBIT gastoNeto = base − IVA = 1000 − 130 = 870
    expect(lines[0]).toEqual({ accountCode: "5.1.4", debit: 870, credit: 0 });
    // DEBIT IVA Crédito Fiscal
    expect(lines[1]).toEqual({ accountCode: IVA_CREDITO_FISCAL, debit: 130, credit: 0 });
    // CREDIT CxP por importeTotal con contactId
    expect(lines[2]).toEqual({ accountCode: "2.1.1", debit: 0, credit: 1000, contactId: CONTACT });
  });

  it("POLLO_FAENADO: usa polloFaenadoCOGS como cuenta de gasto base", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 1000,
      dfCfIva: 130,
      importeTotal: 1000,
    };
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 1000, description: "Faena" },
    ];

    const lines = buildPurchaseEntryLines(
      "POLLO_FAENADO",
      1000,
      details,
      SETTINGS,
      CONTACT,
      ivaBook,
    );

    expect(lines[0]!.accountCode).toBe("5.1.1");
  });

  it("COMPRA_GENERAL: usa expenseAccountCode del primer detalle (collapse multi-detalle)", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 1000,
      dfCfIva: 130,
      importeTotal: 1000,
    };
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 600, expenseAccountCode: "5.1.10" },
      { lineAmount: 400, expenseAccountCode: "5.1.11" },
    ];

    const lines = buildPurchaseEntryLines(
      "COMPRA_GENERAL",
      1000,
      details,
      SETTINGS,
      CONTACT,
      ivaBook,
    );

    expect(lines[0]!.accountCode).toBe("5.1.10");
  });

  it("emite línea adicional de exentos cuando residuo > 0 (auto-computado)", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 800,
      dfCfIva: 104,
      importeTotal: 1000,
    };
    const details: PurchaseDetailForEntry[] = [
      { lineAmount: 1000, description: "L1" },
    ];

    const lines = buildPurchaseEntryLines(
      "FLETE",
      1000,
      details,
      SETTINGS,
      CONTACT,
      ivaBook,
    );

    expect(lines).toHaveLength(4);
    // gastoNeto = 800 − 104 = 696
    expect(lines[0]!.debit).toBe(696);
    // IVA = 104
    expect(lines[1]!.debit).toBe(104);
    // exento residual = 1000 − 800 = 200
    expect(lines[2]).toEqual({ accountCode: "5.1.4", debit: 200, credit: 0 });
    expect(lines[3]!.credit).toBe(1000);
  });

  it("acepta exentos explícito que cumple invariante de balance", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 800,
      dfCfIva: 104,
      importeTotal: 1000,
      exentos: 200,
    };
    const details: PurchaseDetailForEntry[] = [{ lineAmount: 1000 }];

    const lines = buildPurchaseEntryLines(
      "FLETE",
      1000,
      details,
      SETTINGS,
      CONTACT,
      ivaBook,
    );

    expect(lines).toHaveLength(4);
    expect(lines[2]!.debit).toBe(200);
  });

  it("rechaza exentos explícito que viola invariante balance > 0.005", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 800,
      dfCfIva: 104,
      importeTotal: 1000,
      exentos: 150, // 800 + 150 = 950 ≠ 1000, residual 50
    };
    const details: PurchaseDetailForEntry[] = [{ lineAmount: 1000 }];

    expect(() =>
      buildPurchaseEntryLines("FLETE", 1000, details, SETTINGS, CONTACT, ivaBook),
    ).toThrow(/balance violado/);
  });

  it("omite línea de exentos cuando exentos === 0", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 1000,
      dfCfIva: 130,
      importeTotal: 1000,
      exentos: 0,
    };
    const details: PurchaseDetailForEntry[] = [{ lineAmount: 1000 }];

    const lines = buildPurchaseEntryLines(
      "FLETE",
      1000,
      details,
      SETTINGS,
      CONTACT,
      ivaBook,
    );

    expect(lines).toHaveLength(3);
  });
});
