/**
 * Port consumed by the payables module to verify a contact exists and is
 * active before creating a payable. The adapter (in infrastructure/) wires
 * this to the contacts module without coupling our domain to its types.
 */
export interface ContactExistencePort {
  /** Throws ContactInactiveOrMissing when the contact is missing or deactivated. */
  assertActive(organizationId: string, contactId: string): Promise<void>;
}
