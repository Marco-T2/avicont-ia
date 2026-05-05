import "server-only";

export {
  makePaymentsService,
  makePaymentsServiceForTx,
  PrismaPaymentsRepository,
} from "./composition-root";

export {
  createPaymentSchema,
  updatePaymentSchema,
  paymentFiltersSchema,
  updateAllocationsSchema,
} from "./validation";

export { Payment } from "../domain/payment.entity";
export type {
  PaymentProps,
  PaymentSnapshot,
  CreatePaymentInput,
  UpdatePaymentInput,
  AllocationDraft,
} from "../domain/payment.entity";
// `PaymentRepository` (TYPE port) intentionally NOT re-exported from this
// barrel — collision avoidance with the legacy `PaymentRepository` class
// re-exported at the bottom of this file from `@/features/payment/server` per
// Marco lock #1 Opción A (C1 cutover). Internal hex consumers
// (modules/payment/{infrastructure,application}/) import the TYPE port
// directly from `../domain/payment.repository`. Forward-applicable cross-POC:
// when hex barrel re-exports a legacy VALUE class with same name as a domain
// TYPE port, drop the TYPE port from the barrel re-export (consumers should
// import directly from domain/). §13 R-name-collision NEW invariant collision
// category (TS namespace shadowing TYPE-vs-VALUE re-export ambiguity) —
// cementación target D1 doc-only.
export type {
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

// ── Opción A canonical re-export legacy class identity (Marco lock #1 C1) ──
// Preserves DTO contract `PaymentWithRelations` defer C2 mapper centralizado
// per Marco lock L3 original. Single-direction class re-export — features →
// hex circular module import mitigated (features/payment/payment.service.ts
// imports `makePaymentsService` from this hex barrel via `inner: makePaymentsService()`
// at constructor invocation time, NO module-eval circular collision).
// PaymentService/PaymentRepository wholesale delete defer C4 wholesale per
// Marco lock L1 ESTRICTO.
export { PaymentService, PaymentRepository } from "@/features/payment/server";
