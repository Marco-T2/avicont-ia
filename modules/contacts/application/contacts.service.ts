import {
  Contact,
  type CreateContactInput,
  type UpdateContactInput,
} from "../domain/contact.entity";
import type {
  ContactFilters,
  ContactRepository,
} from "../domain/contact.repository";
import {
  ContactInactiveOrMissing,
  ContactNitDuplicate,
  ContactNotFound,
} from "../domain/errors/contact-errors";

export type CreateContactServiceInput = Omit<CreateContactInput, "organizationId">;
export type UpdateContactServiceInput = UpdateContactInput;

export class ContactsService {
  constructor(private readonly repo: ContactRepository) {}

  async list(
    organizationId: string,
    filters?: ContactFilters,
  ): Promise<Contact[]> {
    return this.repo.findAll(organizationId, filters);
  }

  async getById(organizationId: string, id: string): Promise<Contact> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new ContactNotFound();
    return found;
  }

  async getActiveById(organizationId: string, id: string): Promise<Contact> {
    const found = await this.repo.findById(organizationId, id);
    if (!found || !found.isActive) throw new ContactInactiveOrMissing();
    return found;
  }

  async create(
    organizationId: string,
    input: CreateContactServiceInput,
  ): Promise<Contact> {
    if (input.nit) {
      const duplicate = await this.repo.findByNit(organizationId, input.nit);
      if (duplicate) throw new ContactNitDuplicate(input.nit);
    }

    const contact = Contact.create({ ...input, organizationId });
    await this.repo.save(contact);
    return contact;
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateContactServiceInput,
  ): Promise<Contact> {
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) throw new ContactNotFound();

    if (input.nit && input.nit !== existing.nit) {
      const duplicate = await this.repo.findByNit(organizationId, input.nit);
      if (duplicate && duplicate.id !== id) {
        throw new ContactNitDuplicate(input.nit);
      }
    }

    const updated = existing.update(input);
    await this.repo.update(updated);
    return updated;
  }

  async deactivate(organizationId: string, id: string): Promise<Contact> {
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) throw new ContactNotFound();

    const deactivated = existing.deactivate();
    await this.repo.update(deactivated);
    return deactivated;
  }
}
