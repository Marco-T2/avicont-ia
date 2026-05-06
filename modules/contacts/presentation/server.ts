import "server-only";

export {
  makeContactsService,
  makeContactsServiceForTx,
} from "./composition-root";
export {
  createContactSchema,
  updateContactSchema,
  contactFiltersSchema,
} from "./contact.validation";

export { ContactsService } from "@/features/contacts/server";

export { Contact } from "../domain/contact.entity";
export type {
  ContactProps,
  ContactSnapshot,
  CreateContactInput,
  UpdateContactInput,
} from "../domain/contact.entity";
export type {
  ContactFilters,
  ContactRepository,
} from "../domain/contact.repository";
export {
  CONTACT_TYPES,
  parseContactType,
  type ContactType,
} from "../domain/value-objects/contact-type";
export { Nit } from "../domain/value-objects/nit";
export { PaymentTermsDays } from "../domain/value-objects/payment-terms-days";
export { CreditLimit } from "../domain/value-objects/credit-limit";
export {
  ContactNotFound,
  ContactInactiveOrMissing,
  ContactNitDuplicate,
  InvalidContactType,
  InvalidNitFormat,
  InvalidPaymentTermsDays,
  InvalidCreditLimit,
  CONTACT_NIT_EXISTS,
  CONTACT_NOT_FOUND,
  INVALID_CONTACT_TYPE,
  INVALID_NIT_FORMAT,
  INVALID_PAYMENT_TERMS_DAYS,
  INVALID_CREDIT_LIMIT,
} from "../domain/errors/contact-errors";
