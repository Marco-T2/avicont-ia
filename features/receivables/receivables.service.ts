import "server-only";
import {
  attachContact,
  attachContacts,
  makeReceivablesService,
  type ReceivablesService as InnerReceivablesService,
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
    return attachContacts(organizationId, items);
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<ReceivableWithContact> {
    const r = await this.inner.getById(organizationId, id);
    return attachContact(organizationId, r);
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
    return attachContact(organizationId, r);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateReceivableInput & { amount?: unknown },
  ): Promise<ReceivableWithContact> {
    const r = await this.inner.update(organizationId, id, input);
    return attachContact(organizationId, r);
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
    return attachContact(organizationId, r);
  }

  async void(
    organizationId: string,
    id: string,
  ): Promise<ReceivableWithContact> {
    const r = await this.inner.void(organizationId, id);
    return attachContact(organizationId, r);
  }

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    return this.inner.aggregateOpen(organizationId, contactId);
  }
}
