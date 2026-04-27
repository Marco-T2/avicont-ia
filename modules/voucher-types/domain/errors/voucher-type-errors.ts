import { ConflictError, ValidationError } from "@/features/shared/errors";
export {
  VOUCHER_TYPE_CODE_DUPLICATE,
  VOUCHER_TYPE_NOT_IN_ORG,
} from "@/features/shared/errors";
import {
  VOUCHER_TYPE_CODE_DUPLICATE,
  VOUCHER_TYPE_NOT_IN_ORG,
} from "@/features/shared/errors";

export const INVALID_VOUCHER_TYPE_CODE_FORMAT =
  "INVALID_VOUCHER_TYPE_CODE_FORMAT";
export const INVALID_VOUCHER_TYPE_PREFIX_FORMAT =
  "INVALID_VOUCHER_TYPE_PREFIX_FORMAT";
export const VOUCHER_TYPE_CODE_IMMUTABLE = "VOUCHER_TYPE_CODE_IMMUTABLE";

export class InvalidVoucherTypeCodeFormat extends ValidationError {
  constructor(message: string, value?: string) {
    super(
      message,
      INVALID_VOUCHER_TYPE_CODE_FORMAT,
      value !== undefined ? { value } : undefined,
    );
    this.name = "InvalidVoucherTypeCodeFormat";
  }
}

export class InvalidVoucherTypePrefixFormat extends ValidationError {
  constructor(message: string, value?: string) {
    super(
      message,
      INVALID_VOUCHER_TYPE_PREFIX_FORMAT,
      value !== undefined ? { value } : undefined,
    );
    this.name = "InvalidVoucherTypePrefixFormat";
  }
}

export class VoucherTypeCodeDuplicate extends ConflictError {
  constructor(code: string) {
    super(`Tipo de comprobante con código ${code}`, VOUCHER_TYPE_CODE_DUPLICATE, {
      code,
    });
    this.name = "VoucherTypeCodeDuplicate";
  }
}

export class VoucherTypeNotInOrg extends ValidationError {
  constructor(code: string) {
    super(
      `Tipo de comprobante ${code} no configurado para esta organización`,
      VOUCHER_TYPE_NOT_IN_ORG,
      { code },
    );
    this.name = "VoucherTypeNotInOrg";
  }
}
