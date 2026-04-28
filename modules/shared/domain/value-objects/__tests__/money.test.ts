import { describe, it, expect } from "vitest";
import { Money } from "../money";
import { InvalidMonetaryAmount } from "../../errors/monetary-errors";

describe("Money VO (Decimal-based)", () => {
  describe("of()", () => {
    it("acepta number y preserva el valor exacto", () => {
      const m = Money.of(1234.56);
      expect(m.toString()).toBe("1234.56");
    });

    it("acepta string", () => {
      const m = Money.of("1234.56");
      expect(m.toString()).toBe("1234.56");
    });

    // Failure mode declarado: InvalidMonetaryAmount (validation, INVALID_MONETARY_AMOUNT).
    it("rechaza NaN con InvalidMonetaryAmount", () => {
      expect(() => Money.of(NaN)).toThrow(InvalidMonetaryAmount);
    });

    // Failure mode declarado: InvalidMonetaryAmount.
    it("rechaza Infinity con InvalidMonetaryAmount", () => {
      expect(() => Money.of(Infinity)).toThrow(InvalidMonetaryAmount);
    });

    // Failure mode declarado: InvalidMonetaryAmount. Valores negativos no son
    // válidos en Money — el dominio delega "signo según naturaleza" al uso
    // (debit/credit, etc.), no al VO.
    it("rechaza number negativo con InvalidMonetaryAmount", () => {
      expect(() => Money.of(-1)).toThrow(InvalidMonetaryAmount);
    });

    // Failure mode declarado: InvalidMonetaryAmount.
    it("rechaza string negativo con InvalidMonetaryAmount", () => {
      expect(() => Money.of("-0.01")).toThrow(InvalidMonetaryAmount);
    });

    // Failure mode declarado: InvalidMonetaryAmount.
    it("rechaza string no parseable con InvalidMonetaryAmount", () => {
      expect(() => Money.of("abc")).toThrow(InvalidMonetaryAmount);
    });

    it("acepta 0 (Money.of(0) === Money.zero())", () => {
      expect(Money.of(0).equals(Money.zero())).toBe(true);
    });
  });

  describe("zero()", () => {
    it("devuelve Money con valor 0 e isZero() true", () => {
      const z = Money.zero();
      expect(z.isZero()).toBe(true);
    });
  });

  describe("plus()", () => {
    it("suma dos montos", () => {
      const a = Money.of(100);
      const b = Money.of(50.5);
      expect(a.plus(b).equals(Money.of(150.5))).toBe(true);
    });

    // Razón de elegir Decimal: 0.1 + 0.2 con number da 0.30000000000000004.
    // Con Decimal preservamos exactitud, base de I1 (partida doble bit-perfect).
    it("preserva exactitud bit-perfect en 0.1 + 0.2 = 0.3 (clave para I1)", () => {
      const sum = Money.of("0.1").plus(Money.of("0.2"));
      expect(sum.equals(Money.of("0.3"))).toBe(true);
    });

    it("acumula 100 sumas de 0.01 a exactamente 1 (regresión drift)", () => {
      let total = Money.zero();
      for (let i = 0; i < 100; i++) {
        total = total.plus(Money.of("0.01"));
      }
      expect(total.equals(Money.of("1"))).toBe(true);
    });
  });

  describe("minus()", () => {
    it("resta dos montos", () => {
      const a = Money.of(100);
      const b = Money.of(30);
      expect(a.minus(b).equals(Money.of(70))).toBe(true);
    });

    it("acepta resta a cero exacto", () => {
      expect(Money.of(50).minus(Money.of(50)).isZero()).toBe(true);
    });

    // Failure mode declarado: InvalidMonetaryAmount. Money no permite negativos
    // — el caller debe asegurar a >= b antes de restar (mismo contrato que
    // MonetaryAmount existente).
    it("rechaza resta que produce negativo con InvalidMonetaryAmount", () => {
      expect(() => Money.of(50).minus(Money.of(100))).toThrow(
        InvalidMonetaryAmount,
      );
    });
  });

  describe("equals()", () => {
    it("true cuando los montos son numéricamente iguales (number vs string)", () => {
      expect(Money.of(100).equals(Money.of("100"))).toBe(true);
      expect(Money.of("100.00").equals(Money.of(100))).toBe(true);
    });

    it("false cuando difieren", () => {
      expect(Money.of(100).equals(Money.of(100.01))).toBe(false);
    });
  });

  describe("isGreaterThan() / isLessThan()", () => {
    it("isGreaterThan respeta orden estricto", () => {
      expect(Money.of(100).isGreaterThan(Money.of(50))).toBe(true);
      expect(Money.of(50).isGreaterThan(Money.of(100))).toBe(false);
      expect(Money.of(100).isGreaterThan(Money.of(100))).toBe(false);
    });

    it("isLessThan respeta orden estricto", () => {
      expect(Money.of(50).isLessThan(Money.of(100))).toBe(true);
      expect(Money.of(100).isLessThan(Money.of(50))).toBe(false);
      expect(Money.of(100).isLessThan(Money.of(100))).toBe(false);
    });
  });

  describe("isZero()", () => {
    it("true para Money.zero()", () => {
      expect(Money.zero().isZero()).toBe(true);
    });

    it("true para Money.of(0)", () => {
      expect(Money.of(0).isZero()).toBe(true);
    });

    it("false para monto positivo mínimo", () => {
      expect(Money.of("0.01").isZero()).toBe(false);
    });
  });

  describe("toString() / toNumber()", () => {
    it("toString devuelve representación natural sin trailing zeros", () => {
      expect(Money.of(100).toString()).toBe("100");
      expect(Money.of(100.5).toString()).toBe("100.5");
    });

    it("toNumber convierte a number para snapshots", () => {
      expect(Money.of(1234.56).toNumber()).toBe(1234.56);
      expect(Money.zero().toNumber()).toBe(0);
    });
  });

  describe("signedDiff()", () => {
    it("retorna number positivo cuando this > other", () => {
      expect(Money.of(100).signedDiff(Money.of(40))).toBe(60);
    });

    it("retorna number negativo cuando this < other (caso clave)", () => {
      expect(Money.of(40).signedDiff(Money.of(100))).toBe(-60);
    });

    it("retorna 0 cuando son iguales", () => {
      expect(Money.of(100).signedDiff(Money.of(100))).toBe(0);
    });

    it("preserva exactitud con decimales (regresión drift)", () => {
      expect(Money.of("0.1").signedDiff(Money.of("0.3"))).toBe(-0.2);
    });
  });

  describe("inmutabilidad", () => {
    it("plus devuelve nueva instancia, no muta this", () => {
      const a = Money.of(100);
      const b = Money.of(50);
      const c = a.plus(b);
      expect(c).not.toBe(a);
      expect(a.equals(Money.of(100))).toBe(true);
    });

    it("minus devuelve nueva instancia, no muta this", () => {
      const a = Money.of(100);
      const b = Money.of(50);
      const c = a.minus(b);
      expect(c).not.toBe(a);
      expect(a.equals(Money.of(100))).toBe(true);
    });
  });
});
