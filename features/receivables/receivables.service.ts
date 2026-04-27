import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  makeReceivablesService,
  type ReceivablesService as InnerReceivablesService,
  type Receivable,
} from "@/modules/receivables/presentation/server";
import type {
  ReceivableWithContact,
  OpenAggregate,
  CreateReceivableInput,
  UpdateReceivableInput,
  UpdateReceivableStatusInput,
  ReceivableFilters,
} from "./receivables.types";

/**
 * Backward-compat shim. Delegates business logic to the hexagonal
 * `modules/receivables/` and re-attaches `contact` for legacy consumers
 * that expect the Prisma `ReceivableWithContact` shape.
 */
export class ReceivablesService {
  private readonly inner: InnerReceivablesService;

  constructor(_contactsService?: unknown, _repo?: unknown) {
    this.inner = makeReceivablesService();
  }

  async list(
    organizationId: string,
    filters?: ReceivableFilters,
  ): Promise<ReceivableWithContact[]> {
    const items = await this.inner.list(organizationId, filters);
    return this.attachContacts(organizationId, items);
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<ReceivableWithContact> {
    const r = await this.inner.getById(organizationId, id);
    return this.attachContact(organizationId, r);
  }

  async create(
    organizationId: string,
    input: CreateReceivableInput,
  ): Promise<ReceivableWithContact> {
    const r = await this.inner.create(organizationId, {
      ...input,
      amount: typeof input.amount === "number" || typeof input.amount === "string"
        ? input.amount
        : input.amount.toString(),
    });
    return this.attachContact(organizationId, r);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateReceivableInput & { amount?: unknown },
  ): Promise<ReceivableWithContact> {
    const r = await this.inner.update(organizationId, id, input);
    return this.attachContact(organizationId, r);
  }

  async updateStatus(
    organizationId: string,
    id: string,
    input: UpdateReceivableStatusInput,
  ): Promise<ReceivableWithContact> {
    const r = await this.inner.transitionStatus(organizationId, id, {
      status: input.status,
      paidAmount: input.paidAmount === undefined
        ? undefined
        : typeof input.paidAmount === "number" || typeof input.paidAmount === "string"
          ? input.paidAmount
          : input.paidAmount.toString(),
    });
    return this.attachContact(organizationId, r);
  }

  async void(
    organizationId: string,
    id: string,
  ): Promise<ReceivableWithContact> {
    const r = await this.inner.void(organizationId, id);
    return this.attachContact(organizationId, r);
  }

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    return this.inner.aggregateOpen(organizationId, contactId);
  }

  // ── helpers ──

  private async attachContacts(
    organizationId: string,
    items: Receivable[],
  ): Promise<ReceivableWithContact[]> {
    if (items.length === 0) return [];
    const ids = [...new Set(items.map((r) => r.contactId))];
    const rows = await prisma.contact.findMany({
      where: { organizationId, id: { in: ids } },
    });
    const byId = new Map(rows.map((c) => [c.id, c]));
    return items.map((r) => this.toReceivableWithContact(r, byId.get(r.contactId)!));
  }

  private async attachContact(
    organizationId: string,
    r: Receivable,
  ): Promise<ReceivableWithContact> {
    const contact = await prisma.contact.findFirst({
      where: { id: r.contactId, organizationId },
    });
    return this.toReceivableWithContact(r, contact!);
  }

  private toReceivableWithContact(
    r: Receivable,
    contact: ReceivableWithContact["contact"],
  ): ReceivableWithContact {
    return {
      id: r.id,
      organizationId: r.organizationId,
      contactId: r.contactId,
      description: r.description,
      amount: new Prisma.Decimal(r.amount.value),
      paid: new Prisma.Decimal(r.paid.value),
      balance: new Prisma.Decimal(r.balance.value),
      dueDate: r.dueDate,
      status: r.status as ReceivableWithContact["status"],
      sourceType: r.sourceType,
      sourceId: r.sourceId,
      journalEntryId: r.journalEntryId,
      notes: r.notes,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      contact,
    };
  }
}
