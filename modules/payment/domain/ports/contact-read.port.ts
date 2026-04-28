/**
 * Read-only, tx-aware port for resolving a contact's type from the application
 * layer when payment direction cannot be derived from allocations.
 *
 * Used by `resolveDirection` (rama 3): no allocations + no explicit direction →
 * lookup contact.type → CLIENTE → COBRO / PROVEEDOR → PAGO. For any other
 * recognised type (SOCIO, TRANSPORTISTA, OTRO at the persistence layer) the
 * port returns "OTHER" and the application layer throws
 * PAYMENT_DIRECTION_REQUIRED — mirror of legacy `payment.service.ts:1316`.
 *
 * NOTE: This port intentionally does NOT validate contact existence — it
 * returns null when the contact is missing and the application layer turns
 * that into a NotFoundError. Same gap as the legacy code. The B2 existence-
 * validation gap is preserved on purpose.
 */
export type ContactType = "CLIENTE" | "PROVEEDOR" | "OTHER";

export interface ContactReadPort {
  /**
   * Returns the contact type, or null when the contact does not exist.
   * Adapters MUST map every persisted ContactType row to one of:
   *   - "CLIENTE" → COBRO direction
   *   - "PROVEEDOR" → PAGO direction
   *   - "OTHER"   → caller throws PAYMENT_DIRECTION_REQUIRED
   * Use `null` ONLY for "row not found".
   */
  findType(tx: unknown, contactId: string): Promise<ContactType | null>;
}
