import {
  ValidationError,
  INVALID_STATUS_TRANSITION,
  PAYABLE_AMOUNT_IMMUTABLE,
  PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
  PAYMENT_ALLOCATION_TARGET_VOIDED,
} from "@/features/shared/errors";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

// InvalidMonetaryAmount + INVALID_MONETARY_AMOUNT viven en
// modules/shared/domain/errors/monetary-errors (rule-of-three: receivables,
// payables, payment). Importar desde allí.
export const INVALID_PAYABLE_STATUS = "INVALID_PAYABLE_STATUS";
export const ALLOCATION_MUST_BE_POSITIVE = "ALLOCATION_MUST_BE_POSITIVE";
export const REVERT_MUST_BE_POSITIVE = "REVERT_MUST_BE_POSITIVE";
export const REVERT_EXCEEDS_PAID = "REVERT_EXCEEDS_PAID";
export const CANNOT_REVERT_ON_VOIDED_PAYABLE = "CANNOT_REVERT_ON_VOIDED_PAYABLE";

export class InvalidPayableStatus extends ValidationError {
  constructor(value: string) {
    super(`Estado de cuenta por pagar inválido: ${value}`, INVALID_PAYABLE_STATUS);
  }
}

export class InvalidPayableStatusTransition extends ValidationError {
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

export class PayableAmountImmutable extends ValidationError {
  constructor() {
    super(
      "El monto de una cuenta por pagar no puede modificarse",
      PAYABLE_AMOUNT_IMMUTABLE,
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
      `La asignación (${amount.value}) excede el saldo disponible (${balance.value}) de la CxP`,
      PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
    );
  }
}

export class RevertExceedsPaid extends ValidationError {
  constructor() {
    super(
      "La reversión excede el monto pagado de la cuenta por pagar",
      REVERT_EXCEEDS_PAID,
    );
  }
}

export class CannotApplyToVoidedPayable extends ValidationError {
  constructor() {
    super(
      "No se puede aplicar pago a una cuenta por pagar anulada",
      PAYMENT_ALLOCATION_TARGET_VOIDED,
    );
  }
}

export class CannotRevertOnVoidedPayable extends ValidationError {
  constructor() {
    super(
      "No se puede revertir un pago sobre una cuenta por pagar anulada",
      CANNOT_REVERT_ON_VOIDED_PAYABLE,
    );
  }
}

export {
  INVALID_STATUS_TRANSITION,
  PAYABLE_AMOUNT_IMMUTABLE,
  PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
  PAYMENT_ALLOCATION_TARGET_VOIDED,
};
