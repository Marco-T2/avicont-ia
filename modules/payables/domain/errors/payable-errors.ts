import {
  ValidationError,
  INVALID_STATUS_TRANSITION,
  PAYABLE_AMOUNT_IMMUTABLE,
} from "@/features/shared/errors";

// InvalidMonetaryAmount + INVALID_MONETARY_AMOUNT viven en
// modules/shared/domain/errors/monetary-errors (rule-of-three: receivables,
// payables, payment). Importar desde allí.
export const INVALID_PAYABLE_STATUS = "INVALID_PAYABLE_STATUS";
export const PARTIAL_PAYMENT_AMOUNT_REQUIRED = "PARTIAL_PAYMENT_AMOUNT_REQUIRED";

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

export {
  INVALID_STATUS_TRANSITION,
  PAYABLE_AMOUNT_IMMUTABLE,
};
