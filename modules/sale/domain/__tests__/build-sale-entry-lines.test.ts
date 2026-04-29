import { describe, expect, it } from "vitest";
import {
  IVA_DEBITO_FISCAL,
  buildSaleEntryLines,
  type IvaBookForEntry,
  type SaleEntryDetail,
  type SaleEntrySettings,
} from "../build-sale-entry-lines";

const SETTINGS: SaleEntrySettings = {
  cxcAccountCode: "1.1.4.1",
  itExpenseAccountCode: "5.3.3",
  itPayableAccountCode: "2.1.7",
};

const CONTACT = "contact-1";

describe("buildSaleEntryLines — sin IVA", () => {
  it("emits debit CxC + 1 credit por línea de detalle", () => {
    const details: SaleEntryDetail[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1", description: "Línea 1" },
    ];

    const lines = buildSaleEntryLines(100, details, SETTINGS, CONTACT);

    expect(lines).toEqual([
      { accountCode: "1.1.4.1", debit: 100, credit: 0, contactId: CONTACT },
      {
        accountCode: "4.1.1",
        debit: 0,
        credit: 100,
        description: "Línea 1",
      },
    ]);
  });

  it("emits 1 debit + N credits cuando hay múltiples detalles", () => {
    const details: SaleEntryDetail[] = [
      { lineAmount: 60, incomeAccountCode: "4.1.1", description: "A" },
      { lineAmount: 40, incomeAccountCode: "4.1.2", description: "B" },
    ];

    const lines = buildSaleEntryLines(100, details, SETTINGS, CONTACT);

    expect(lines).toHaveLength(3);
    expect(lines[0]!.debit).toBe(100);
    expect(lines[1]!.credit).toBe(60);
    expect(lines[2]!.credit).toBe(40);
  });

  it("delegates to non-IVA path when ivaBook.dfCfIva === 0", () => {
    const ivaZero: IvaBookForEntry = {
      baseIvaSujetoCf: 0,
      dfCfIva: 0,
      importeTotal: 100,
    };
    const details: SaleEntryDetail[] = [
      { lineAmount: 100, incomeAccountCode: "4.1.1" },
    ];

    const lines = buildSaleEntryLines(100, details, SETTINGS, CONTACT, ivaZero);

    expect(lines).toHaveLength(2);
    expect(lines[0]!.accountCode).toBe(SETTINGS.cxcAccountCode);
  });
});

describe("buildSaleEntryLines — con IVA", () => {
  const detailsIva: SaleEntryDetail[] = [
    { lineAmount: 1000, incomeAccountCode: "4.1.1" },
  ];

  it("emits 5 lines (debit CxC + credit ingreso neto + credit IVA + debit IT + credit IT) sin exentos", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 1000,
      dfCfIva: 130,
      importeTotal: 1000,
    };

    const lines = buildSaleEntryLines(1000, detailsIva, SETTINGS, CONTACT, ivaBook);

    expect(lines).toHaveLength(5);
    expect(lines[0]).toEqual({
      accountCode: SETTINGS.cxcAccountCode,
      debit: 1000,
      credit: 0,
      contactId: CONTACT,
    });
    expect(lines[1]).toEqual({
      accountCode: "4.1.1",
      debit: 0,
      credit: 870,
    });
    expect(lines[2]).toEqual({
      accountCode: IVA_DEBITO_FISCAL,
      debit: 0,
      credit: 130,
    });
    expect(lines[3]).toEqual({
      accountCode: SETTINGS.itExpenseAccountCode,
      debit: 30,
      credit: 0,
    });
    expect(lines[4]).toEqual({
      accountCode: SETTINGS.itPayableAccountCode,
      debit: 0,
      credit: 30,
    });
  });

  it("inserts a credit exentos line when exentos > 0", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 800,
      dfCfIva: 104,
      importeTotal: 1000,
      exentos: 200,
    };

    const lines = buildSaleEntryLines(1000, detailsIva, SETTINGS, CONTACT, ivaBook);

    expect(lines).toHaveLength(6);
    const exentosLine = lines.find(
      (l) => l.accountCode === "4.1.1" && l.credit === 200,
    );
    expect(exentosLine).toBeDefined();
  });

  it("throws balance error when exentos explicit + base !== importeTotal beyond tolerance", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 800,
      dfCfIva: 104,
      importeTotal: 1100,
      exentos: 200,
    };

    expect(() =>
      buildSaleEntryLines(1100, detailsIva, SETTINGS, CONTACT, ivaBook),
    ).toThrow(/Invariante de balance violado/);
  });

  it("computes ingresoNeto with rounding (base − dfCfIva)", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 333.33,
      dfCfIva: 43.33,
      importeTotal: 333.33,
    };

    const lines = buildSaleEntryLines(333.33, detailsIva, SETTINGS, CONTACT, ivaBook);

    const incomeLine = lines.find((l) => l.accountCode === "4.1.1");
    expect(incomeLine?.credit).toBeCloseTo(290, 2);
  });

  it("computes IT amount as importeTotal × 3%", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 1000,
      dfCfIva: 130,
      importeTotal: 1000,
    };

    const lines = buildSaleEntryLines(1000, detailsIva, SETTINGS, CONTACT, ivaBook);

    const itDebit = lines.find((l) => l.accountCode === SETTINGS.itExpenseAccountCode);
    const itCredit = lines.find((l) => l.accountCode === SETTINGS.itPayableAccountCode);
    expect(itDebit?.debit).toBe(30);
    expect(itCredit?.credit).toBe(30);
  });

  it("uses primary detail accountCode as fallback `4.1.1` when details is empty", () => {
    const ivaBook: IvaBookForEntry = {
      baseIvaSujetoCf: 1000,
      dfCfIva: 130,
      importeTotal: 1000,
    };

    const lines = buildSaleEntryLines(1000, [], SETTINGS, CONTACT, ivaBook);

    const incomeLine = lines.find(
      (l) => l.credit === 870 && l.debit === 0,
    );
    expect(incomeLine?.accountCode).toBe("4.1.1");
  });
});
