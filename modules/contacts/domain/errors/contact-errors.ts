import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "@/features/shared/errors";
export {
  CONTACT_NIT_EXISTS,
  CONTACT_NOT_FOUND,
} from "@/features/shared/errors";
import {
  CONTACT_NIT_EXISTS,
  CONTACT_NOT_FOUND,
} from "@/features/shared/errors";

export const INVALID_NIT_FORMAT = "INVALID_NIT_FORMAT";
export const INVALID_PAYMENT_TERMS_DAYS = "INVALID_PAYMENT_TERMS_DAYS";
export const INVALID_CREDIT_LIMIT = "INVALID_CREDIT_LIMIT";
export const INVALID_CONTACT_TYPE = "INVALID_CONTACT_TYPE";
export const INVALID_CONTACT_NAME = "INVALID_CONTACT_NAME";

export class InvalidNitFormat extends ValidationError {
  constructor(message: string, value?: string) {
    super(
      message,
      INVALID_NIT_FORMAT,
      value !== undefined ? { value } : undefined,
    );
    this.name = "InvalidNitFormat";
  }
}

export class InvalidPaymentTermsDays extends ValidationError {
  constructor(message: string, value?: number) {
    super(
      message,
      INVALID_PAYMENT_TERMS_DAYS,
      value !== undefined ? { value } : undefined,
    );
    this.name = "InvalidPaymentTermsDays";
  }
}

export class InvalidCreditLimit extends ValidationError {
  constructor(message: string, value?: number) {
    super(
      message,
      INVALID_CREDIT_LIMIT,
      value !== undefined ? { value } : undefined,
    );
    this.name = "InvalidCreditLimit";
  }
}

export class InvalidContactType extends ValidationError {
  constructor(value: string) {
    super(
      `Tipo de contacto inválido: ${value}`,
      INVALID_CONTACT_TYPE,
      { value },
    );
    this.name = "InvalidContactType";
  }
}

export class InvalidContactName extends ValidationError {
  constructor(message: string, value?: string) {
    super(
      message,
      INVALID_CONTACT_NAME,
      value !== undefined ? { value } : undefined,
    );
    this.name = "InvalidContactName";
  }
}

export class ContactNitDuplicate extends ConflictError {
  constructor(nit: string) {
    super(`Un contacto con el NIT ${nit}`, CONTACT_NIT_EXISTS, { nit });
    this.name = "ContactNitDuplicate";
  }
}

export class ContactNotFound extends NotFoundError {
  constructor() {
    super("Contacto");
    this.name = "ContactNotFound";
  }
}

export class ContactInactiveOrMissing extends NotFoundError {
  constructor() {
    super("Contacto", CONTACT_NOT_FOUND);
    this.name = "ContactInactiveOrMissing";
  }
}
