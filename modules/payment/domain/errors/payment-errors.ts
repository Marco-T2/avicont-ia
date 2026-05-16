import {
  ValidationError,
  NotFoundError,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
  PAYMENT_DATE_OUTSIDE_PERIOD,
  PAYMENT_MIXED_ALLOCATION,
  PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
} from "@/features/shared/errors";

// InvalidMonetaryAmount + INVALID_MONETARY_AMOUNT viven en
// modules/shared/domain/errors/monetary-errors (rule-of-three: receivables,
// payables, payment). Importar desde allí.

export const INVALID_PAYMENT_STATUS = "INVALID_PAYMENT_STATUS";
export const INVALID_PAYMENT_METHOD = "INVALID_PAYMENT_METHOD";
export const INVALID_PAYMENT_DIRECTION = "INVALID_PAYMENT_DIRECTION";
export const PAYMENT_ALLOCATION_MUST_BE_POSITIVE =
  "PAYMENT_ALLOCATION_MUST_BE_POSITIVE";
export const PAYMENT_ALLOCATION_TARGET_REQUIRED =
  "PAYMENT_ALLOCATION_TARGET_REQUIRED";
export const PAYMENT_ALLOCATION_TARGET_EXCLUSIVE =
  "PAYMENT_ALLOCATION_TARGET_EXCLUSIVE";
/**
 * Module-internal alias for the legacy shared `ENTRY_VOIDED_IMMUTABLE` code.
 * Kept exported for symmetry with the other module-error constant exports —
 * but `CannotModifyVoidedPayment` itself emits `ENTRY_VOIDED_IMMUTABLE` so the
 * shim and consumers see the SAME wire code as legacy
 * (features/shared/document-lifecycle.service.ts validateDraftOnly /
 * validateTransition first branch). Legacy parity audit C2-FIX-2.
 */
export const PAYMENT_VOIDED_IMMUTABLE = ENTRY_VOIDED_IMMUTABLE;

export class InvalidPaymentStatus extends ValidationError {
  constructor(value: string) {
    super(`Estado de pago inválido: ${value}`, INVALID_PAYMENT_STATUS);
  }
}

export class InvalidPaymentStatusTransition extends ValidationError {
  constructor(from: string, to: string) {
    super(
      `La transición de estado de pago de ${from} a ${to} no está permitida`,
      INVALID_STATUS_TRANSITION,
    );
  }
}

export class InvalidPaymentMethod extends ValidationError {
  constructor(value: string) {
    super(`Método de pago inválido: ${value}`, INVALID_PAYMENT_METHOD);
  }
}

export class InvalidPaymentDirection extends ValidationError {
  constructor(value: string) {
    super(`Dirección de pago inválida: ${value}`, INVALID_PAYMENT_DIRECTION);
  }
}

export class AllocationMustBePositive extends ValidationError {
  constructor() {
    super(
      "El monto de la asignación debe ser mayor que cero",
      PAYMENT_ALLOCATION_MUST_BE_POSITIVE,
    );
  }
}

export class AllocationTargetRequired extends ValidationError {
  constructor() {
    super(
      "Cada asignación debe vincular a una CxC o CxP",
      PAYMENT_ALLOCATION_TARGET_REQUIRED,
    );
  }
}

export class AllocationTargetMutuallyExclusive extends ValidationError {
  constructor() {
    super(
      "Una asignación no puede vincular CxC y CxP a la vez",
      PAYMENT_ALLOCATION_TARGET_EXCLUSIVE,
    );
  }
}

export class PaymentMixedAllocation extends ValidationError {
  constructor() {
    super(
      "Todas las asignaciones deben ser del mismo tipo (CxC o CxP), no se pueden mezclar",
      PAYMENT_MIXED_ALLOCATION,
    );
  }
}

export class PaymentAllocationsExceedTotal extends ValidationError {
  constructor() {
    super(
      "La suma de asignaciones excede el monto total del pago",
      PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
    );
  }
}

export class CannotModifyVoidedPayment extends ValidationError {
  constructor() {
    // Mirror legacy shared message used by validateDraftOnly /
    // validateTransition first branch — keeps the wire-format identical so
    // the shim is a thin pass-through.
    super(
      "Un documento anulado no puede ser modificado",
      ENTRY_VOIDED_IMMUTABLE,
    );
  }
}

export class PaymentNotFound extends NotFoundError {
  constructor() {
    super("Pago");
    this.name = "PaymentNotFound";
  }
}

// I12 — la fecha del pago/cobro DEBE caer en [period.startDate, period.endDate].
// Mismo invariante familia date-outside-period — cierra el gap de coherencia
// date↔período. El use case ya valida period status (assertPeriodOpen) pero
// no exigía coherencia date∈período.
export class PaymentDateOutsidePeriod extends ValidationError {
  constructor(date: Date, periodName: string) {
    super(
      `La fecha del pago (${date.toISOString().slice(0, 10)}) está fuera del período ${periodName}`,
      PAYMENT_DATE_OUTSIDE_PERIOD,
      { date: date.toISOString().slice(0, 10), periodName },
    );
    this.name = "PaymentDateOutsidePeriod";
  }
}

export {
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
  PAYMENT_DATE_OUTSIDE_PERIOD,
  PAYMENT_MIXED_ALLOCATION,
  PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
};
