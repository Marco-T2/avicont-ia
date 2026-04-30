import { describe, expect, it } from "vitest";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { IvaCalcResult } from "../value-objects/iva-calc-result";
import {
  calcBaseImponible,
  calcDebitoFiscal,
  calcIvaCreditoFiscal,
  calcSubtotal,
  computeIvaTotals,
} from "../compute-iva-totals";

const m = (n: number): MonetaryAmount => MonetaryAmount.of(n);
const zero = MonetaryAmount.zero();

describe("compute-iva-totals — calcSubtotal", () => {
  it("returns importeTotal cuando todas las deducciones son 0", () => {
    const result = calcSubtotal({
      importeTotal: m(1000),
      importeIce: zero,
      importeIehd: zero,
      importeIpj: zero,
      tasas: zero,
      otrosNoSujetos: zero,
      exentos: zero,
      tasaCero: zero,
    });
    expect(result.equals(m(1000))).toBe(true);
  });

  it("resta todas las 7 deducciones del importeTotal", () => {
    // 1000 - 50 - 30 - 20 - 10 - 15 - 25 - 5 = 845
    const result = calcSubtotal({
      importeTotal: m(1000),
      importeIce: m(50),
      importeIehd: m(30),
      importeIpj: m(20),
      tasas: m(10),
      otrosNoSujetos: m(15),
      exentos: m(25),
      tasaCero: m(5),
    });
    expect(result.equals(m(845))).toBe(true);
  });

  it("clampa a 0 cuando deducciones exceden importeTotal", () => {
    // 100 - 200 - 50 = -150 → 0
    const result = calcSubtotal({
      importeTotal: m(100),
      importeIce: m(200),
      importeIehd: m(50),
      importeIpj: zero,
      tasas: zero,
      otrosNoSujetos: zero,
      exentos: zero,
      tasaCero: zero,
    });
    expect(result.equals(zero)).toBe(true);
  });

  it("resta solo deducciones presentes (parciales)", () => {
    // 500 - 50 - 25 = 425 (solo ICE + tasas, resto = 0)
    const result = calcSubtotal({
      importeTotal: m(500),
      importeIce: m(50),
      importeIehd: zero,
      importeIpj: zero,
      tasas: m(25),
      otrosNoSujetos: zero,
      exentos: zero,
      tasaCero: zero,
    });
    expect(result.equals(m(425))).toBe(true);
  });

  it("retorna 0 cuando importeTotal y todas las deducciones son 0", () => {
    const result = calcSubtotal({
      importeTotal: zero,
      importeIce: zero,
      importeIehd: zero,
      importeIpj: zero,
      tasas: zero,
      otrosNoSujetos: zero,
      exentos: zero,
      tasaCero: zero,
    });
    expect(result.equals(zero)).toBe(true);
  });
});

describe("compute-iva-totals — calcBaseImponible", () => {
  it("retorna subtotal − descuento cuando descuento < subtotal", () => {
    expect(calcBaseImponible(m(1000), m(100)).equals(m(900))).toBe(true);
  });

  it("clampa a 0 cuando descuento excede subtotal", () => {
    expect(calcBaseImponible(m(500), m(800)).equals(zero)).toBe(true);
  });

  it("retorna 0 cuando subtotal y descuento son 0", () => {
    expect(calcBaseImponible(zero, zero).equals(zero)).toBe(true);
  });

  it("clampa a 0 cuando descuento iguala subtotal exactamente", () => {
    expect(calcBaseImponible(m(500), m(500)).equals(zero)).toBe(true);
  });
});

describe("compute-iva-totals — calcIvaCreditoFiscal", () => {
  it("aplica 13% nominal sobre baseImponible (alícuota SIN, NO ÷ 1.13)", () => {
    // 1000 × 0.13 = 130 (NOT 1000 / 1.13 × 0.13 = 115.04)
    expect(calcIvaCreditoFiscal(m(1000)).equals(m(130))).toBe(true);
  });

  it("retorna 0 cuando baseImponible es 0", () => {
    expect(calcIvaCreditoFiscal(zero).equals(zero)).toBe(true);
  });

  it("retorna IVA pequeño correcto sobre base pequeña", () => {
    // 10 × 0.13 = 1.30
    expect(calcIvaCreditoFiscal(m(10)).equals(m(1.30))).toBe(true);
  });

  it("redondea half-up a 2dp", () => {
    // 7.71 × 0.13 = 1.0023 → 1.00
    // 7.73 × 0.13 = 1.0049 → 1.00
    // 7.75 × 0.13 = 1.0075 → 1.01 (half-up)
    expect(calcIvaCreditoFiscal(m(7.75)).equals(m(1.01))).toBe(true);
  });
});

