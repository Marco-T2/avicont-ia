import "server-only";
import type { Contact } from "@/generated/prisma/client";
import type { PayableSnapshot } from "../domain/payable.entity";

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
} from "../domain/errors/payable-errors";

export { attachContact, attachContacts } from "./composition-root";

export type PayableSnapshotWithContact = PayableSnapshot & { contact: Contact };
