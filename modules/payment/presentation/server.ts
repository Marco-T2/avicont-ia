import "server-only";

export {
  makePaymentsService,
  makePaymentsServiceForTx,
  PrismaPaymentsRepository,
  makePaymentReader,
  makePaymentServiceAdapter,
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
// barrel — internal hex consumers (modules/payment/{infrastructure,application}/)
// import the TYPE port directly from `../domain/payment.repository` per the
// cross-POC convention "domain ports stay private to the module". §13
// R-name-collision NEW invariant collision category (TS namespace shadowing
// TYPE-vs-VALUE re-export ambiguity) — cementación target D1 doc-only.
export type {
  PaymentFilters,
  UnappliedPaymentSnapshot,
  CustomerBalanceSnapshot,
} from "../domain/payment.repository";
export type { PaymentStatus } from "../domain/value-objects/payment-status";
export { PAYMENT_STATUSES } from "../domain/value-objects/payment-status";
export type { PaymentMethod } from "../domain/value-objects/payment-method";
export type { PaymentDirection } from "../domain/value-objects/payment-direction";
export type { PaymentWithRelationsReaderPort } from "../domain/ports/payment-with-relations-reader.port";
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
  PaymentNotFound,
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

// ── Adapter Layer presentation/ canonical R4 exception path EXACT mirror α-A3.B
// (paired C1b-α `89e6441` precedent) — `PaymentService` is the new presentation
// Adapter from `./payment-service.adapter`, re-exported via composition-root
// chain. Wraps inner hex `PaymentsService` + `PaymentWithRelationsReaderPort`
// DI to expose the legacy shim contract (envelope DTO + zero-arg construct +
// args reorder + WithCorrelation wrapping). §13 NEW classification cementación
// target D1.
export { PaymentService } from "./composition-root";