describe("compute-iva-totals — calcDebitoFiscal", () => {
  it("es idéntico a calcIvaCreditoFiscal (débito = crédito en IVA Bolivia)", () => {
    const base = m(1000);
    expect(calcDebitoFiscal(base).equals(calcIvaCreditoFiscal(base))).toBe(true);
  });
});

describe("compute-iva-totals — computeIvaTotals (pipeline)", () => {
  it("ejecuta pipeline completo y retorna IvaCalcResult VO", () => {
    // importeTotal=1000, sin deducciones, sin descuento → subtotal=1000, base=1000, iva=130
    const result = computeIvaTotals({
      importeTotal: m(1000),
      importeIce: zero,
      importeIehd: zero,
      importeIpj: zero,
      tasas: zero,
      otrosNoSujetos: zero,
      exentos: zero,
      tasaCero: zero,
      codigoDescuentoAdicional: zero,
      importeGiftCard: zero,
    });
    expect(result).toBeInstanceOf(IvaCalcResult);
    expect(result.subtotal.equals(m(1000))).toBe(true);
    expect(result.baseImponible.equals(m(1000))).toBe(true);
    expect(result.ivaAmount.equals(m(130))).toBe(true);
  });

  it("aplica deducciones + descuento + IVA en pipeline", () => {
    // 1000 - 50 (ICE) - 30 (IEHD) = 920 subtotal
    // 920 - 20 (descuento adicional) - 10 (giftcard) = 890 base
    // 890 × 0.13 = 115.70 iva
    const result = computeIvaTotals({
      importeTotal: m(1000),
      importeIce: m(50),
      importeIehd: m(30),
      importeIpj: zero,
      tasas: zero,
      otrosNoSujetos: zero,
      exentos: zero,
      tasaCero: zero,
      codigoDescuentoAdicional: m(20),
      importeGiftCard: m(10),
    });
    expect(result.subtotal.equals(m(920))).toBe(true);
    expect(result.baseImponible.equals(m(890))).toBe(true);
    expect(result.ivaAmount.equals(m(115.70))).toBe(true);
  });

  it("clampa subtotal y baseImponible a 0 cuando deducciones + descuento exceden", () => {
    // 100 - 200 (ICE) = -100 → subtotal = 0
    // 0 - 50 (descuento) = -50 → base = 0
    // 0 × 0.13 = 0 iva
    const result = computeIvaTotals({
      importeTotal: m(100),
      importeIce: m(200),
      importeIehd: zero,
      importeIpj: zero,
      tasas: zero,
      otrosNoSujetos: zero,
      exentos: zero,
      tasaCero: zero,
      codigoDescuentoAdicional: m(50),
      importeGiftCard: zero,
    });
    expect(result.subtotal.equals(zero)).toBe(true);
    expect(result.baseImponible.equals(zero)).toBe(true);
    expect(result.ivaAmount.equals(zero)).toBe(true);
  });

  it("respeta invariantes IvaCalcResult VO (ivaAmount ≤ base ≤ subtotal)", () => {
    // factura compleja realista: 1000 - 100 deducciones = 900 subtotal
    // 900 - 50 descuento = 850 base; 850 × 0.13 = 110.50 iva
    const result = computeIvaTotals({
      importeTotal: m(1000),
      importeIce: m(40),
      importeIehd: m(20),
      importeIpj: m(15),
      tasas: m(10),
      otrosNoSujetos: m(5),
      exentos: m(5),
      tasaCero: m(5),
      codigoDescuentoAdicional: m(30),
      importeGiftCard: m(20),
    });
    // VO invariants: base ≤ subtotal, iva ≤ base
    expect(result.baseImponible.isGreaterThan(result.subtotal)).toBe(false);
    expect(result.ivaAmount.isGreaterThan(result.baseImponible)).toBe(false);
    expect(result.subtotal.equals(m(900))).toBe(true);
    expect(result.baseImponible.equals(m(850))).toBe(true);
    expect(result.ivaAmount.equals(m(110.50))).toBe(true);
  });
});
