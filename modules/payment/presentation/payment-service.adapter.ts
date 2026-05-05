import "server-only";
import { makePaymentsService, makePaymentReader } from "./composition-root";
import type { PaymentWithRelationsReaderPort } from "../domain/ports/payment-with-relations-reader.port";
import { PaymentNotFound } from "../domain/errors/payment-errors";
import type { PaymentsService as InnerPaymentsService } from "../application/payments.service";
import type { WithCorrelation } from "@/features/shared/audit-tx";
import type { PaymentWithRelations } from "./dto/payment-with-relations";
import type {
  CreatePaymentInput,
  UpdatePaymentInput,
  AllocationInput,
} from "./dto/payment-input-types";
import type {
  PaymentFilters,
  CreditAllocationSource,
} from "./server";

/**
 * Adapter Layer presentation/ delegate via reader port + composition-root chain
 * canonical R4 exception path EXACT mirror α-A3.B (paired C1b-α `89e6441`
 * precedent EXACT — composition-root.ts is the ONE legitimate R4 exception
 * canonical hex architecture).
 *
 * Encapsulates the legacy `PaymentService` shim contract preserved across the
 * cutover: envelope DTO `PaymentWithRelations` + zero-arg construct + args
 * reorder + `WithCorrelation<...>` wrapping. Read-side via injected reader
 * port returning domain-internal `PaymentWithRelationsSnapshot` (port boundary
 * type — see port file); presentation casts back to UI envelope DTO via
 * structural equivalence at boundary. Write-side delegates to inner hex
 * `PaymentsService` (Payment-entity returns) + re-fetches via reader port.
 *
 * §13 NEW classification cementación target D1 — "Adapter Layer presentation/
 * delegate via reader port + composition-root chain canonical R4 exception
 * path EXACT mirror α-A3.B" + "Reader port domain-internal Snapshot type
 * local definition pattern (mirror iva-books precedent EXACT cumulative
 * cross-module)".
 *
 * R5 honored estricto — NO Prisma value imports (reader port DI carries the
 * infra-side Prisma access via composition-root chain).
 */
export class PaymentService {
  private readonly reader: PaymentWithRelationsReaderPort;
  private readonly inner: InnerPaymentsService;

  constructor(reader?: PaymentWithRelationsReaderPort, inner?: InnerPaymentsService) {
    this.reader = reader ?? makePaymentReader();
    this.inner = inner ?? makePaymentsService();
  }

  // ── Reads ──

