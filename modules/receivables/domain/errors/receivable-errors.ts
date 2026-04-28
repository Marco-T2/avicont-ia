import {
  ValidationError,
  INVALID_STATUS_TRANSITION,
  RECEIVABLE_AMOUNT_IMMUTABLE,
  PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
  PAYMENT_ALLOCATION_TARGET_VOIDED,
} from "@/features/shared/errors";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

// InvalidMonetaryAmount + INVALID_MONETARY_AMOUNT viven en
// modules/shared/domain/errors/monetary-errors (rule-of-three: receivables,
// payables, payment). Importar desde allí.
export const INVALID_RECEIVABLE_STATUS = "INVALID_RECEIVABLE_STATUS";
export const ALLOCATION_MUST_BE_POSITIVE = "ALLOCATION_MUST_BE_POSITIVE";
export const REVERT_MUST_BE_POSITIVE = "REVERT_MUST_BE_POSITIVE";
export const REVERT_EXCEEDS_PAID = "REVERT_EXCEEDS_PAID";
export const CANNOT_REVERT_ON_VOIDED_RECEIVABLE = "CANNOT_REVERT_ON_VOIDED_RECEIVABLE";

export class InvalidReceivableStatus extends ValidationError {
  constructor(value: string) {
    super(`Estado de cuenta por cobrar inválido: ${value}`, INVALID_RECEIVABLE_STATUS);
  }
}

export class InvalidReceivableStatusTransition extends ValidationError {
  constructor(from: string, to: string) {
    super(
      `La transición de estado de ${from} a ${to} no está permitida`,
      INVALID_STATUS_TRANSITION,
    );
  }
}

export class PartialPaymentAmountRequired extends ValidationError {
  constructor() {
    super(
      "Debe indicar el monto pagado para el estado PARTIAL",
      INVALID_STATUS_TRANSITION,
    );
  }
}

export class ReceivableAmountImmutable extends ValidationError {
  constructor() {
    super(
      "El monto de una cuenta por cobrar no puede modificarse",
      RECEIVABLE_AMOUNT_IMMUTABLE,
    );
  }
}

export class AllocationMustBePositive extends ValidationError {
  constructor() {
    super(
      "El monto a aplicar debe ser mayor que cero",
      ALLOCATION_MUST_BE_POSITIVE,
    );
  }
}

export class RevertMustBePositive extends ValidationError {
  constructor() {
    super(
      "El monto a revertir debe ser mayor que cero",
      REVERT_MUST_BE_POSITIVE,
    );
  }
}

export class AllocationExceedsBalance extends ValidationError {
  constructor(amount: MonetaryAmount, balance: MonetaryAmount) {
    super(
      `La asignación (${amount.value}) excede el saldo disponible (${balance.value}) de la CxC`,
      PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
    );
  }
}

export class RevertExceedsPaid extends ValidationError {
  constructor() {
    super(
      "La reversión excede el monto pagado de la cuenta por cobrar",
      REVERT_EXCEEDS_PAID,
    );
  }
}

export class CannotApplyToVoidedReceivable extends ValidationError {
  constructor() {
    super(
      "No se puede aplicar pago a una cuenta por cobrar anulada",
      PAYMENT_ALLOCATION_TARGET_VOIDED,
    );
  }
}

export class CannotRevertOnVoidedReceivable extends ValidationError {
  constructor() {
    super(
      "No se puede revertir un pago sobre una cuenta por cobrar anulada",
      CANNOT_REVERT_ON_VOIDED_RECEIVABLE,
    );
  }
}

export {
  INVALID_STATUS_TRANSITION,
  RECEIVABLE_AMOUNT_IMMUTABLE,
  PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
  PAYMENT_ALLOCATION_TARGET_VOIDED,
};
