import { formatSubtypeLabel as formatSubtypeLabelImpl } from "@/modules/accounting/domain/account-subtype.utils";
import type { AccountSubtypeLabelPort } from "../domain/ports/account-subtype-label.port";
import type { AccountSubtype } from "@/generated/prisma/enums";

/**
 * Adapter wrapping the canonical formatSubtypeLabel from
 * @/modules/accounting/domain/account-subtype.utils (already canonical home —
 * features/accounting/account-subtype.utils is a 2-line re-export alias).
 *
 * Implements AccountSubtypeLabelPort per design §6:
 * - AccountSubtype is a Prisma-generated enum (R5: lives in infrastructure/,
 *   not domain/) — adapter encapsulates the Prisma enum binding.
 * - Future poc-accounting-account-subtype-hex can swap the wrapped import
 *   without touching this adapter's port signature.
 *
 * Single-line wrap: trivial by design (not aspirational — the canonical
 * function already lives in the correct canonical home).
 */
export class LegacyAccountSubtypeLabelAdapter implements AccountSubtypeLabelPort {
  formatSubtypeLabel(subtype: AccountSubtype): string {
    return formatSubtypeLabelImpl(subtype);
  }
}
