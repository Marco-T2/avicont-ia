import { ValidationError } from "@/features/shared/errors";
import {
  PURCHASE_NO_DETAILS,
  PURCHASE_NOT_DRAFT,
  PURCHASE_EXPENSE_ACCOUNT_REQUIRED,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
} from "@/features/shared/errors";

export {
  PURCHASE_NO_DETAILS,
  PURCHASE_NOT_DRAFT,
  PURCHASE_EXPENSE_ACCOUNT_REQUIRED,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
} from "@/features/shared/errors";

export const INVALID_PURCHASE_STATUS = "INVALID_PURCHASE_STATUS";
export const INVALID_PURCHASE_DETAIL_LINE = "INVALID_PURCHASE_DETAIL_LINE";

export class InvalidPurchaseStatus extends ValidationError {
  constructor(value: string) {
    super(`Estado de compra inválido: ${value}`, INVALID_PURCHASE_STATUS, { value });
    this.name = "InvalidPurchaseStatus";
  }
}

export class InvalidPurchaseDetailLine extends ValidationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, INVALID_PURCHASE_DETAIL_LINE, context);
    this.name = "InvalidPurchaseDetailLine";
  }
}

export class PurchaseNoDetails extends ValidationError {
  constructor() {
    super(
      "La compra debe tener al menos una línea de detalle para ser contabilizada",
      PURCHASE_NO_DETAILS,
    );
    this.name = "PurchaseNoDetails";
  }
}

export class PurchaseNotDraft extends ValidationError {
  constructor() {
    super(
      "Solo se pueden eliminar compras en estado BORRADOR",
      PURCHASE_NOT_DRAFT,
    );
    this.name = "PurchaseNotDraft";
  }
}

export class InvalidPurchaseStatusTransition extends ValidationError {
  constructor(current: string, target: string) {
    super(
      `Transición inválida: ${current} → ${target}`,
      INVALID_STATUS_TRANSITION,
      { current, target },
    );
    this.name = "InvalidPurchaseStatusTransition";
  }
}

export class PurchaseVoidedImmutable extends ValidationError {
  constructor() {
    super(
      "Una compra anulada no puede ser modificada",
      ENTRY_VOIDED_IMMUTABLE,
    );
    this.name = "PurchaseVoidedImmutable";
  }
}

export class PurchaseExpenseAccountsRequired extends ValidationError {
  constructor() {
    super(
      "Cada línea de detalle debe tener una cuenta de gasto asociada",
      PURCHASE_EXPENSE_ACCOUNT_REQUIRED,
    );
    this.name = "PurchaseExpenseAccountsRequired";
  }
}
