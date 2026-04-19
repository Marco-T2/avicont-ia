import "server-only";
import type { Prisma } from "@/generated/prisma/client";
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
  PendingDocument,
} from "./contacts.types";

// ── Interfaces de servicios con inyección lazy ──
// Se definen de forma mínima para evitar importaciones circulares.
// Los tipos completos provienen de los módulos de cada feature.

interface OpenAggregateLike {
  totalBalance: Prisma.Decimal | number;
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

  // ── Setters de inyección lazy ──

  setReceivablesService(service: ReceivablesServiceLike): void {
    this.receivablesService = service;
  }

  setPayablesService(service: PayablesServiceLike): void {
    this.payablesService = service;
  }

  // ── Listar todos los contactos ──

  async list(organizationId: string, filters?: ContactFilters): Promise<Contact[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Obtener un contacto individual (lanza NotFoundError genérico) ──

  async getById(organizationId: string, id: string): Promise<Contact> {
    const contact = await this.repo.findById(organizationId, id);
    if (!contact) throw new NotFoundError("Contacto");
    return contact;
  }

  // ── Obtener un contacto activo (lanza CONTACT_NOT_FOUND si no existe o está inactivo) ──

  async getActiveById(organizationId: string, id: string): Promise<Contact> {
    const contact = await this.repo.findById(organizationId, id);
    if (!contact || !contact.isActive) {
      throw new NotFoundError("Contacto", CONTACT_NOT_FOUND);
    }
    return contact;
  }

  // ── Crear un nuevo contacto ──

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

  // ── Actualizar un contacto ──

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

  // ── Desactivar un contacto ──

  async deactivate(organizationId: string, id: string): Promise<Contact> {
    const existing = await this.repo.findById(organizationId, id);
    if (!existing) throw new NotFoundError("Contacto");

    return this.repo.deactivate(organizationId, id);
  }

  // ── Saldo de crédito ──

  async getCreditBalance(organizationId: string, contactId: string): Promise<number> {
    await this.getById(organizationId, contactId);
    return this.repo.getCreditBalance(organizationId, contactId);
  }

  // ── Documentos pendientes ──

  async getPendingDocuments(
    organizationId: string,
    contactId: string,
    type: "receivable" | "payable",
  ): Promise<PendingDocument[]> {
    await this.getById(organizationId, contactId);
    if (type === "receivable") {
      return this.repo.getPendingReceivables(organizationId, contactId);
    }
    return this.repo.getPendingPayables(organizationId, contactId);
  }

  // ── Obtener resumen de saldo de un contacto ──

  async getBalanceSummary(
    organizationId: string,
    contactId: string,
  ): Promise<ContactBalanceSummary> {
    const [receivableAgg, payableAgg] = await Promise.all([
      this.receivablesService
        ? this.receivablesService.aggregateOpen(organizationId, contactId)
        : Promise.resolve({ totalBalance: 0, count: 0 }),
      this.payablesService
        ? this.payablesService.aggregateOpen(organizationId, contactId)
        : Promise.resolve({ totalBalance: 0, count: 0 }),
    ]);

    const totalReceivable = Number(receivableAgg.totalBalance);
    const totalPayable = Number(payableAgg.totalBalance);
    const netPosition = totalReceivable - totalPayable;

    return {
      contactId,
      totalReceivable,
      totalPayable,
      netPosition,
      openReceivableCount: receivableAgg.count,
      openPayableCount: payableAgg.count,
    };
  }

  // ── Listar contactos con sus resúmenes de saldo ──

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
