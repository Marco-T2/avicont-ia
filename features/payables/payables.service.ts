import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  makePayablesService,
  type PayablesService as InnerPayablesService,
  type Payable,
} from "@/modules/payables/presentation/server";
import type {
  PayableWithContact,
  OpenAggregate,
  CreatePayableInput,
  UpdatePayableInput,
  UpdatePayableStatusInput,
  PayableFilters,
} from "./payables.types";

/**
 * Backward-compat shim. Delegates business logic to the hexagonal
 * `modules/payables/` and re-attaches `contact` for legacy consumers
 * that expect the Prisma `PayableWithContact` shape.
 */
export class PayablesService {
  private readonly inner: InnerPayablesService;

  constructor(_contactsService?: unknown, _repo?: unknown) {
    this.inner = makePayablesService();
  }

  async list(
    organizationId: string,
    filters?: PayableFilters,
  ): Promise<PayableWithContact[]> {
    const items = await this.inner.list(organizationId, filters);
    return this.attachContacts(organizationId, items);
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<PayableWithContact> {
    const p = await this.inner.getById(organizationId, id);
    return this.attachContact(organizationId, p);
  }

  async create(
    organizationId: string,
    input: CreatePayableInput,
  ): Promise<PayableWithContact> {
    const p = await this.inner.create(organizationId, {
      ...input,
      amount: typeof input.amount === "number" || typeof input.amount === "string"
        ? input.amount
        : input.amount.toString(),
    });
    return this.attachContact(organizationId, p);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdatePayableInput & { amount?: unknown },
  ): Promise<PayableWithContact> {
    const p = await this.inner.update(organizationId, id, input);
    return this.attachContact(organizationId, p);
  }

  async updateStatus(
    organizationId: string,
    id: string,
    input: UpdatePayableStatusInput,
  ): Promise<PayableWithContact> {
    const p = await this.inner.transitionStatus(organizationId, id, {
      status: input.status,
      paidAmount: input.paidAmount === undefined
        ? undefined
        : typeof input.paidAmount === "number" || typeof input.paidAmount === "string"
          ? input.paidAmount
          : input.paidAmount.toString(),
    });
    return this.attachContact(organizationId, p);
  }

  async void(
    organizationId: string,
    id: string,
  ): Promise<PayableWithContact> {
    const p = await this.inner.void(organizationId, id);
    return this.attachContact(organizationId, p);
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
    items: Payable[],
  ): Promise<PayableWithContact[]> {
    if (items.length === 0) return [];
    const ids = [...new Set(items.map((p) => p.contactId))];
    const rows = await prisma.contact.findMany({
      where: { organizationId, id: { in: ids } },
    });
    const byId = new Map(rows.map((c) => [c.id, c]));
    return items.map((p) => this.toPayableWithContact(p, byId.get(p.contactId)!));
  }

  private async attachContact(
    organizationId: string,
    p: Payable,
  ): Promise<PayableWithContact> {
    const contact = await prisma.contact.findFirst({
      where: { id: p.contactId, organizationId },
    });
    return this.toPayableWithContact(p, contact!);
  }

  private toPayableWithContact(
    p: Payable,
    contact: PayableWithContact["contact"],
  ): PayableWithContact {
    return {
      id: p.id,
      organizationId: p.organizationId,
      contactId: p.contactId,
      description: p.description,
      amount: new Prisma.Decimal(p.amount.value),
      paid: new Prisma.Decimal(p.paid.value),
      balance: new Prisma.Decimal(p.balance.value),
      dueDate: p.dueDate,
      status: p.status as PayableWithContact["status"],
      sourceType: p.sourceType,
      sourceId: p.sourceId,
      journalEntryId: p.journalEntryId,
      notes: p.notes,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      contact,
    };
  }
}
