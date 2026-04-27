import "server-only";
import { ContactInactiveOrMissing } from "@/modules/contacts/domain/errors/contact-errors";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import type { ContactsService } from "@/modules/contacts/application/contacts.service";
import type { ContactExistencePort } from "../domain/ports/contact-existence.port";

export class ContactsExistenceAdapter implements ContactExistencePort {
  constructor(private readonly contactsService: ContactsService = makeContactsService()) {}

  async assertActive(organizationId: string, contactId: string): Promise<void> {
    await this.contactsService.getActiveById(organizationId, contactId);
  }
}

export { ContactInactiveOrMissing };
