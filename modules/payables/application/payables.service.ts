import { NotFoundError } from "@/features/shared/errors";
import {
  Payable,
  type CreatePayableInput,
  type UpdatePayableInput,
} from "../domain/payable.entity";
import {
  type PayableRepository,
  type PayableFilters,
  type OpenAggregate,
  type PendingDocumentSnapshot,
} from "../domain/payable.repository";
import { PayableAmountImmutable } from "../domain/errors/payable-errors";
import type { PayableStatus } from "../domain/value-objects/payable-status";
import type { ContactExistencePort } from "../domain/ports/contact-existence.port";
import type { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";

export type CreatePayableServiceInput = Omit<CreatePayableInput, "organizationId">;

export interface UpdatePayableStatusServiceInput {
  status: PayableStatus;
  paidAmount?: number | string;
}

export class PayablesService {
  constructor(
    private readonly repo: PayableRepository,
    private readonly contacts: ContactExistencePort,
  ) {}

  async list(
    organizationId: string,
    filters?: PayableFilters,
  ): Promise<Payable[]> {
    return this.repo.findAll(organizationId, filters);
  }

  async getById(organizationId: string, id: string): Promise<Payable> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Cuenta por pagar");
    return found;
  }

  async create(
    organizationId: string,
    input: CreatePayableServiceInput,
  ): Promise<Payable> {
    await this.contacts.assertActive(organizationId, input.contactId);
    const payable = Payable.create({ ...input, organizationId });
    await this.repo.save(payable);
    return payable;
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdatePayableInput & { amount?: unknown },
  ): Promise<Payable> {
    if ("amount" in input && input.amount !== undefined) {
      throw new PayableAmountImmutable();
    }
    const existing = await this.getById(organizationId, id);
    const updated = existing.update(input);
    await this.repo.update(updated);
    return updated;
  }

  async transitionStatus(
    organizationId: string,
    id: string,
    input: UpdatePayableStatusServiceInput,
  ): Promise<Payable> {
    const existing = await this.getById(organizationId, id);
    const next = existing.transitionTo(input.status, input.paidAmount);
    await this.repo.update(next);
    return next;
  }

  async void(organizationId: string, id: string): Promise<Payable> {
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
    if (!target) throw new NotFoundError("Cuenta por pagar");
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
    if (!target) throw new NotFoundError("Cuenta por pagar");
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
