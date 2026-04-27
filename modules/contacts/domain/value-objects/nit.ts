import { InvalidNitFormat } from "../errors/contact-errors";

const MAX_LEN = 20;

export class Nit {
  private constructor(public readonly value: string) {}

  static of(raw: string): Nit {
    if (typeof raw !== "string") {
      throw new InvalidNitFormat("El NIT debe ser una cadena");
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new InvalidNitFormat("El NIT no puede estar vacío");
    }
    if (trimmed.length > MAX_LEN) {
      throw new InvalidNitFormat(
        `El NIT no puede superar los ${MAX_LEN} caracteres`,
        trimmed,
      );
    }
    return new Nit(trimmed);
  }

  equals(other: Nit): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
