import { ValidationError } from "@/features/shared/errors";

export {
  SALE_NO_DETAILS,
  SALE_INVALID_CONTACT_TYPE,
  SALE_INCOME_ACCOUNT_REQUIRED,
  SALE_NOT_DRAFT,
  SALE_CONTACT_CHANGE_BLOCKED,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
} from "@/features/shared/errors";

export const INVALID_SALE_STATUS = "INVALID_SALE_STATUS";
export const INVALID_SALE_DETAIL_LINE = "INVALID_SALE_DETAIL_LINE";

import {
  SALE_NO_DETAILS,
  SALE_NOT_DRAFT,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
} from "@/features/shared/errors";

export class InvalidSaleStatus extends ValidationError {
  constructor(value: string) {
    super(`Estado de venta inválido: ${value}`, INVALID_SALE_STATUS, { value });
    this.name = "InvalidSaleStatus";
  }
}

export class InvalidSaleDetailLine extends ValidationError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, INVALID_SALE_DETAIL_LINE, context);
    this.name = "InvalidSaleDetailLine";
  }
}

export class SaleNoDetails extends ValidationError {
  constructor() {
    super(
      "La venta debe tener al menos una línea de detalle para ser contabilizada",
      SALE_NO_DETAILS,
    );
    this.name = "SaleNoDetails";
  }
}

export class SaleNotDraft extends ValidationError {
  constructor() {
    super(
      "Solo se pueden eliminar ventas en estado BORRADOR",
      SALE_NOT_DRAFT,
    );
    this.name = "SaleNotDraft";
  }
}

export class InvalidSaleStatusTransition extends ValidationError {
  constructor(current: string, target: string) {
    super(
      `Transición inválida: ${current} → ${target}`,
      INVALID_STATUS_TRANSITION,
      { current, target },
    );
    this.name = "InvalidSaleStatusTransition";
  }
}

export class SaleVoidedImmutable extends ValidationError {
  constructor() {
    super(
      "Una venta anulada no puede ser modificada",
      ENTRY_VOIDED_IMMUTABLE,
    );
    this.name = "SaleVoidedImmutable";
  }
}
