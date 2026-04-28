import "server-only";

export {
  makePaymentsService,
  makePaymentsServiceForTx,
  PrismaPaymentsRepository,
} from "./composition-root";

export { Payment } from "../domain/payment.entity";
export type {
  PaymentProps,
  PaymentSnapshot,
  CreatePaymentInput,
  UpdatePaymentInput,
  AllocationDraft,
} from "../domain/payment.entity";
export type {
  PaymentRepository,
  PaymentFilters,
  UnappliedPaymentSnapshot,
  CustomerBalanceSnapshot,
} from "../domain/payment.repository";
export type { PaymentStatus } from "../domain/value-objects/payment-status";
export { PAYMENT_STATUSES } from "../domain/value-objects/payment-status";
export type { PaymentMethod } from "../domain/value-objects/payment-method";
export type { PaymentDirection } from "../domain/value-objects/payment-direction";
export { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
export {
  InvalidMonetaryAmount,
  INVALID_MONETARY_AMOUNT,
} from "@/modules/shared/domain/errors/monetary-errors";
export {
  InvalidPaymentStatus,
  InvalidPaymentStatusTransition,
  InvalidPaymentMethod,
  InvalidPaymentDirection,
  AllocationMustBePositive,
  AllocationTargetRequired,
  AllocationTargetMutuallyExclusive,
  PaymentMixedAllocation,
  PaymentAllocationsExceedTotal,
  CannotModifyVoidedPayment,
  INVALID_PAYMENT_STATUS,
  INVALID_PAYMENT_METHOD,
  INVALID_PAYMENT_DIRECTION,
  PAYMENT_ALLOCATION_MUST_BE_POSITIVE,
  PAYMENT_ALLOCATION_TARGET_REQUIRED,
  PAYMENT_ALLOCATION_TARGET_EXCLUSIVE,
  PAYMENT_VOIDED_IMMUTABLE,
} from "../domain/errors/payment-errors";
export {
  PaymentsService,
  type PaymentsServiceDeps,
  type CreatePaymentServiceInput,
  type UpdatePaymentServiceInput,
  type AllocationInput,
  type CreditAllocationSource,
  type PaymentResult,
} from "../application/payments.service";
