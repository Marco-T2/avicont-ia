import { InvalidPaymentTermsDays } from "../errors/contact-errors";

const MIN = 0;
const MAX = 365;
const DEFAULT = 30;

export class PaymentTermsDays {
  private constructor(public readonly value: number) {}

  static of(value: number): PaymentTermsDays {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
      throw new InvalidPaymentTermsDays("Los días de plazo deben ser un número válido");
    }
    if (!Number.isInteger(value)) {
      throw new InvalidPaymentTermsDays(
        "Los días de plazo deben ser un número entero",
        value,
      );
    }
    if (value < MIN) {
      throw new InvalidPaymentTermsDays(
        "Los días de plazo no pueden ser negativos",
        value,
      );
    }
    if (value > MAX) {
      throw new InvalidPaymentTermsDays(
        `Los días de plazo no pueden superar los ${MAX} días`,
        value,
      );
    }
    return new PaymentTermsDays(value);
  }

  static default(): PaymentTermsDays {
    return new PaymentTermsDays(DEFAULT);
  }

  equals(other: PaymentTermsDays): boolean {
    return this.value === other.value;
  }
}
