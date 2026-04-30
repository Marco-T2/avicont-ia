import { ValidationError } from "@/features/shared/errors";

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
