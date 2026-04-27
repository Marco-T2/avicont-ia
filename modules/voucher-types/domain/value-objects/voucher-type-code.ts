import { InvalidVoucherTypeCodeFormat } from "../errors/voucher-type-errors";

const VOUCHER_TYPE_CODE_REGEX = /^[A-Z0-9]+$/;
const MIN_LEN = 2;
const MAX_LEN = 6;

export class VoucherTypeCode {
  private constructor(public readonly value: string) {}

  static of(code: string): VoucherTypeCode {
    if (typeof code !== "string" || code.length < MIN_LEN || code.length > MAX_LEN) {
      throw new InvalidVoucherTypeCodeFormat(
        `El código debe tener entre ${MIN_LEN} y ${MAX_LEN} caracteres`,
        code,
      );
    }
    if (!VOUCHER_TYPE_CODE_REGEX.test(code)) {
      throw new InvalidVoucherTypeCodeFormat(
        "El código debe ser mayúsculas A-Z/0-9",
        code,
      );
    }
    return new VoucherTypeCode(code);
  }

  equals(other: VoucherTypeCode): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
