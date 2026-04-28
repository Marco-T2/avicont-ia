/**
 * Read-only port for contacts. Non-tx — contact existence and active status
 * are checked BEFORE the UoW tx opens (parity with legacy
 * `contactsService.getActiveById` calls in `journal.service.ts:486`).
 *
 * Divergence note vs `modules/payment/domain/ports/contact-read.port.ts`:
 * payment's port is tx-aware and returns `ContactType | null` (used for
 * direction resolution); accounting's port is non-tx and throws on miss /
 * inactive. Different semantics — the two ports cannot be unified without
 * splitting concerns. Promotion to shared/ is not trivial.
 */
export interface ContactsReadPort {
  /**
   * Resolves the contact and asserts it exists + is active. Adapters MUST
   * throw `ValidationError` with code `CONTACT_NOT_FOUND` (parity with
   * legacy `contactsService.getActiveById`) when the contact is missing or
   * inactive. Returns void on success — the use case just needs the
   * existence assertion, not the contact data.
   */
  getActiveById(organizationId: string, contactId: string): Promise<void>;
}
