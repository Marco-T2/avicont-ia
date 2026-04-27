// Isomorphic barrel — safe for client and server. Server-only state lives
// behind `./server`. Validation schemas come from the hexagonal module.

export * from "./contacts.types";
export {
  createContactSchema,
  updateContactSchema,
  contactFiltersSchema,
} from "@/modules/contacts/presentation/index";
