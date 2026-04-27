export interface ContactExistencePort {
  assertExists(organizationId: string, contactId: string): Promise<void>;
}
