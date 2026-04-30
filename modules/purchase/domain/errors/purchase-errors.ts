import { ValidationError } from "@/features/shared/errors";

export const INVALID_PURCHASE_STATUS = "INVALID_PURCHASE_STATUS";

export class InvalidPurchaseStatus extends ValidationError {
  constructor(value: string) {
    super(`Estado de compra inválido: ${value}`, INVALID_PURCHASE_STATUS, { value });
    this.name = "InvalidPurchaseStatus";
  }
}
