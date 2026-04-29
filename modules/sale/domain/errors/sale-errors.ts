import { ValidationError } from "@/features/shared/errors";

export {
  SALE_NO_DETAILS,
  SALE_INVALID_CONTACT_TYPE,
  SALE_INCOME_ACCOUNT_REQUIRED,
  SALE_NOT_DRAFT,
  SALE_CONTACT_CHANGE_BLOCKED,
} from "@/features/shared/errors";

export const INVALID_SALE_STATUS = "INVALID_SALE_STATUS";
export const INVALID_SALE_DETAIL_LINE = "INVALID_SALE_DETAIL_LINE";

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
