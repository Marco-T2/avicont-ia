import "server-only";
import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import type {
  ContactFilters,
  ContactRepository,
} from "../domain/contact.repository";
import type { Contact } from "../domain/contact.entity";
import {
  toDomain,
  toPersistenceCreate,
  toPersistenceUpdate,
} from "./contact.mapper";

type DbClient = Pick<PrismaClient, "contact">;

export class PrismaContactRepository implements ContactRepository {
  constructor(private readonly db: DbClient = prisma) {}

  withTransaction(tx: Prisma.TransactionClient): PrismaContactRepository {
    return new PrismaContactRepository(tx as unknown as DbClient);
  }

  async findAll(
    organizationId: string,
    filters: ContactFilters = {},
  ): Promise<Contact[]> {
    const where: Prisma.ContactWhereInput = {
      organizationId,
      ...(filters.type !== undefined && { type: filters.type }),
      ...(filters.excludeTypes !== undefined &&
        filters.excludeTypes.length > 0 && {
          type: { notIn: filters.excludeTypes },
        }),
      ...(filters.isActive !== undefined && { isActive: filters.isActive }),
      ...(filters.search && {
        OR: [
          { name: { contains: filters.search, mode: "insensitive" } },
          { nit: { contains: filters.search, mode: "insensitive" } },
        ],
      }),
    };

    const rows = await this.db.contact.findMany({
      where,
      orderBy: { name: "asc" },
    });
    return rows.map(toDomain);
  }

  async findById(organizationId: string, id: string): Promise<Contact | null> {
    const row = await this.db.contact.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async findByNit(
    organizationId: string,
    nit: string,
  ): Promise<Contact | null> {
    const row = await this.db.contact.findFirst({
      where: { nit, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async save(contact: Contact): Promise<void> {
    await this.db.contact.create({ data: toPersistenceCreate(contact) });
  }

  async update(contact: Contact): Promise<void> {
    await this.db.contact.update({
      where: { id: contact.id, organizationId: contact.organizationId },
      data: toPersistenceUpdate(contact),
    });
  }
}
