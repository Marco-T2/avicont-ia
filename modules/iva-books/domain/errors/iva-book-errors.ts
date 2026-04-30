import { ValidationError } from "@/features/shared/errors";

export const INVALID_IVA_BOOK_STATUS = "INVALID_IVA_BOOK_STATUS";
export const INVALID_IVA_SALES_ESTADO_SIN = "INVALID_IVA_SALES_ESTADO_SIN";
export const INVALID_IVA_CALC_RESULT = "INVALID_IVA_CALC_RESULT";

export class InvalidIvaBookStatus extends ValidationError {
  constructor(value: string) {
    super(`Estado de Libro IVA inválido: ${value}`, INVALID_IVA_BOOK_STATUS, {
      value,
    });
    this.name = "InvalidIvaBookStatus";
  }
}

export class InvalidIvaSalesEstadoSIN extends ValidationError {
  constructor(value: string) {
    super(
      `Estado SIN inválido para Libro IVA Ventas: ${value}`,
      INVALID_IVA_SALES_ESTADO_SIN,
      { value },
    );
    this.name = "InvalidIvaSalesEstadoSIN";
  }
}

export class InvalidIvaCalcResult extends ValidationError {
  constructor(reason: string, context?: Record<string, unknown>) {
    super(
      `Resultado de cálculo IVA inválido: ${reason}`,
      INVALID_IVA_CALC_RESULT,
      context,
    );
    this.name = "InvalidIvaCalcResult";
  }
}
