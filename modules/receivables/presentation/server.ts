import "server-only";

export {
  makeReceivablesService,
  makeReceivablesServiceForTx,
  makeReceivablesRepository,
  PrismaReceivablesRepository,
} from "./composition-root";

export {
  createReceivableSchema,
  updateReceivableSchema,
  receivableStatusSchema,
  receivableFiltersSchema,
} from "./validation";

export { Receivable } from "../domain/receivable.entity";
export type {
  ReceivableProps,
  ReceivableSnapshot,
  CreateReceivableInput,
  UpdateReceivableInput,
} from "../domain/receivable.entity";
export type {
  ReceivableRepository,
  ReceivableFilters,
  OpenAggregate,
  PendingDocumentSnapshot,
  CreateReceivableTxData,
} from "../domain/receivable.repository";
export type { ReceivableStatus } from "../domain/value-objects/receivable-status";
export { RECEIVABLE_STATUSES } from "../domain/value-objects/receivable-status";
export { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
export {
  InvalidMonetaryAmount,
  INVALID_MONETARY_AMOUNT,
} from "@/modules/shared/domain/errors/monetary-errors";
export {
  ReceivablesService,
  type CreateReceivableServiceInput,
  type UpdateReceivableStatusServiceInput,
} from "../application/receivables.service";
export type { ContactExistencePort } from "../domain/ports/contact-existence.port";
export {
  InvalidReceivableStatus,
  InvalidReceivableStatusTransition,
  PartialPaymentAmountRequired,
  ReceivableAmountImmutable,
  INVALID_RECEIVABLE_STATUS,
  PARTIAL_PAYMENT_AMOUNT_REQUIRED,
} from "../domain/errors/receivable-errors";
