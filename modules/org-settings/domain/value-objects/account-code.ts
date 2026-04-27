import { InvalidAccountCode } from "../errors/org-settings-errors";

export class AccountCode {
  private constructor(public readonly value: string) {}

  static of(raw: string): AccountCode {
    if (typeof raw !== "string") {
      throw new InvalidAccountCode("El código de cuenta debe ser una cadena");
    }
    const trimmed = raw.trim();
    if (trimmed.length === 0) {
      throw new InvalidAccountCode("El código de cuenta no puede estar vacío");
    }
    return new AccountCode(trimmed);
  }

  equals(other: AccountCode): boolean {
    return this.value === other.value;
  }

  descendsFrom(parent: AccountCode): boolean {
    return (
      this.value === parent.value ||
      this.value.startsWith(`${parent.value}.`)
    );
  }

  descendsFromAny(parents: AccountCode[]): boolean {
    return parents.some((p) => this.descendsFrom(p));
  }
}
