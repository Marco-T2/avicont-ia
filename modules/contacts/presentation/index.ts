// Isomorphic barrel — safe for client and server. Server-only state lives
// behind `./server`. Validation schemas are isomorphic.

export {
  createContactSchema,
  updateContactSchema,
  contactFiltersSchema,
} from "./contact.validation";

export {
  CONTACT_TYPES,
  type ContactType,
} from "../domain/value-objects/contact-type";
