import { Prisma } from "@/generated/prisma/client";
import {
  NotFoundError,
  ValidationError,
  INVALID_STATUS_TRANSITION,
  RECEIVABLE_AMOUNT_IMMUTABLE,
} from "@/features/shared/errors";
import type { ContactsService } from "@/features/contacts";
import { ReceivablesRepository } from "./receivables.repository";
import type {
  AccountsReceivable,
  ReceivableWithContact,
  ReceivableStatus,
  CreateReceivableInput,
  UpdateReceivableInput,
  UpdateReceivableStatusInput,
  ReceivableFilters,
  OpenAggregate,
} from "./receivables.types";

// ── Valid status transitions ──

const STATUS_TRANSITIONS: Record<ReceivableStatus, ReceivableStatus[]> = {
  PENDING: ["PARTIAL", "PAID", "CANCELLED"],
  PARTIAL: ["PAID", "CANCELLED"],
  PAID: [],
  CANCELLED: [],
};

export class ReceivablesService {
  private readonly repo: ReceivablesRepository;

  constructor(
    private readonly contactsService: ContactsService,
    repo?: ReceivablesRepository,
  ) {
    this.repo = repo ?? new ReceivablesRepository();
  }

  // ── List receivables ──

  async list(
    organizationId: string,
    filters?: ReceivableFilters,
  ): Promise<ReceivableWithContact[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Get a single receivable ──

  async getById(
    organizationId: string,
    id: string,
  ): Promise<ReceivableWithContact> {
    const receivable = await this.repo.findById(organizationId, id);
    if (!receivable) throw new NotFoundError("Cuenta por cobrar");
    return receivable;
  }

  // ── Create a receivable ──

  async create(
    organizationId: string,
    input: CreateReceivableInput,
  ): Promise<ReceivableWithContact> {
    await this.contactsService.getActiveById(organizationId, input.contactId);

    return this.repo.create(organizationId, input);
  }

  // ── Update a receivable (non-amount fields only) ──

  async update(
    organizationId: string,
    id: string,
    input: UpdateReceivableInput & { amount?: unknown },
  ): Promise<ReceivableWithContact> {
    if ("amount" in input && input.amount !== undefined) {
      throw new ValidationError(
        "El monto de una cuenta por cobrar no puede modificarse",
        RECEIVABLE_AMOUNT_IMMUTABLE,
      );
    }

    await this.getById(organizationId, id);

    return this.repo.update(organizationId, id, input);
  }

  // ── Update receivable status ──

  async updateStatus(
    organizationId: string,
    id: string,
    input: UpdateReceivableStatusInput,
  ): Promise<ReceivableWithContact> {
    const receivable = await this.getById(organizationId, id);

    const allowed = STATUS_TRANSITIONS[receivable.status];
    if (!allowed.includes(input.status)) {
      throw new ValidationError(
        `La transición de estado de ${receivable.status} a ${input.status} no está permitida`,
        INVALID_STATUS_TRANSITION,
      );
    }

    const amount = new Prisma.Decimal(receivable.amount.toString());
    let paid: Prisma.Decimal;
    let balance: Prisma.Decimal;

    if (input.status === "PAID") {
      paid = amount;
      balance = new Prisma.Decimal(0);
    } else if (input.status === "PARTIAL") {
      if (input.paidAmount === undefined) {
        throw new ValidationError(
          "Debe indicar el monto pagado para el estado PARTIAL",
          INVALID_STATUS_TRANSITION,
        );
      }
      paid = new Prisma.Decimal(input.paidAmount.toString());
      balance = amount.minus(paid);
    } else {
      // CANCELLED — keep current paid, balance = 0
      paid = new Prisma.Decimal(receivable.paid.toString());
      balance = new Prisma.Decimal(0);
    }

    return this.repo.updateStatus(organizationId, id, input.status, paid, balance);
  }

  // ── Cancel a receivable ──

  async cancel(
    organizationId: string,
    id: string,
  ): Promise<ReceivableWithContact> {
    return this.updateStatus(organizationId, id, { status: "CANCELLED" });
  }

  // ── Open aggregate ──

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    return this.repo.aggregateOpen(organizationId, contactId);
  }
}
