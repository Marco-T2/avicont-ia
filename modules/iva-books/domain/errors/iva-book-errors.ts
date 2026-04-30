import {
  ValidationError,
  NotFoundError,
  ConflictError,
  FISCAL_PERIOD_CLOSED,
} from "@/features/shared/errors";

export { FISCAL_PERIOD_CLOSED };

export const INVALID_IVA_BOOK_STATUS = "INVALID_IVA_BOOK_STATUS";
export const INVALID_IVA_SALES_ESTADO_SIN = "INVALID_IVA_SALES_ESTADO_SIN";
export const INVALID_IVA_CALC_RESULT = "INVALID_IVA_CALC_RESULT";
export const IVA_BOOK_DUPLICATE = "IVA_BOOK_DUPLICATE";
export const IVA_BOOK_REACTIVATE_NON_VOIDED = "IVA_BOOK_REACTIVATE_NON_VOIDED";

type EntityType = "sale" | "purchase";

const ENTRY_NAME: Record<EntityType, string> = {
  sale: "Entrada de Libro de Ventas",
  purchase: "Entrada de Libro de Compras",
};

const DOCUMENT_NAME: Record<EntityType, string> = {
  sale: "venta",
  purchase: "compra",
};

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

export class IvaBookFiscalPeriodClosed extends ValidationError {
  constructor(input: { entityType: EntityType; operation: "create" | "modify" }) {
    const verb = input.operation === "create" ? "crear" : "modificar";
    super(
      `No se puede ${verb} el Libro IVA de una ${DOCUMENT_NAME[input.entityType]} contabilizada con período cerrado`,
      FISCAL_PERIOD_CLOSED,
      { entityType: input.entityType, operation: input.operation },
    );
    this.name = "IvaBookFiscalPeriodClosed";
  }
}

export class IvaBookNotFound extends NotFoundError {
  constructor(entityType: EntityType) {
    super(ENTRY_NAME[entityType]);
    this.name = "IvaBookNotFound";
  }
}

export class IvaBookConflict extends ConflictError {
  constructor(entityType: EntityType, cause?: unknown) {
    super(ENTRY_NAME[entityType], IVA_BOOK_DUPLICATE, { entityType }, cause);
    this.name = "IvaBookConflict";
  }
}

export class IvaBookReactivateNonVoided extends ValidationError {
  constructor(entityType: EntityType) {
    super(
      `${ENTRY_NAME[entityType]} ya está activa (status !== VOIDED)`,
      IVA_BOOK_REACTIVATE_NON_VOIDED,
      { entityType },
    );
    this.name = "IvaBookReactivateNonVoided";
  }
}
