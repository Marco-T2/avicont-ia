import { InvalidMonetaryAmount } from "../errors/monetary-errors";

const MAX_VALUE = 9_999_999_999.99;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function parse(input: number | string): number {
  const n = typeof input === "string" ? Number(input) : input;
  if (typeof n !== "number" || Number.isNaN(n) || !Number.isFinite(n)) {
    throw new InvalidMonetaryAmount(`Monto inválido: ${String(input)}`);
  }
  if (n < 0) {
    throw new InvalidMonetaryAmount(`El monto no puede ser negativo: ${n}`);
  }
  if (n > MAX_VALUE) {
    throw new InvalidMonetaryAmount(`El monto excede el máximo permitido (${MAX_VALUE}): ${n}`);
  }
  return round2(n);
}

export class MonetaryAmount {
  private constructor(private readonly raw: number) {}

  static of(value: number | string): MonetaryAmount {
    return new MonetaryAmount(parse(value));
  }

  static zero(): MonetaryAmount {
    return new MonetaryAmount(0);
  }

  get value(): number {
    return this.raw;
  }

  plus(other: MonetaryAmount): MonetaryAmount {
    return MonetaryAmount.of(this.raw + other.raw);
  }

  minus(other: MonetaryAmount): MonetaryAmount {
    const result = round2(this.raw - other.raw);
    if (result < 0) {
      throw new InvalidMonetaryAmount(
        `La resta produce un monto negativo: ${this.raw} - ${other.raw}`,
      );
    }
    return new MonetaryAmount(result);
  }

  equals(other: MonetaryAmount): boolean {
    return this.raw === other.raw;
  }

  isGreaterThan(other: MonetaryAmount): boolean {
    return this.raw > other.raw;
  }

  isLessThan(other: MonetaryAmount): boolean {
    return this.raw < other.raw;
  }
}
