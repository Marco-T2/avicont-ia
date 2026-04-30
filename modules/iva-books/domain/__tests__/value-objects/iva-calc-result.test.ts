import { describe, it, expect } from "vitest";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import { IvaCalcResult } from "../../value-objects/iva-calc-result";
import { InvalidIvaCalcResult } from "../../errors/iva-book-errors";

const M = (n: number) => MonetaryAmount.of(n);

describe("IvaCalcResult", () => {
  describe("of() factory", () => {
    it("construye con todos los montos en cero", () => {
      const r = IvaCalcResult.of({
        subtotal: M(0),
        baseImponible: M(0),
        ivaAmount: M(0),
      });
      expect(r.subtotal.value).toBe(0);
      expect(r.baseImponible.value).toBe(0);
      expect(r.ivaAmount.value).toBe(0);
    });

    it("construye con base = subtotal y iva = base × 0.13 (sin descuentos)", () => {
      const r = IvaCalcResult.of({
        subtotal: M(100),
        baseImponible: M(100),
        ivaAmount: M(13),
      });
      expect(r.subtotal.value).toBe(100);
      expect(r.baseImponible.value).toBe(100);
      expect(r.ivaAmount.value).toBe(13);
    });

    it("construye con descuentos: base < subtotal", () => {
      const r = IvaCalcResult.of({
        subtotal: M(100),
        baseImponible: M(90),
        ivaAmount: M(11.7),
      });
      expect(r.subtotal.value).toBe(100);
      expect(r.baseImponible.value).toBe(90);
      expect(r.ivaAmount.value).toBe(11.7);
    });
  });

  describe("invariantes", () => {
    it("rechaza baseImponible > subtotal (descuentos no pueden aumentar la base)", () => {
      expect(() =>
        IvaCalcResult.of({
          subtotal: M(100),
          baseImponible: M(150),
          ivaAmount: M(19.5),
        }),
      ).toThrow(InvalidIvaCalcResult);
    });

    it("rechaza ivaAmount > baseImponible (IVA no puede exceder su base)", () => {
      expect(() =>
        IvaCalcResult.of({
          subtotal: M(100),
          baseImponible: M(100),
          ivaAmount: M(150),
        }),
      ).toThrow(InvalidIvaCalcResult);
    });
  });

  describe("equals", () => {
    it("retorna true para dos IvaCalcResult con los mismos montos", () => {
      const a = IvaCalcResult.of({
        subtotal: M(100),
        baseImponible: M(90),
        ivaAmount: M(11.7),
      });
      const b = IvaCalcResult.of({
        subtotal: M(100),
        baseImponible: M(90),
        ivaAmount: M(11.7),
      });
      expect(a.equals(b)).toBe(true);
    });

    it("retorna false cuando difiere subtotal", () => {
      const a = IvaCalcResult.of({
        subtotal: M(100),
        baseImponible: M(90),
        ivaAmount: M(11.7),
      });
      const b = IvaCalcResult.of({
        subtotal: M(101),
        baseImponible: M(90),
        ivaAmount: M(11.7),
      });
      expect(a.equals(b)).toBe(false);
    });

    it("retorna false cuando difiere baseImponible", () => {
      const a = IvaCalcResult.of({
        subtotal: M(100),
        baseImponible: M(90),
        ivaAmount: M(11.7),
      });
      const b = IvaCalcResult.of({
        subtotal: M(100),
        baseImponible: M(80),
        ivaAmount: M(10.4),
      });
      expect(a.equals(b)).toBe(false);
    });

    it("retorna false cuando difiere ivaAmount", () => {
      const a = IvaCalcResult.of({
        subtotal: M(100),
        baseImponible: M(100),
        ivaAmount: M(13),
      });
      const b = IvaCalcResult.of({
        subtotal: M(100),
        baseImponible: M(100),
        ivaAmount: M(12.99),
      });
      expect(a.equals(b)).toBe(false);
    });
  });
});
