import Decimal from "decimal.js";
import { InvalidMonetaryAmount } from "../errors/monetary-errors";

// Decimal-based monetary VO. Uses decimal.js@10.6.0 directly because
// partida-doble requires bit-perfect equality on sums; a number-based VO
// with rounding can drift in journals with many lines.
// Domain does NOT expose Decimal — only the methods on Money.
// (sub-POC 1 unblock-bundle: swapped from Prisma.Decimal value-import to
// decimal.js default-import to remove node:module bundle leak —
// oleada-money-decimal-hex-purity.)

function parse(value: number | string): Decimal {
  let d: Decimal;
  try {
    d = new Decimal(value);
  } catch {
    throw new InvalidMonetaryAmount(`Monto inválido: ${String(value)}`);
  }
  if (!d.isFinite()) {
    throw new InvalidMonetaryAmount(`Monto inválido: ${String(value)}`);
  }
  if (d.isNegative()) {
    throw new InvalidMonetaryAmount(
      `El monto no puede ser negativo: ${d.toString()}`,
    );
  }
  return d;
}

export class Money {
  private constructor(private readonly raw: Decimal) {}

  static of(value: number | string): Money {
    return new Money(parse(value));
  }

  static zero(): Money {
    return new Money(new Decimal(0));
  }

  plus(other: Money): Money {
    return new Money(this.raw.plus(other.raw));
  }

  minus(other: Money): Money {
    const result = this.raw.minus(other.raw);
    if (result.isNegative()) {
      throw new InvalidMonetaryAmount(
        `La resta produce un monto negativo: ${this.raw.toString()} - ${other.raw.toString()}`,
      );
    }
    return new Money(result);
  }

  equals(other: Money): boolean {
    return this.raw.equals(other.raw);
  }

  isGreaterThan(other: Money): boolean {
    return this.raw.greaterThan(other.raw);
  }

  isLessThan(other: Money): boolean {
    return this.raw.lessThan(other.raw);
  }

  isZero(): boolean {
    return this.raw.isZero();
  }

  toString(): string {
    return this.raw.toString();
  }

  toNumber(): number {
    return this.raw.toNumber();
  }

  // Escape hatch for legitimately-signed contexts (e.g. an account balance
  // signed by `nature`). `minus` rejects negative results because Money is a
  // non-negative VO; `signedDiff` returns a plain number that may be negative.
  // Use only where the negative outcome is part of the domain meaning.
  signedDiff(other: Money): number {
    return this.raw.minus(other.raw).toNumber();
  }
}
