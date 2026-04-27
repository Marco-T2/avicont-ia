import type { Contact } from "./contact.entity";
import type { ContactType } from "./value-objects/contact-type";

export interface ContactFilters {
  type?: ContactType;
  excludeTypes?: ContactType[];
  isActive?: boolean;
  search?: string;
}

export interface ContactRepository {
  findAll(organizationId: string, filters?: ContactFilters): Promise<Contact[]>;
  findById(organizationId: string, id: string): Promise<Contact | null>;
  findByNit(organizationId: string, nit: string): Promise<Contact | null>;
  save(contact: Contact): Promise<void>;
  update(contact: Contact): Promise<void>;
}
