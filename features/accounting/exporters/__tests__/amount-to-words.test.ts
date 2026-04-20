import { describe, it, expect } from "vitest";
import { amountToWordsEs } from "@/features/accounting/exporters/amount-to-words";

// Literal de montos en español-Bolivia, formato contable:
//   "{LITERAL EN MAYUSCULAS} CC/100 BS"
// CC son los centavos con dos dígitos ("00", "01", ..., "99").
// BS = código de moneda boliviana.

describe("amountToWordsEs", () => {
  it("cero", () => {
    expect(amountToWordsEs(0)).toBe("CERO 00/100 BS");
  });

  it("un centavo", () => {
    expect(amountToWordsEs(0.01)).toBe("CERO 01/100 BS");
  });

  it("uno entero", () => {
    expect(amountToWordsEs(1)).toBe("UNO 00/100 BS");
  });

  it("veintiuno (una sola palabra)", () => {
    expect(amountToWordsEs(21)).toBe("VEINTIUNO 00/100 BS");
  });

  it("cien exacto", () => {
    expect(amountToWordsEs(100)).toBe("CIEN 00/100 BS");
  });

  it("ciento uno (CIENTO, no CIEN)", () => {
    expect(amountToWordsEs(101)).toBe("CIENTO UNO 00/100 BS");
  });

  it("novecientos noventa y nueve con 99 centavos", () => {
    expect(amountToWordsEs(999.99)).toBe("NOVECIENTOS NOVENTA Y NUEVE 99/100 BS");
  });

  it("tres mil setecientos sesenta (caso del requerimiento)", () => {
    expect(amountToWordsEs(3760)).toBe("TRES MIL SETECIENTOS SESENTA 00/100 BS");
  });

  it("un millón con 50 centavos", () => {
    expect(amountToWordsEs(1_000_000.5)).toBe("UN MILLON 50/100 BS");
  });

  it("dos millones (plural)", () => {
    expect(amountToWordsEs(2_000_000)).toBe("DOS MILLONES 00/100 BS");
  });

  it("acepta string con 2 decimales", () => {
    expect(amountToWordsEs("3760.00")).toBe("TRES MIL SETECIENTOS SESENTA 00/100 BS");
  });

  it("redondea 3er decimal 0.005 → centavos 01", () => {
    expect(amountToWordsEs(0.005)).toBe("CERO 01/100 BS");
  });
});