  async list(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<PaymentWithRelations[]> {
    return this.readAll(organizationId, filters);
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<PaymentWithRelations> {
    const row = await this.readById(organizationId, id);
    if (!row) throw new PaymentNotFound();
    return row;
  }

  async getCustomerBalance(
    organizationId: string,
    contactId: string,
  ): Promise<{
    totalInvoiced: number;
    totalPaid: number;
    netBalance: number;
    unappliedCredit: number;
  }> {
    return this.inner.getCustomerBalance(organizationId, contactId);
  }

  // ── Writes ──

  async create(
    organizationId: string,
    input: CreatePaymentInput,
  ): Promise<PaymentWithRelations> {
    const userId = input.createdById;
    const created = await this.inner.create(organizationId, userId, {
      method: input.method,
      date: input.date,
      amount: input.amount,
      direction: input.direction,
      description: input.description,
      periodId: input.periodId,
      contactId: input.contactId,
      referenceNumber: input.referenceNumber ?? null,
      operationalDocTypeId: input.operationalDocTypeId ?? null,
      accountCode: input.accountCode ?? null,
      notes: input.notes ?? null,
      allocations: input.allocations,
      creditSources: input.creditSources,
    });
    const row = await this.readById(organizationId, created.id);
    if (!row) throw new PaymentNotFound();
    return row;
  }

  async createAndPost(
    organizationId: string,
    input: CreatePaymentInput,
    userId: string,
  ): Promise<WithCorrelation<PaymentWithRelations>> {
    const { payment, correlationId } = await this.inner.createAndPost(
      organizationId,
      userId,
      {
        method: input.method,
        date: input.date,
        amount: input.amount,
        direction: input.direction,
        description: input.description,
        periodId: input.periodId,
        contactId: input.contactId,
        referenceNumber: input.referenceNumber ?? null,
        operationalDocTypeId: input.operationalDocTypeId ?? null,
        accountCode: input.accountCode ?? null,
        notes: input.notes ?? null,
        allocations: input.allocations,
        creditSources: input.creditSources,
      },
    );
    const row = await this.readById(organizationId, payment.id);
    if (!row) throw new PaymentNotFound();
    return { ...row, correlationId };
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdatePaymentInput,
    role?: string,
    justification?: string,
    userId?: string,
  ): Promise<WithCorrelation<PaymentWithRelations>> {
    const { payment, correlationId } = await this.inner.update(
      organizationId,
      userId ?? "unknown",
      id,
      {
        method: input.method,
        date: input.date,
        amount: input.amount,
        description: input.description,
        referenceNumber: input.referenceNumber ?? null,
        operationalDocTypeId: input.operationalDocTypeId ?? null,
        accountCode: input.accountCode ?? null,
        notes: input.notes ?? null,
        allocations: input.allocations,
      },
      { role, justification },
    );
    const row = await this.readById(organizationId, payment.id);
    if (!row) throw new PaymentNotFound();
    return { ...row, correlationId };
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.inner.delete(organizationId, id);
  }

  async post(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<WithCorrelation<PaymentWithRelations>> {
    const { payment, correlationId } = await this.inner.post(
      organizationId,
      userId,
      id,
    );
    const row = await this.readById(organizationId, payment.id);
    if (!row) throw new PaymentNotFound();
    return { ...row, correlationId };
  }

  async void(
    organizationId: string,
    id: string,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<WithCorrelation<PaymentWithRelations>> {
    const { payment, correlationId } = await this.inner.void(
      organizationId,
      userId,
      id,
      { role, justification },
    );
    const row = await this.readById(organizationId, payment.id);
    if (!row) throw new PaymentNotFound();
    return { ...row, correlationId };
  }

  async updateAllocations(
    organizationId: string,
    id: string,
    newAllocations: AllocationInput[],
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<WithCorrelation<PaymentWithRelations>> {
    const { payment, correlationId } = await this.inner.updateAllocations(
      organizationId,
      userId,
      id,
      newAllocations,
      { role, justification },
    );
    const row = await this.readById(organizationId, payment.id);
    if (!row) throw new PaymentNotFound();
    return { ...row, correlationId };
  }

  async applyCreditOnly(
    organizationId: string,
    userId: string,
    contactId: string,
    creditSources: CreditAllocationSource[],
  ): Promise<{ correlationId: string }> {
    return this.inner.applyCreditOnly(
      organizationId,
      userId,
      contactId,
      creditSources,
    );
  }

  // ── Read helpers (Snapshot → UI envelope DTO type bridge) ──
  //
  // The reader port returns `PaymentWithRelationsSnapshot` (domain-internal
  // boundary type per R1 banDomainCrossLayer). Cast trivial via structural
  // equivalence — runtime shape is identical to the legacy
  // `PaymentWithRelations` envelope (the mapper produces the same row →
  // envelope transformation regardless of which type-system label is applied).

  private async readAll(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<PaymentWithRelations[]> {
    const snapshots = await this.reader.findAllWithRelations(organizationId, filters);
    return snapshots as unknown as PaymentWithRelations[];
  }

  private async readById(
    organizationId: string,
    id: string,
  ): Promise<PaymentWithRelations | null> {
    const snapshot = await this.reader.findByIdWithRelations(organizationId, id);
    return snapshot as unknown as PaymentWithRelations | null;
  }
}
