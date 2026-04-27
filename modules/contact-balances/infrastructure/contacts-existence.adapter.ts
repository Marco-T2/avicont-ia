import "server-only";
import type { ContactExistencePort } from "../domain/ports/contact-existence.port";
import type { ContactsService } from "@/modules/contacts/application/contacts.service";

export class ContactsExistenceAdapter implements ContactExistencePort {
  constructor(private readonly contacts: ContactsService) {}

  async assertExists(organizationId: string, contactId: string): Promise<void> {
    await this.contacts.getById(organizationId, contactId);
  }
}
