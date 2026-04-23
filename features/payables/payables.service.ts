import "server-only";
import {
  NotFoundError,
  ValidationError,
  INVALID_STATUS_TRANSITION,
  PAYABLE_AMOUNT_IMMUTABLE,
} from "@/features/shared/errors";
import type { ContactsService } from "@/features/contacts/server";
import { PayablesRepository } from "./payables.repository";
import type {
  PayableWithContact,
  PayableStatus,
  CreatePayableInput,
  UpdatePayableInput,
  UpdatePayableStatusInput,
  PayableFilters,
  OpenAggregate,
} from "./payables.types";

// ── Transiciones de estado válidas ──

const STATUS_TRANSITIONS: Record<PayableStatus, PayableStatus[]> = {
  PENDING: ["PARTIAL", "PAID", "VOIDED", "OVERDUE"],
  PARTIAL: ["PAID", "VOIDED", "OVERDUE"],
  OVERDUE: ["PARTIAL", "PAID", "VOIDED"],
  PAID: [],
  VOIDED: [],
  CANCELLED: [], // mantenido por compatibilidad hacia atrás — la app usa VOIDED
};

export class PayablesService {
  private readonly repo: PayablesRepository;

  constructor(
    private readonly contactsService: ContactsService,
    repo?: PayablesRepository,
  ) {
    this.repo = repo ?? new PayablesRepository();
  }

  // ── Listar cuentas por pagar ──

  async list(
    organizationId: string,
    filters?: PayableFilters,
  ): Promise<PayableWithContact[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Obtener una cuenta por pagar individual ──

  async getById(
    organizationId: string,
    id: string,
  ): Promise<PayableWithContact> {
    const payable = await this.repo.findById(organizationId, id);
    if (!payable) throw new NotFoundError("Cuenta por pagar");
    return payable;
  }

  // ── Crear una cuenta por pagar ──

  async create(
    organizationId: string,
    input: CreatePayableInput,
  ): Promise<PayableWithContact> {
    await this.contactsService.getActiveById(organizationId, input.contactId);

    return this.repo.create(organizationId, input);
  }

  // ── Actualizar una cuenta por pagar (solo campos no monetarios) ──

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

  // ── Actualizar estado de la cuenta por pagar ──

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
      // VOIDED — mantener pagado actual, saldo = 0
      paid = payable.paid.toString();
      balance = "0";
    } else {
      // OVERDUE — solo cambio de estado, sin cambio financiero
      paid = payable.paid.toString();
      balance = payable.balance.toString();
    }

    return this.repo.updateStatus(organizationId, id, input.status, paid, balance);
  }

  // ── Anular una cuenta por pagar ──

  async void(
    organizationId: string,
    id: string,
  ): Promise<PayableWithContact> {
    return this.updateStatus(organizationId, id, { status: "VOIDED" });
  }

  // ── Agregado de cuentas abiertas ──

  async aggregateOpen(
    organizationId: string,
    contactId?: string,
  ): Promise<OpenAggregate> {
    return this.repo.aggregateOpen(organizationId, contactId);
  }
}
