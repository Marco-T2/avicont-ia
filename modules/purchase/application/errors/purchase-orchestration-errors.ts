import {
  FISCAL_PERIOD_CLOSED,
  PURCHASE_ACCOUNT_NOT_FOUND,
  PURCHASE_CONTACT_INACTIVE,
  PURCHASE_INVALID_CONTACT_TYPE,
  ValidationError,
} from "@/features/shared/errors";

export {
  FISCAL_PERIOD_CLOSED,
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
