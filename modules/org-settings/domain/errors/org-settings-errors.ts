import { ValidationError } from "@/features/shared/errors";

// OrgSettings — validación de listas de cuentas default (caja/banco) para captura
// asistida por IA. Owned por org-settings (migrados del shared hex registry, arch 4.1).
export const ORG_SETTINGS_ACCOUNT_NOT_FOUND = "ORG_SETTINGS_ACCOUNT_NOT_FOUND";
export const ORG_SETTINGS_ACCOUNT_NOT_USABLE = "ORG_SETTINGS_ACCOUNT_NOT_USABLE";
export const ORG_SETTINGS_ACCOUNT_WRONG_PARENT = "ORG_SETTINGS_ACCOUNT_WRONG_PARENT";

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
