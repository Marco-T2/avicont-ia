import { makeContactsService } from "@/modules/contacts/presentation/server";
import type { ContactsService } from "@/modules/contacts/application/contacts.service";
import type { ContactsReadPort } from "@/modules/accounting/domain/ports/contacts-read.port";

/**
 * Method pass-through wrapper sobre `ContactsService.getActiveById`.
 * Validación active+missing vive en `ContactsService` hex (via
 * `makeContactsService()` factory) — el adapter no agrega lógica.
 *
 * Constructor DI default factory pattern hex canonical adapter mirror
 * receivables/payables `contacts-existence.adapter.ts` precedent EXACT
 * (cumulative cross-module 3ra evidencia adapter pattern hex canonical).
 */
export class ContactsReadAdapter implements ContactsReadPort {
  constructor(
    private readonly contactsService: ContactsService = makeContactsService(),
  ) {}

  async getActiveById(
    organizationId: string,
    contactId: string,
  ): Promise<void> {
    await this.contactsService.getActiveById(organizationId, contactId);
  }
}
