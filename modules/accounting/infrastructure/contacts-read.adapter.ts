import { ContactsService } from "@/features/contacts/server";
import type { ContactsReadPort } from "@/modules/accounting/domain/ports/contacts-read.port";

const legacyContactsService = new ContactsService();

/**
 * Method pass-through wrapper sobre `ContactsService.getActiveById`.
 * Validación active+missing vive en `ContactsService` legacy — el adapter no agrega lógica.
 */
export class ContactsReadAdapter implements ContactsReadPort {
  async getActiveById(
    organizationId: string,
    contactId: string,
  ): Promise<void> {
    await legacyContactsService.getActiveById(organizationId, contactId);
  }
}
