import { BaseRepository } from "@/features/shared/base.repository";
import type { Contact } from "@/generated/prisma/client";
import type { CreateContactInput, UpdateContactInput, ContactFilters } from "./contacts.types";

export class ContactsRepository extends BaseRepository {
  async findAll(organizationId: string, filters?: ContactFilters): Promise<Contact[]> {
    const scope = this.requireOrg(organizationId);

    return this.db.contact.findMany({
      where: {
        ...scope,
        ...(filters?.type !== undefined && { type: filters.type }),
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: "insensitive" } },
            { nit: { contains: filters.search, mode: "insensitive" } },
          ],
        }),
      },
      orderBy: { name: "asc" },
    });
  }

  async findById(organizationId: string, id: string): Promise<Contact | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.contact.findFirst({
      where: { id, ...scope },
    });
  }

  async findByNit(organizationId: string, nit: string): Promise<Contact | null> {
    const scope = this.requireOrg(organizationId);

    return this.db.contact.findFirst({
      where: { nit, ...scope },
    });
  }

  async create(organizationId: string, data: CreateContactInput): Promise<Contact> {
    const scope = this.requireOrg(organizationId);

    return this.db.contact.create({
      data: {
        organizationId: scope.organizationId,
        type: data.type,
        name: data.name,
        nit: data.nit,
        email: data.email,
        phone: data.phone,
        address: data.address,
        ...(data.paymentTermsDays !== undefined && { paymentTermsDays: data.paymentTermsDays }),
        ...(data.creditLimit !== undefined && { creditLimit: data.creditLimit }),
      },
    });
  }

  async update(
    organizationId: string,
    id: string,
    data: UpdateContactInput,
  ): Promise<Contact> {
    const scope = this.requireOrg(organizationId);

    return this.db.contact.update({
      where: { id, ...scope },
      data: {
        ...(data.type !== undefined && { type: data.type }),
        ...(data.name !== undefined && { name: data.name }),
        ...("nit" in data && { nit: data.nit }),
        ...("email" in data && { email: data.email }),
        ...("phone" in data && { phone: data.phone }),
        ...("address" in data && { address: data.address }),
        ...(data.paymentTermsDays !== undefined && { paymentTermsDays: data.paymentTermsDays }),
        ...("creditLimit" in data && { creditLimit: data.creditLimit }),
      },
    });
  }

  async deactivate(organizationId: string, id: string): Promise<Contact> {
    const scope = this.requireOrg(organizationId);

    return this.db.contact.update({
      where: { id, ...scope },
      data: { isActive: false },
    });
  }
}
