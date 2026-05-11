import "server-only";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import type {
  DispatchContactsPort,
  DispatchContact,
} from "../domain/ports/dispatch-contacts.port";

/**
 * Legacy adapter: wraps ContactsService for dispatch contact validation.
 */
export class LegacyContactsAdapter implements DispatchContactsPort {
  private readonly service: ReturnType<typeof makeContactsService>;

  constructor() {
    this.service = makeContactsService();
  }

  async getActiveById(
    organizationId: string,
    contactId: string,
  ): Promise<DispatchContact> {
    const contact = await this.service.getActiveById(organizationId, contactId);
    return {
      id: contact.id,
      name: contact.name,
      type: contact.type,
      paymentTermsDays: (contact as { paymentTermsDays?: number | null }).paymentTermsDays ?? null,
    };
  }
}
