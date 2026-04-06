import { BaseRepository } from "@/features/shared/base.repository";
import type { Contact } from "@/generated/prisma/client";
import type {
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
  PendingDocument,
} from "./contacts.types";

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

  // ── Credit balance & pending documents ──

  async getCreditBalance(organizationId: string, contactId: string): Promise<number> {
    const payments = await this.db.payment.findMany({
      where: { organizationId, contactId, status: { not: "VOIDED" } },
      include: {
        allocations: {
          include: { receivable: true, payable: true },
        },
        creditSources: true,
      },
    });

    let credit = 0;
    for (const p of payments) {
      const allocated = p.allocations.reduce((sum, a) => {
        const targetVoided =
          a.receivable?.status === "VOIDED" || a.payable?.status === "VOIDED";
        return sum + (targetVoided ? 0 : Number(a.amount));
      }, 0);
      const consumed = p.creditSources.reduce((sum, c) => sum + Number(c.amount), 0);
      credit += Number(p.amount) - allocated - consumed;
    }

    return Math.max(0, credit);
  }

  async getPendingReceivables(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocument[]> {
    const receivables = await this.db.accountsReceivable.findMany({
      where: { organizationId, contactId, status: { in: ["PENDING", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        description: true,
        amount: true,
        paid: true,
        balance: true,
        dueDate: true,
        sourceType: true,
        sourceId: true,
        createdAt: true,
      },
    });

    return receivables.map((r) => ({
      id: r.id,
      type: "receivable" as const,
      description: r.description,
      amount: Number(r.amount),
      paid: Number(r.paid),
      balance: Number(r.balance),
      dueDate: r.dueDate,
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      createdAt: r.createdAt,
    }));
  }

  async getPendingPayables(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocument[]> {
    const payables = await this.db.accountsPayable.findMany({
      where: { organizationId, contactId, status: { in: ["PENDING", "PARTIAL"] } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        description: true,
        amount: true,
        paid: true,
        balance: true,
        dueDate: true,
        sourceType: true,
        sourceId: true,
        createdAt: true,
      },
    });

    return payables.map((p) => ({
      id: p.id,
      type: "payable" as const,
      description: p.description,
      amount: Number(p.amount),
      paid: Number(p.paid),
      balance: Number(p.balance),
      dueDate: p.dueDate,
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      createdAt: p.createdAt,
    }));
  }
}
