import "server-only";
import type { Contact } from "@/generated/prisma/client";
import type { ReceivableSnapshot } from "../domain/receivable.entity";

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
} from "../domain/errors/receivable-errors";

export { attachContact, attachContacts } from "./composition-root";

export type ReceivableSnapshotWithContact = ReceivableSnapshot & { contact: Contact };
