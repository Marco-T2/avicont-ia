import { InvalidVoucherTypePrefixFormat } from "../errors/voucher-type-errors";

const VOUCHER_TYPE_PREFIX_REGEX = /^[A-Z0-9]$/;

export class VoucherTypePrefix {
  private constructor(public readonly value: string) {}

  static of(prefix: string): VoucherTypePrefix {
    if (typeof prefix !== "string" || !VOUCHER_TYPE_PREFIX_REGEX.test(prefix)) {
      throw new InvalidVoucherTypePrefixFormat(
        "El prefijo debe ser un único carácter A-Z o 0-9 en mayúscula",
        prefix,
      );
    }
    return new VoucherTypePrefix(prefix);
  }

  equals(other: VoucherTypePrefix): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
