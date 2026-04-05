import { Prisma } from "@/generated/prisma/client";
import {
  NotFoundError,
  ConflictError,
  CONTACT_NOT_FOUND,
  CONTACT_NIT_EXISTS,
} from "@/features/shared/errors";
import { ContactsRepository } from "./contacts.repository";
import type {
  Contact,
  CreateContactInput,
  UpdateContactInput,
  ContactFilters,
  ContactBalanceSummary,
  ContactWithBalance,
} from "./contacts.types";

// ── Lazy-injected service interfaces ──
// These are defined minimally to avoid circular imports.
// Full types come from the respective feature modules.

interface OpenAggregateLike {
  totalBalance: Prisma.Decimal;
  count: number;
}

interface ReceivablesServiceLike {
  aggregateOpen(orgId: string, contactId?: string): Promise<OpenAggregateLike>;
}

interface PayablesServiceLike {
  aggregateOpen(orgId: string, contactId?: string): Promise<OpenAggregateLike>;
}

export class ContactsService {
  private readonly repo: ContactsRepository;
  private receivablesService: ReceivablesServiceLike | null = null;
  private payablesService: PayablesServiceLike | null = null;

  constructor(repo?: ContactsRepository) {
    this.repo = repo ?? new ContactsRepository();
  }

  // ── Lazy injection setters ──

  setReceivablesService(service: ReceivablesServiceLike): void {
    this.receivablesService = service;
  }

  setPayablesService(service: PayablesServiceLike): void {
    this.payablesService = service;
  }

  // ── List all contacts ──

  async list(organizationId: string, filters?: ContactFilters): Promise<Contact[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Get a single contact (throws generic NotFoundError) ──

  async getById(organizationId: string, id: string): Promise<Contact> {
    const contact = await this.repo.findById(organizationId, id);
    if (!contact) throw new NotFoundError("Contacto");
    return contact;
  }

  // ── Get an active contact (throws CONTACT_NOT_FOUND if missing or inactive) ──

  async getActiveById(organizationId: string, id: string): Promise<Contact> {
    const contact = await this.repo.findById(organizationId, id);
    if (!contact || !contact.isActive) {
      throw new NotFoundError("Contacto", CONTACT_NOT_FOUND);
    }
    return contact;
  }

  // ── Create a new contact ──

  async create(organizationId: string, input: CreateContactInput): Promise<Contact> {
    if (input.nit) {
      const existing = await this.repo.findByNit(organizationId, input.nit);
      if (existing) {
        throw new ConflictError(
          `Un contacto con el NIT ${input.nit}`,
          CONTACT_NIT_EXISTS,
        );
      }
    }

    return this.repo.create(organizationId, input);
  }

  // ── Update a contact ──

  async update(
    organizationId: string,
    id: string,
    input: UpdateContactInput,
  ): Promise<Contact> {
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Contacto");

    if (input.nit && input.nit !== existing.nit) {
      const duplicate = await this.repo.findByNit(organizationId, input.nit);
      if (duplicate && duplicate.id !== id) {
        throw new ConflictError(
          `Un contacto con el NIT ${input.nit}`,
          CONTACT_NIT_EXISTS,
        );
      }
    }

    return this.repo.update(organizationId, id, input);
  }

  // ── Deactivate a contact ──

  async deactivate(organizationId: string, id: string): Promise<Contact> {
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Contacto");

    return this.repo.deactivate(organizationId, id);
  }

  // ── Get balance summary for a contact ──

  async getBalanceSummary(
    organizationId: string,
    contactId: string,
  ): Promise<ContactBalanceSummary> {
    const zero = new Prisma.Decimal(0);

    const [receivableAgg, payableAgg] = await Promise.all([
      this.receivablesService
        ? this.receivablesService.aggregateOpen(organizationId, contactId)
        : Promise.resolve({ totalBalance: zero, count: 0 }),
      this.payablesService
        ? this.payablesService.aggregateOpen(organizationId, contactId)
        : Promise.resolve({ totalBalance: zero, count: 0 }),
    ]);

    const totalReceivable = receivableAgg.totalBalance;
    const totalPayable = payableAgg.totalBalance;

    const netPosition = totalReceivable.minus(totalPayable);

    return {
      contactId,
      totalReceivable,
      totalPayable,
      netPosition,
      openReceivableCount: receivableAgg.count,
      openPayableCount: payableAgg.count,
    };
  }

  // ── List contacts with their balance summaries ──

  async listWithBalances(
    organizationId: string,
    filters?: ContactFilters,
  ): Promise<ContactWithBalance[]> {
    const contacts = await this.repo.findAll(organizationId, filters);

    const withBalances = await Promise.all(
      contacts.map(async (contact) => {
        const balanceSummary = await this.getBalanceSummary(organizationId, contact.id);
        return { ...contact, balanceSummary };
      }),
    );

    return withBalances;
  }
}
