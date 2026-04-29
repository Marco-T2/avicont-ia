import {
  FISCAL_PERIOD_CLOSED,
  ForbiddenError,
  LOCKED_EDIT_REQUIRES_JUSTIFICATION,
  POST_NOT_ALLOWED_FOR_ROLE,
  SALE_CONTACT_CHANGE_BLOCKED,
  SALE_CONTACT_INACTIVE,
  SALE_INCOME_ACCOUNT_REQUIRED,
  SALE_INVALID_CONTACT_TYPE,
  ValidationError,
} from "@/features/shared/errors";

export {
  FISCAL_PERIOD_CLOSED,
  LOCKED_EDIT_REQUIRES_JUSTIFICATION,
  POST_NOT_ALLOWED_FOR_ROLE,
  SALE_CONTACT_CHANGE_BLOCKED,
  SALE_CONTACT_INACTIVE,
  SALE_INCOME_ACCOUNT_REQUIRED,
  SALE_INVALID_CONTACT_TYPE,
} from "@/features/shared/errors";

export class SaleContactNotClient extends ValidationError {
  constructor(contactType: string) {
    super(
      "El contacto debe ser de tipo CLIENTE para crear una venta",
      SALE_INVALID_CONTACT_TYPE,
      { contactType },
    );
    this.name = "SaleContactNotClient";
  }
}

export class SaleContactInactive extends ValidationError {
  constructor(contactId: string) {
    super(
      "El contacto está inactivo y no puede usarse en una venta",
      SALE_CONTACT_INACTIVE,
      { contactId },
    );
    this.name = "SaleContactInactive";
  }
}

export class SaleAccountNotFound extends ValidationError {
  constructor(accountId: string) {
    super(
      `Cuenta de ingreso no encontrada: ${accountId}`,
      SALE_INCOME_ACCOUNT_REQUIRED,
      { accountId },
    );
    this.name = "SaleAccountNotFound";
  }
}

export class SaleContactChangeWithAllocations extends ValidationError {
  constructor() {
    super(
      "No se puede cambiar el contacto de la venta porque tiene cobros activos asociados",
      SALE_CONTACT_CHANGE_BLOCKED,
    );
    this.name = "SaleContactChangeWithAllocations";
  }
}

export class SalePostNotAllowedForRole extends ForbiddenError {
  constructor(role: string) {
    super(
      "Tu rol no tiene permiso para contabilizar ventas",
      POST_NOT_ALLOWED_FOR_ROLE,
    );
    this.name = "SalePostNotAllowedForRole";
    this.details = { role };
  }
}

export class SalePeriodClosed extends ValidationError {
  constructor(periodId: string) {
    super(
      "El período fiscal está cerrado y no admite operaciones sobre la venta",
      FISCAL_PERIOD_CLOSED,
      { periodId },
    );
    this.name = "SalePeriodClosed";
  }
}

export class SaleLockedEditMissingJustification extends ValidationError {
  constructor() {
    super(
      "La edición de una venta bloqueada requiere justificación",
      LOCKED_EDIT_REQUIRES_JUSTIFICATION,
    );
    this.name = "SaleLockedEditMissingJustification";
  }
}
