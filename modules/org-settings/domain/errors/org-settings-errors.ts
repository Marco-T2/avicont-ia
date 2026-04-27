// TODO(arch 4.1): los códigos ORG_SETTINGS_ACCOUNT_* viven todavía en
// `features/shared/errors`. Cuando todos los POCs hayan migrado, moverlos a este
// archivo (los "específicos de cada módulo migran al domain/errors/" del módulo).
import { ValidationError } from "@/features/shared/errors";
export {
  ORG_SETTINGS_ACCOUNT_NOT_FOUND,
  ORG_SETTINGS_ACCOUNT_NOT_USABLE,
  ORG_SETTINGS_ACCOUNT_WRONG_PARENT,
} from "@/features/shared/errors";

export const INVALID_ROUNDING_THRESHOLD = "INVALID_ROUNDING_THRESHOLD";
export const INVALID_ACCOUNT_CODE = "INVALID_ACCOUNT_CODE";

export class InvalidRoundingThreshold extends ValidationError {
  constructor(message: string, value?: number) {
    super(
      message,
      INVALID_ROUNDING_THRESHOLD,
      value !== undefined ? { value } : undefined,
    );
    this.name = "InvalidRoundingThreshold";
  }
}

export class InvalidAccountCode extends ValidationError {
  constructor(message: string, value?: string) {
    super(
      message,
      INVALID_ACCOUNT_CODE,
      value !== undefined ? { value } : undefined,
    );
    this.name = "InvalidAccountCode";
  }
}
