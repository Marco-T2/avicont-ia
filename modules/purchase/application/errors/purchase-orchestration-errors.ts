import {
  FISCAL_PERIOD_CLOSED,
  ForbiddenError,
  POST_NOT_ALLOWED_FOR_ROLE,
  PURCHASE_ACCOUNT_NOT_FOUND,
  PURCHASE_CONTACT_INACTIVE,
  PURCHASE_INVALID_CONTACT_TYPE,
  ValidationError,
} from "@/features/shared/errors";

export {
  FISCAL_PERIOD_CLOSED,
  POST_NOT_ALLOWED_FOR_ROLE,
  PURCHASE_ACCOUNT_NOT_FOUND,
  PURCHASE_CONTACT_INACTIVE,
  PURCHASE_INVALID_CONTACT_TYPE,
} from "@/features/shared/errors";

export class PurchaseContactNotProvider extends ValidationError {
  constructor(contactType: string) {
    super(
      "El contacto debe ser de tipo PROVEEDOR para crear una compra",
      PURCHASE_INVALID_CONTACT_TYPE,
      { contactType },
    );
    this.name = "PurchaseContactNotProvider";
  }
}

export class PurchaseContactInactive extends ValidationError {
  constructor(contactId: string) {
    super(
      "El contacto está inactivo y no puede usarse en una compra",
      PURCHASE_CONTACT_INACTIVE,
      { contactId },
    );
    this.name = "PurchaseContactInactive";
  }
}

export class PurchaseAccountNotFound extends ValidationError {
  constructor(accountId: string) {
    super(
      `Cuenta de gasto no encontrada: ${accountId}`,
      PURCHASE_ACCOUNT_NOT_FOUND,
      { accountId },
    );
    this.name = "PurchaseAccountNotFound";
  }
}

export class PurchasePeriodClosed extends ValidationError {
  constructor(periodId: string) {
    super(
      "El período fiscal está cerrado y no admite operaciones sobre la compra",
      FISCAL_PERIOD_CLOSED,
      { periodId },
    );
    this.name = "PurchasePeriodClosed";
  }
}

export class PurchasePostNotAllowedForRole extends ForbiddenError {
  constructor(role: string) {
    super(
      "Tu rol no tiene permiso para contabilizar compras",
      POST_NOT_ALLOWED_FOR_ROLE,
    );
    this.name = "PurchasePostNotAllowedForRole";
    this.details = { role };
  }
}
