import Decimal from "decimal.js";
import { roundHalfUp } from "@/modules/accounting/shared/domain/money.utils";
import { InvalidMonetaryAmount } from "../errors/monetary-errors";

// Decimal-based monetary VO (R-money-vo DISCHARGED OLEADA 8 POC #2).
// Uses decimal.js@10.6.0 directly because partida-doble + IVA arithmetic
// require bit-perfect 2-decimal rounding; a number-based VO with float
// cents-arithmetic drifts on chained operations.
// Domain does NOT expose Decimal — only the public methods on
// MonetaryAmount. SHAPE-A interno: `.value: number` public boundary preserved
// via `this.raw.toNumber()` (sister: modules/shared/domain/value-objects/money.ts).
// (sub-POC 1 unblock-bundle: swapped from Prisma.Decimal value-import to
// decimal.js default-import to remove node:module bundle leak —
// oleada-money-decimal-hex-purity.)

const MAX_VALUE = new Decimal("9999999999.99");

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
  if (d.greaterThan(MAX_VALUE)) {
    throw new InvalidMonetaryAmount(
      `El monto excede el máximo permitido (${MAX_VALUE.toString()}): ${d.toString()}`,
    );
  }
  return roundHalfUp(d);
}

export class MonetaryAmount {
  private constructor(private readonly raw: Decimal) {}

  static of(value: number | string): MonetaryAmount {
    return new MonetaryAmount(parse(value));
  }

  static zero(): MonetaryAmount {
    return new MonetaryAmount(new Decimal(0));
  }

  get value(): number {
    return this.raw.toNumber();
  }

  plus(other: MonetaryAmount): MonetaryAmount {
    return new MonetaryAmount(roundHalfUp(this.raw.plus(other.raw)));
  }

  minus(other: MonetaryAmount): MonetaryAmount {
    const result = roundHalfUp(this.raw.minus(other.raw));
    if (result.isNegative()) {
      throw new InvalidMonetaryAmount(
        `La resta produce un monto negativo: ${this.raw.toString()} - ${other.raw.toString()}`,
      );
    }
    return new MonetaryAmount(result);
  }

  equals(other: MonetaryAmount): boolean {
    return this.raw.equals(other.raw);
  }

  isGreaterThan(other: MonetaryAmount): boolean {
    return this.raw.greaterThan(other.raw);
  }

  isLessThan(other: MonetaryAmount): boolean {
    return this.raw.lessThan(other.raw);
  }
}
