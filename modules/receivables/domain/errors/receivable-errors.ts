import {
  ValidationError,
  INVALID_STATUS_TRANSITION,
  RECEIVABLE_AMOUNT_IMMUTABLE,
} from "@/features/shared/errors";

export const INVALID_MONETARY_AMOUNT = "INVALID_MONETARY_AMOUNT";
export const INVALID_RECEIVABLE_STATUS = "INVALID_RECEIVABLE_STATUS";
export const PARTIAL_PAYMENT_AMOUNT_REQUIRED = "PARTIAL_PAYMENT_AMOUNT_REQUIRED";

export class InvalidMonetaryAmount extends ValidationError {
  constructor(message: string) {
    super(message, INVALID_MONETARY_AMOUNT);
  }
}

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

export {
  INVALID_STATUS_TRANSITION,
  RECEIVABLE_AMOUNT_IMMUTABLE,
};
