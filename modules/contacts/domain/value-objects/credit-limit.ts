import { InvalidCreditLimit } from "../errors/contact-errors";

export class CreditLimit {
  private constructor(public readonly value: number) {}

  static of(value: number): CreditLimit {
    if (typeof value !== "number" || Number.isNaN(value) || !Number.isFinite(value)) {
      throw new InvalidCreditLimit("El límite de crédito debe ser un número válido");
    }
    if (value < 0) {
      throw new InvalidCreditLimit(
        "El límite de crédito no puede ser negativo",
        value,
      );
    }
    return new CreditLimit(value);
  }

  equals(other: CreditLimit): boolean {
    return this.value === other.value;
  }
}
