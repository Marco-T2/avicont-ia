import { describe, expect, it } from "vitest";
import {
  buildSaleEntryLines,
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
});
