import { NotFoundError } from "@/features/shared/errors";
import {
  Receivable,
  type CreateReceivableInput,
  type UpdateReceivableInput,
} from "../domain/receivable.entity";
import {
  type ReceivableRepository,
  type ReceivableFilters,
  type OpenAggregate,
  type PendingDocumentSnapshot,
} from "../domain/receivable.repository";
import { ReceivableAmountImmutable } from "../domain/errors/receivable-errors";
import type { ReceivableStatus } from "../domain/value-objects/receivable-status";
import type { ContactExistencePort } from "../domain/ports/contact-existence.port";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

export type CreateReceivableServiceInput = Omit<CreateReceivableInput, "organizationId">;

export interface UpdateReceivableStatusServiceInput {
  status: ReceivableStatus;
  paidAmount?: number | string;
}

export class ReceivablesService {
  constructor(
    private readonly repo: ReceivableRepository,
    private readonly contacts: ContactExistencePort,
  ) {}

  async list(
    organizationId: string,
    filters?: ReceivableFilters,
  ): Promise<Receivable[]> {
    return this.repo.findAll(organizationId, filters);
  }

  async getById(organizationId: string, id: string): Promise<Receivable> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Cuenta por cobrar");
    return found;
  }

  async create(
    organizationId: string,
    input: CreateReceivableServiceInput,
  ): Promise<Receivable> {
    await this.contacts.assertActive(organizationId, input.contactId);
    const receivable = Receivable.create({ ...input, organizationId });
    await this.repo.save(receivable);
    return receivable;
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateReceivableInput & { amount?: unknown },
  ): Promise<Receivable> {
    if ("amount" in input && input.amount !== undefined) {
      throw new ReceivableAmountImmutable();
    }
    const existing = await this.getById(organizationId, id);
    const updated = existing.update(input);
    await this.repo.update(updated);
    return updated;
  }

  async transitionStatus(
    organizationId: string,
    id: string,
    input: UpdateReceivableStatusServiceInput,
  ): Promise<Receivable> {
    const existing = await this.getById(organizationId, id);
    const next = existing.transitionTo(input.status, input.paidAmount);
    await this.repo.update(next);
    return next;
  }

  async void(organizationId: string, id: string): Promise<Receivable> {
    return this.transitionStatus(organizationId, id, { status: "VOIDED" });
  }

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    return this.repo.aggregateOpen(organizationId, contactId);
  }

  async findPendingByContact(
    organizationId: string,
    contactId: string,
  ): Promise<PendingDocumentSnapshot[]> {
    return this.repo.findPendingByContact(organizationId, contactId);
  }

  async applyAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    const target = await this.repo.findByIdTx(tx, organizationId, id);
    if (!target) throw new NotFoundError("Cuenta por cobrar");
    const next = target.applyAllocation(amount);
    await this.repo.applyAllocationTx(
      tx,
      organizationId,
      id,
      next.paid,
      next.balance,
      next.status,
    );
  }

  async revertAllocation(
    tx: unknown,
    organizationId: string,
    id: string,
    amount: MonetaryAmount,
  ): Promise<void> {
    const target = await this.repo.findByIdTx(tx, organizationId, id);
    if (!target) throw new NotFoundError("Cuenta por cobrar");
    const next = target.revertAllocation(amount);
    await this.repo.revertAllocationTx(
      tx,
      organizationId,
      id,
      next.paid,
      next.balance,
      next.status,
    );
  }
}
