import {
  NotFoundError,
  ValidationError,
  INVALID_STATUS_TRANSITION,
  PAYABLE_AMOUNT_IMMUTABLE,
} from "@/features/shared/errors";
import type { ContactsService } from "@/features/contacts";
import { PayablesRepository } from "./payables.repository";
import type {
  AccountsPayable,
  PayableWithContact,
  PayableStatus,
  CreatePayableInput,
  UpdatePayableInput,
  UpdatePayableStatusInput,
  PayableFilters,
  OpenAggregate,
} from "./payables.types";

// ── Valid status transitions ──

const STATUS_TRANSITIONS: Record<PayableStatus, PayableStatus[]> = {
  PENDING: ["PARTIAL", "PAID", "VOIDED", "OVERDUE"],
  PARTIAL: ["PAID", "VOIDED", "OVERDUE"],
  OVERDUE: ["PARTIAL", "PAID", "VOIDED"],
  PAID: [],
  VOIDED: [],
  CANCELLED: [], // kept for backward compatibility — app uses VOIDED
};

export class PayablesService {
  private readonly repo: PayablesRepository;

  constructor(
    private readonly contactsService: ContactsService,
    repo?: PayablesRepository,
  ) {
    this.repo = repo ?? new PayablesRepository();
  }

  // ── List payables ──

  async list(
    organizationId: string,
    filters?: PayableFilters,
  ): Promise<PayableWithContact[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Get a single payable ──

  async getById(
    organizationId: string,
    id: string,
  ): Promise<PayableWithContact> {
    const payable = await this.repo.findById(organizationId, id);
    if (!payable) throw new NotFoundError("Cuenta por pagar");
    return payable;
  }

  // ── Create a payable ──

  async create(
    organizationId: string,
    input: CreatePayableInput,
  ): Promise<PayableWithContact> {
    await this.contactsService.getActiveById(organizationId, input.contactId);

    return this.repo.create(organizationId, input);
  }

  // ── Update a payable (non-amount fields only) ──

  async update(
    organizationId: string,
    id: string,
    input: UpdatePayableInput & { amount?: unknown },
  ): Promise<PayableWithContact> {
    if ("amount" in input && input.amount !== undefined) {
      throw new ValidationError(
        "El monto de una cuenta por pagar no puede modificarse",
        PAYABLE_AMOUNT_IMMUTABLE,
      );
    }

    await this.getById(organizationId, id);

    return this.repo.update(organizationId, id, input);
  }

  // ── Update payable status ──

  async updateStatus(
    organizationId: string,
    id: string,
    input: UpdatePayableStatusInput,
  ): Promise<PayableWithContact> {
    const payable = await this.getById(organizationId, id);

    const allowed = STATUS_TRANSITIONS[payable.status];
    if (!allowed.includes(input.status)) {
      throw new ValidationError(
        `La transición de estado de ${payable.status} a ${input.status} no está permitida`,
        INVALID_STATUS_TRANSITION,
      );
    }

    const amount = payable.amount;
    let paid: string;
    let balance: string;

    if (input.status === "PAID") {
      paid = amount.toString();
      balance = "0";
    } else if (input.status === "PARTIAL") {
      if (input.paidAmount === undefined) {
        throw new ValidationError(
          "Debe indicar el monto pagado para el estado PARTIAL",
          INVALID_STATUS_TRANSITION,
        );
      }
      paid = input.paidAmount.toString();
      balance = amount.minus(paid).toString();
    } else if (input.status === "VOIDED") {
      // VOIDED — keep current paid, balance = 0
      paid = payable.paid.toString();
      balance = "0";
    } else {
      // OVERDUE — status change only, no financial change
      paid = payable.paid.toString();
      balance = payable.balance.toString();
    }

    return this.repo.updateStatus(organizationId, id, input.status, paid, balance);
  }

  // ── Void a payable ──

  async void(
    organizationId: string,
    id: string,
  ): Promise<PayableWithContact> {
    return this.updateStatus(organizationId, id, { status: "VOIDED" });
  }

  // ── Open aggregate ──

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    return this.repo.aggregateOpen(organizationId, contactId);
  }
}
