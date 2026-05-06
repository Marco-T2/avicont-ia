// Isomorphic barrel — safe for client and server. Server-only state lives
// behind `./server`. Validation schemas are isomorphic.

import type { Contact } from "@/generated/prisma/client";
import type { ContactBalanceSummary } from "@/modules/contact-balances/presentation/index";

export {
  createContactSchema,
  updateContactSchema,
  contactFiltersSchema,
} from "./contact.validation";

export {
  CONTACT_TYPES,
  type ContactType,
} from "../domain/value-objects/contact-type";

// Prisma POJO row type — isomorphic-safe scalar shape consumed by client
// components. Mirror EXACT precedent `features/contacts/contacts.types.ts:1`
// (legacy barrel transitorio C4→C5). Distinct from server-only Entity class
// `Contact` exported from `./server` (same name, different shape — Entity has
// methods + VOs, this is Prisma scalar POJO).
export type { Contact };

// Re-export of POJO `ContactFilters` interface from hex domain repository.
// Same shape as legacy `features/contacts/contacts.types.ts:33-41` (POJO
// scalar `type/excludeTypes/isActive/search`).
export type { ContactFilters } from "../domain/contact.repository";

// Flat POJO `ContactWithBalance` for client consumers — Prisma `Contact` +
// `balanceSummary` mixed shape. Mirror EXACT precedent
// `features/contacts/contacts.types.ts:54-56`. Distinct from hex application
// nested `{ contact: Entity, balanceSummary }` exported from
// `@/modules/contact-balances/presentation/server`. The flatten adapter that
// produces this shape is promoted to hex presentation in C5 (defer Marco lock
// Q2.1 split sub-cycle VALUE-axis cutover).
export interface ContactWithBalance extends Contact {
  balanceSummary: ContactBalanceSummary;
}
