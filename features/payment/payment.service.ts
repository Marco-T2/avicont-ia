import "server-only";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/features/shared/errors";
import type { WithCorrelation } from "@/features/shared/audit-tx";
import {
  makePaymentsService,
  type PaymentsService as InnerPaymentsService,
} from "@/modules/payment/presentation/server";
import {
  paymentInclude,
  toPaymentWithRelations,
} from "@/modules/payment/presentation/mappers/payment-with-relations.mapper";
import type {
  PaymentWithRelations,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilters,
  AllocationInput,
  CreditAllocationSource,
} from "./payment.types";

/**
 * Backward-compat shim. Delegates business logic to the hexagonal
 * `modules/payment/` and re-fetches the row from Prisma with the legacy
 * include shape (`PaymentWithRelations`) after each write op so consumers
 * keep getting `WithCorrelation<PaymentWithRelations>` unchanged.
 *
 * Translation pattern:
 *   - Module returns `PaymentResult { payment: Payment-entity, correlationId }`
 *   - Shim re-fetches Prisma row with relations + spreads `correlationId`
 *
 * Constructor: legacy callers do `new PaymentService()` (zero args). The
 * module is composed via `makePaymentsService()` internally — collaborator
 * args are accepted for backwards-compat but ignored (they were the old
 * legacy collaborator graph; the module owns its own ports now).
 */
export class PaymentService {
  private readonly inner: InnerPaymentsService;

  constructor(
    _repo?: unknown,
    _orgSettingsService?: unknown,
    _autoEntryGenerator?: unknown,
    _balancesService?: unknown,
    _periodsService?: unknown,
    _accountsRepo?: unknown,
    _journalRepo?: unknown,
  ) {
    this.inner = makePaymentsService();
  }

  // ── Reads ──

  async list(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<PaymentWithRelations[]> {
    // Use Prisma directly to preserve the legacy include shape — module list
    // returns Payment entities without relations, so we'd otherwise re-fetch
    // each. List queries are read-only; bypassing the module here is safe.
    const where: Record<string, unknown> = { organizationId };
    if (filters?.status) where.status = filters.status;
    if (filters?.method) where.method = filters.method;
    if (filters?.contactId) where.contactId = filters.contactId;
    if (filters?.periodId) where.periodId = filters.periodId;
    if (filters?.dateFrom || filters?.dateTo) {
      where.date = {
        ...(filters.dateFrom && { gte: filters.dateFrom }),
        ...(filters.dateTo && { lte: filters.dateTo }),
      };
    }
    const rows = await prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toPaymentWithRelations);
  }

  async getById(
    organizationId: string,
    id: string,
  ): Promise<PaymentWithRelations> {
    const row = await fetchWithRelations(organizationId, id);
    if (!row) throw new NotFoundError("Pago");
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
    const row = await fetchWithRelations(organizationId, created.id);
    if (!row) throw new NotFoundError("Pago");
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
    const row = await fetchWithRelations(organizationId, payment.id);
    if (!row) throw new NotFoundError("Pago");
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
    const row = await fetchWithRelations(organizationId, payment.id);
    if (!row) throw new NotFoundError("Pago");
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
    const row = await fetchWithRelations(organizationId, payment.id);
    if (!row) throw new NotFoundError("Pago");
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
    const row = await fetchWithRelations(organizationId, payment.id);
    if (!row) throw new NotFoundError("Pago");
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
    const row = await fetchWithRelations(organizationId, payment.id);
    if (!row) throw new NotFoundError("Pago");
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
}

// ── Re-fetch helper (translation point: PaymentResult → PaymentWithRelations) ──

async function fetchWithRelations(
  organizationId: string,
  id: string,
): Promise<PaymentWithRelations | null> {
  const row = await prisma.payment.findFirst({
    where: { id, organizationId },
    include: paymentInclude,
  });
  return row ? toPaymentWithRelations(row) : null;
}
