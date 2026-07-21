import type { AccountSubtype } from "@/modules/accounting/domain/value-objects/account-classification";

/**
 * Port for resolving AccountSubtype → human-readable Spanish label.
 *
 * Implementation lives in infrastructure/legacy-account-subtype-label.adapter.ts
 * (thin wrapper over @/modules/accounting/domain/account-subtype.utils.formatSubtypeLabel).
 * The adapter pattern insulates this module from the cross-feature dependency
 * on the legacy formatSubtypeLabel function — a future poc-accounting-account-subtype
 * cleanup can swap the wrapped target without touching this port surface.
 */
export interface AccountSubtypeLabelPort {
  formatSubtypeLabel(subtype: AccountSubtype): string;
}
