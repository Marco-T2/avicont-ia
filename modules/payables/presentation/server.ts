import "server-only";

export {
  makePayablesService,
  makePayablesServiceForTx,
  makePayablesRepository,
  PrismaPayablesRepository,
} from "./composition-root";

export {
  createPayableSchema,
  updatePayableSchema,
  payableStatusSchema,
  payableFiltersSchema,
} from "./validation";

export { Payable } from "../domain/payable.entity";
export type {
  PayableProps,
  PayableSnapshot,
  CreatePayableInput,
  UpdatePayableInput,
} from "../domain/payable.entity";
export type {
  PayableRepository,
  PayableFilters,
  OpenAggregate,
  PendingDocumentSnapshot,
  CreatePayableTxData,
} from "../domain/payable.repository";
export type { PayableStatus } from "../domain/value-objects/payable-status";
export { PAYABLE_STATUSES } from "../domain/value-objects/payable-status";
export { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
export {
  InvalidMonetaryAmount,
  INVALID_MONETARY_AMOUNT,
} from "@/modules/shared/domain/errors/monetary-errors";
export {
  PayablesService,
  type CreatePayableServiceInput,
  type UpdatePayableStatusServiceInput,
} from "../application/payables.service";
export type { ContactExistencePort } from "../domain/ports/contact-existence.port";
export {
  InvalidPayableStatus,
  InvalidPayableStatusTransition,
  PartialPaymentAmountRequired,
  PayableAmountImmutable,
  INVALID_PAYABLE_STATUS,
  PARTIAL_PAYMENT_AMOUNT_REQUIRED,
} from "../domain/errors/payable-errors";
