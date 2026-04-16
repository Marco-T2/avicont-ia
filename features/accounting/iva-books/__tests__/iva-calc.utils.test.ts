import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import {
  calcSubtotal,
  calcBaseImponible,
  calcIvaCreditoFiscal,
  calcDebitoFiscal,
  calcTotales,
} from "@/features/accounting/iva-books/iva-calc.utils";

const D = (v: string | number) => new Prisma.Decimal(v);

// ── helpers ───────────────────────────────────────────────────────────────────

/** Compara Decimal con string de 2dp para aserciones legibles */
function dec(d: Prisma.Decimal): string {
  return d.toFixed(2);
}

// ── calcSubtotal ──────────────────────────────────────────────────────────────

describe("calcSubtotal", () => {
  it("caso estándar — sin deducciones → igual al total", () => {
    const result = calcSubtotal({
      importeTotal: D("1000"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
    });
    expect(dec(result)).toBe("1000.00");
  });

  it("deduce ICE, IEHD, IPJ, tasas, exentos, tasaCero correctamente", () => {
    const result = calcSubtotal({
      importeTotal: D("1000"),
      importeIce: D("50"),
      importeIehd: D("30"),
      importeIpj: D("20"),
      tasas: D("10"),
      otrosNoSujetos: D("0"),
      exentos: D("100"),
      tasaCero: D("0"),
    });
    // 1000 - 50 - 30 - 20 - 10 - 0 - 100 - 0 = 790
    expect(dec(result)).toBe("790.00");
  });

  it("total cero → subtotal cero", () => {
    const result = calcSubtotal({
      importeTotal: D("0"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
    });
    expect(dec(result)).toBe("0.00");
  });

  it("compra 100% exenta — subtotal cero", () => {
    const result = calcSubtotal({
      importeTotal: D("500"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("500"),
      tasaCero: D("0"),
    });
    expect(dec(result)).toBe("0.00");
  });
});

// ── calcBaseImponible ─────────────────────────────────────────────────────────
//
// CONVENCIÓN SIN Bolivia (Form. 200, Rubro 1.a): "Importe Base" = subtotal − descuento.
// El IVA es alícuota NOMINAL del 13% aplicada al Importe Base (no se divide entre 1.13).

describe("calcBaseImponible", () => {
  it("sin descuento — base = subtotal: 1000 → 1000.00", () => {
    expect(dec(calcBaseImponible(D("1000"), D("0")))).toBe("1000.00");
  });

  it("subtotal parcial sin descuento: 800 → 800.00", () => {
    expect(dec(calcBaseImponible(D("800"), D("0")))).toBe("800.00");
  });

  it("cero → cero", () => {
    expect(dec(calcBaseImponible(D("0"), D("0")))).toBe("0.00");
  });

  it("con descuento: 1000 − 50 = 950.00", () => {
    expect(dec(calcBaseImponible(D("1000"), D("50")))).toBe("950.00");
  });

  it("descuento mayor al subtotal → 0.00 (no negativo)", () => {
    expect(dec(calcBaseImponible(D("100"), D("200")))).toBe("0.00");
  });

  it("caso 113 → base = 113.00 (el total ES la base)", () => {
    expect(dec(calcBaseImponible(D("113"), D("0")))).toBe("113.00");
  });
});

// ── calcIvaCreditoFiscal ──────────────────────────────────────────────────────

describe("calcIvaCreditoFiscal", () => {
  it("caso estándar 1000 → 130.00 (= 1000 × 0.13)", () => {
    expect(dec(calcIvaCreditoFiscal(D("1000")))).toBe("130.00");
  });

  it("base 800 → 104.00", () => {
    expect(dec(calcIvaCreditoFiscal(D("800")))).toBe("104.00");
  });

  it("base cero → crédito fiscal cero (NO divide por cero)", () => {
    expect(dec(calcIvaCreditoFiscal(D("0")))).toBe("0.00");
  });

  it("compra 100% exenta (baseCF=0) → creditoFiscal=0, sin error", () => {
    expect(() => calcIvaCreditoFiscal(D("0"))).not.toThrow();
    expect(dec(calcIvaCreditoFiscal(D("0")))).toBe("0.00");
  });

  it("ROUND_HALF_UP en .005: base 0.05 × 0.13 = 0.0065 → 0.01", () => {
    expect(dec(calcIvaCreditoFiscal(D("0.05")))).toBe("0.01");
  });

  it("base 99.99 × 0.13 = 12.9987 → 13.00", () => {
    expect(dec(calcIvaCreditoFiscal(D("99.99")))).toBe("13.00");
  });

  it("base 100 → 13.00 exacto", () => {
    expect(dec(calcIvaCreditoFiscal(D("100")))).toBe("13.00");
  });

  it("invariante: ivaAmount = base × 0.13 (HALF_UP)", () => {
    expect(dec(calcIvaCreditoFiscal(D("250")))).toBe("32.50");
    expect(dec(calcIvaCreditoFiscal(D("123.45")))).toBe("16.05");
  });
});

// ── calcDebitoFiscal ──────────────────────────────────────────────────────────

describe("calcDebitoFiscal", () => {
  it("caso estándar 1000 → 130.00 (simétrico a crédito fiscal)", () => {
    expect(dec(calcDebitoFiscal(D("1000")))).toBe("130.00");
  });

  it("base cero → débito fiscal cero", () => {
    expect(dec(calcDebitoFiscal(D("0")))).toBe("0.00");
  });

  it("800 → 104.00", () => {
    expect(dec(calcDebitoFiscal(D("800")))).toBe("104.00");
  });

  it("99.99 → 13.00", () => {
    expect(dec(calcDebitoFiscal(D("99.99")))).toBe("13.00");
  });

  it("estadoSIN no afecta el cálculo — siempre 13% nominal", () => {
    expect(dec(calcDebitoFiscal(D("500")))).toBe("65.00");
  });
});

// ── calcTotales ───────────────────────────────────────────────────────────────

describe("calcTotales", () => {
  it("caso estándar — venta 1000 sin deducciones: base=1000, iva=130", () => {
    const result = calcTotales({
      importeTotal: D("1000"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
      codigoDescuentoAdicional: D("0"),
      importeGiftCard: D("0"),
    });
    expect(dec(result.subtotal)).toBe("1000.00");
    expect(dec(result.baseImponible)).toBe("1000.00");
    expect(dec(result.ivaAmount)).toBe("130.00");
  });

  it("caso 50 — base=50, iva=6.50", () => {
    const result = calcTotales({
      importeTotal: D("50"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
      codigoDescuentoAdicional: D("0"),
      importeGiftCard: D("0"),
    });
    expect(dec(result.subtotal)).toBe("50.00");
    expect(dec(result.baseImponible)).toBe("50.00");
    expect(dec(result.ivaAmount)).toBe("6.50");
  });

  it("compra 100% exenta → ivaAmount=0, sin error", () => {
    const result = calcTotales({
      importeTotal: D("500"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("500"),
      tasaCero: D("0"),
      codigoDescuentoAdicional: D("0"),
      importeGiftCard: D("0"),
    });
    expect(dec(result.subtotal)).toBe("0.00");
    expect(dec(result.baseImponible)).toBe("0.00");
    expect(dec(result.ivaAmount)).toBe("0.00");
  });

  it("con ICE + IEHD + IPJ + tasas — subtotal=890, base=890, iva=115.70", () => {
    const result = calcTotales({
      importeTotal: D("1000"),
      importeIce: D("50"),
      importeIehd: D("30"),
      importeIpj: D("20"),
      tasas: D("10"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
      codigoDescuentoAdicional: D("0"),
      importeGiftCard: D("0"),
    });
    expect(dec(result.subtotal)).toBe("890.00");
    expect(dec(result.baseImponible)).toBe("890.00");
    // iva = 890 × 0.13 = 115.70
    expect(dec(result.ivaAmount)).toBe("115.70");
  });

  it("con gift card — reduce base: subtotal=1000, base=900, iva=117", () => {
    const result = calcTotales({
      importeTotal: D("1000"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
      codigoDescuentoAdicional: D("0"),
      importeGiftCard: D("100"),
    });
    expect(dec(result.subtotal)).toBe("1000.00");
    expect(dec(result.baseImponible)).toBe("900.00");
    // iva = 900 × 0.13 = 117.00
    expect(dec(result.ivaAmount)).toBe("117.00");
  });

  it("total cero — todos los campos en 0.00", () => {
    const result = calcTotales({
      importeTotal: D("0"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
      codigoDescuentoAdicional: D("0"),
      importeGiftCard: D("0"),
    });
    expect(dec(result.subtotal)).toBe("0.00");
    expect(dec(result.baseImponible)).toBe("0.00");
    expect(dec(result.ivaAmount)).toBe("0.00");
  });

  it("rounding exacto: 100 → base=100.00, iva=13.00", () => {
    const result = calcTotales({
      importeTotal: D("100"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
      codigoDescuentoAdicional: D("0"),
      importeGiftCard: D("0"),
    });
    expect(dec(result.baseImponible)).toBe("100.00");
    expect(dec(result.ivaAmount)).toBe("13.00");
  });

  it("invariante: ivaAmount = baseImponible × 0.13 (HALF_UP)", () => {
    const result = calcTotales({
      importeTotal: D("1000"),
      importeIce: D("0"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("0"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
      codigoDescuentoAdicional: D("0"),
      importeGiftCard: D("0"),
    });
    const expected = result.baseImponible.mul(D("0.13"))
      .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    expect(result.ivaAmount.equals(expected)).toBe(true);
  });

  it("ejemplo SIN: total=1200, ICE=100, tasas=20, descuento=80 → base=1000, iva=130", () => {
    const result = calcTotales({
      importeTotal: D("1200"),
      importeIce: D("100"),
      importeIehd: D("0"),
      importeIpj: D("0"),
      tasas: D("20"),
      otrosNoSujetos: D("0"),
      exentos: D("0"),
      tasaCero: D("0"),
      codigoDescuentoAdicional: D("80"),
      importeGiftCard: D("0"),
    });
    // subtotal = 1200 - 100 - 20 = 1080
    expect(dec(result.subtotal)).toBe("1080.00");
    // base = 1080 - 80 = 1000
    expect(dec(result.baseImponible)).toBe("1000.00");
    // iva = 1000 × 0.13 = 130
    expect(dec(result.ivaAmount)).toBe("130.00");
  });
});
