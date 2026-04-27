import { InvalidMortalityCount } from "../errors/mortality-errors";

export class MortalityCount {
  private constructor(public readonly value: number) {}

  static of(value: number): MortalityCount {
    if (!Number.isInteger(value)) {
      throw new InvalidMortalityCount("La cantidad debe ser un número entero");
    }
    if (value < 1) {
      throw new InvalidMortalityCount("La cantidad mínima es 1");
    }
    return new MortalityCount(value);
  }

  equals(other: MortalityCount): boolean {
    return this.value === other.value;
  }
}
