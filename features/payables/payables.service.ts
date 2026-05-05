import "server-only";
import {
  attachContact,
  attachContacts,
  makePayablesService,
  type PayablesService as InnerPayablesService,
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
    return attachContacts(organizationId, items);
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<PayableWithContact> {
    const p = await this.inner.getById(organizationId, id);
    return attachContact(organizationId, p);
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
    return attachContact(organizationId, p);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdatePayableInput & { amount?: unknown },
  ): Promise<PayableWithContact> {
    const p = await this.inner.update(organizationId, id, input);
    return attachContact(organizationId, p);
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
    return attachContact(organizationId, p);
  }

  async void(
    organizationId: string,
    id: string,
  ): Promise<PayableWithContact> {
    const p = await this.inner.void(organizationId, id);
    return attachContact(organizationId, p);
  }

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    return this.inner.aggregateOpen(organizationId, contactId);
  }
}
