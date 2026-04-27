import "server-only";
import { Prisma } from "@/generated/prisma/client";
import {
  NotFoundError,
  ValidationError,
  PAYMENT_MIXED_ALLOCATION,
  PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
  PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
  PAYMENT_ALLOCATION_TARGET_VOIDED,
  PAYMENT_DIRECTION_REQUIRED,
  INVALID_STATUS_TRANSITION,
  PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
} from "@/features/shared/errors";
import { setAuditContext } from "@/features/shared/audit-context";
import { PaymentRepository } from "./payment.repository";
import { OrgSettingsService } from "@/features/org-settings/server";
import {
  AutoEntryGenerator,
  AccountsRepository,
  JournalRepository,
  validateTransition,
  validateDraftOnly,
  validateLockedEdit,
  validatePeriodOpen,
  validateEditable,
  computeReceivableStatus,
  computePayableStatus,
  type DocumentStatus,
} from "@/features/accounting/server";
import { VoucherTypesRepository } from "@/features/voucher-types/server";
import { AccountBalancesService } from "@/features/account-balances/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type {
  PaymentWithRelations,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilters,
  AllocationInput,
  PaymentDirection,
  CreditAllocationSource,
} from "./payment.types";
import type { EntryLineTemplate } from "@/features/accounting/server";

export class PaymentService {
  private readonly repo: PaymentRepository;
  private readonly orgSettingsService: OrgSettingsService;
  private readonly autoEntryGenerator: AutoEntryGenerator;
  private readonly balancesService: AccountBalancesService;
  private readonly periodsService: FiscalPeriodsService;
  private readonly accountsRepo: AccountsRepository;
  private readonly journalRepo: JournalRepository;

  constructor(
    repo?: PaymentRepository,
    orgSettingsService?: OrgSettingsService,
    autoEntryGenerator?: AutoEntryGenerator,
    balancesService?: AccountBalancesService,
    periodsService?: FiscalPeriodsService,
    accountsRepo?: AccountsRepository,
    journalRepo?: JournalRepository,
  ) {
    this.repo = repo ?? new PaymentRepository();
    this.orgSettingsService = orgSettingsService ?? new OrgSettingsService();
    this.balancesService = balancesService ?? new AccountBalancesService();
    this.periodsService = periodsService ?? new FiscalPeriodsService();

    this.accountsRepo = accountsRepo ?? new AccountsRepository();
    this.journalRepo = journalRepo ?? new JournalRepository();
    const voucherTypesRepo = new VoucherTypesRepository();
    this.autoEntryGenerator =
      autoEntryGenerator ?? new AutoEntryGenerator(this.accountsRepo, voucherTypesRepo);
  }

  // ── Listar pagos ──

  async list(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<PaymentWithRelations[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Obtener un pago individual ──

  async getById(organizationId: string, id: string): Promise<PaymentWithRelations> {
    const row = await this.repo.findById(organizationId, id);
    if (!row) throw new NotFoundError("Pago");
    return row;
  }

  // ── Crear un pago en DRAFT ──

  async create(
    organizationId: string,
    input: CreatePaymentInput,
  ): Promise<PaymentWithRelations> {
    // 1. Validar asignaciones
    validateAllocations(input.allocations, input.amount);

    // 2. Crear pago con asignaciones
    return this.repo.create(organizationId, input);
  }

  // ── Crear y contabilizar un pago en una sola transacción atómica ──

  async createAndPost(
    organizationId: string,
    input: CreatePaymentInput,
    userId: string,
  ): Promise<PaymentWithRelations> {
    // 1. Validar asignaciones
    validateAllocations(input.allocations, input.amount);

    // 2. Validar que el período fiscal esté ABIERTO
    const period = await this.periodsService.getById(organizationId, input.periodId);
    await validatePeriodOpen(period);

    // 3. Obtener configuración de la organización para los códigos de cuenta (fuera de la transacción — solo lectura)
    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    let paymentId = "";

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId, organizationId);

      // Resolver dirección dentro de la transacción (puede necesitar consultar Contact.type)
      const direction = await resolveDirection(
        tx,
        input.allocations,
        input.contactId,
        input.direction,
      );

      const voucherTypeCode = direction === "COBRO" ? "CI" : "CE";
      const amount = input.amount;

      // Crear pago directamente como POSTED
      const payment = await this.repo.createPostedTx(tx, organizationId, input);
      paymentId = payment.id;

      // Validar cada asignación contra el saldo CxC/CxP actualizado
      for (const alloc of input.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable) throw new NotFoundError("Cuenta por cobrar");
          if (receivable.status === "VOIDED") {
            throw new ValidationError(
              "No se puede aplicar pago a una cuenta por cobrar anulada",
              PAYMENT_ALLOCATION_TARGET_VOIDED,
            );
          }
          const balance = Number(receivable.balance);
          if (alloc.amount > balance) {
            throw new ValidationError(
              `La asignación (${alloc.amount}) excede el saldo disponible (${balance}) de la CxC`,
              PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
            );
          }
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable) throw new NotFoundError("Cuenta por pagar");
          if (payable.status === "VOIDED") {
            throw new ValidationError(
              "No se puede aplicar pago a una cuenta por pagar anulada",
              PAYMENT_ALLOCATION_TARGET_VOIDED,
            );
          }
          const balance = Number(payable.balance);
          if (alloc.amount > balance) {
            throw new ValidationError(
              `La asignación (${alloc.amount}) excede el saldo disponible (${balance}) de la CxP`,
              PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
            );
          }
        }
      }

      // Generar asiento contable solo cuando el monto > 0 (omitir para pagos solo-crédito)
      if (amount > 0) {
        const lines = buildEntryLines(
          direction === "COBRO",
          input.method,
          amount,
          settings.cajaGeneralAccountCode,
          settings.bancoAccountCode,
          settings.cxcAccountCode,
          settings.cxpAccountCode,
          input.contactId,
          input.accountCode,
        );

        const entry = await this.autoEntryGenerator.generate(tx, {
          organizationId,
          voucherTypeCode,
          contactId: input.contactId,
          date: input.date,
          periodId: input.periodId,
          description: input.description,
          referenceNumber: input.referenceNumber ?? undefined,
          sourceType: "payment",
          sourceId: payment.id,
          createdById: userId,
          lines,
        });

        // Aplicar cambios en saldos de cuentas
        await this.balancesService.applyPost(tx, entry);

        // Vincular asiento contable al pago
        await this.repo.linkJournalEntry(tx, organizationId, payment.id, entry.id);
      }

      // Actualizar cada objetivo de asignación CxC/CxP
      for (const alloc of input.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable) continue;

          const newPaid = Number(receivable.paid) + alloc.amount;
          const newBalance = Number(receivable.amount) - newPaid;

          await this.repo.updateCxCPaymentTx(
            tx,
            organizationId,
            alloc.receivableId,
            newPaid,
            Math.max(0, newBalance),
            computeReceivableStatus(newPaid, Math.max(0, newBalance)),
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable) continue;

          const newPaid = Number(payable.paid) + alloc.amount;
          const newBalance = Number(payable.amount) - newPaid;

          await this.repo.updateCxPPaymentTx(
            tx,
            organizationId,
            alloc.payableId,
            newPaid,
            Math.max(0, newBalance),
            computePayableStatus(newPaid, Math.max(0, newBalance)),
          );
        }
      }

      // Aplicar fuentes de crédito (Modo A: efectivo + crédito en una sola transacción)
      for (const creditSource of input.creditSources ?? []) {
        await this.applyCreditToInvoice(
          tx,
          organizationId,
          creditSource.sourcePaymentId,
          creditSource.receivableId,
          creditSource.amount,
        );
      }

    });

    const result = await this.repo.findById(organizationId, paymentId);
    if (!result) throw new NotFoundError("Pago");
    return result;
  }

  // ── Actualizar un pago en DRAFT (o LOCKED con justificación, o POSTED) ──

  async update(
    organizationId: string,
    id: string,
    input: UpdatePaymentInput,
    role?: string,
    justification?: string,
    userId?: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);
    const status = payment.status as DocumentStatus;

    if (status === "LOCKED") {
      if (!role) throw new ValidationError("Se requiere el rol del usuario para editar documentos bloqueados");
      const period = await this.periodsService.getById(organizationId, payment.periodId);
      validateLockedEdit(status, role, period.status as "OPEN" | "CLOSED", justification);
    } else if (status === "POSTED") {
      // Las ediciones POSTED se manejan mediante el camino atómico reversar-modificar-reaplicar
      validateEditable(status);

      // Validar que el período fiscal esté ABIERTO
      const period = await this.periodsService.getById(organizationId, payment.periodId);
      await validatePeriodOpen(period);

      return this.updatePostedPaymentTx(
        organizationId,
        payment,
        input,
        userId ?? "unknown",
      );
    } else {
      validateDraftOnly(status);
    }

    // Validar nuevas asignaciones si se proveen
    if (input.allocations) {
      const amount = input.amount ?? payment.amount;
      validateAllocations(input.allocations, amount);
    }

    // Para ediciones LOCKED, envolver en transacción con contexto de auditoría
    if (status === "LOCKED") {
      return this.repo.transaction(async (tx) => {
        await setAuditContext(tx, payment.createdById ?? "unknown", organizationId, justification);
        return this.repo.updateTx(tx, organizationId, id, input);
      });
    }

    return this.repo.update(organizationId, id, input);
  }

  // ── Eliminar un pago en DRAFT ──

  async delete(organizationId: string, id: string): Promise<void> {
    const payment = await this.getById(organizationId, id);
    validateDraftOnly(payment.status as DocumentStatus);
    await this.repo.delete(organizationId, id);
  }

  // ── Contabilizar un pago (DRAFT → POSTED) ──

  async post(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);

    // Validar la transición del ciclo de vida
    validateTransition(
      payment.status as DocumentStatus,
      "POSTED",
    );

    // Validar que el período fiscal esté ABIERTO
    const period = await this.periodsService.getById(organizationId, payment.periodId);
    await validatePeriodOpen(period);

    // Obtener configuración de la organización para los códigos de cuenta (fuera de la transacción — solo lectura)
    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId, organizationId);
      // Resolver dirección dentro de la transacción (puede necesitar consultar Contact.type)
      const direction = await resolveDirection(
        tx,
        payment.allocations.map((a) => ({
          receivableId: a.receivableId ?? undefined,
          payableId: a.payableId ?? undefined,
          amount: a.amount,
        })),
        payment.contactId,
      );

      const voucherTypeCode = direction === "COBRO" ? "CI" : "CE";
      const amount = payment.amount;

      // 1. Validar cada asignación contra el saldo CxC/CxP actualizado
      for (const alloc of payment.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable) throw new NotFoundError("Cuenta por cobrar");
          if (receivable.status === "VOIDED") {
            throw new ValidationError(
              "No se puede aplicar pago a una cuenta por cobrar anulada",
              PAYMENT_ALLOCATION_TARGET_VOIDED,
            );
          }
          const balance = Number(receivable.balance);
          if (alloc.amount > balance) {
            throw new ValidationError(
              `La asignación (${alloc.amount}) excede el saldo disponible (${balance}) de la CxC`,
              PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
            );
          }
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable) throw new NotFoundError("Cuenta por pagar");
          if (payable.status === "VOIDED") {
            throw new ValidationError(
              "No se puede aplicar pago a una cuenta por pagar anulada",
              PAYMENT_ALLOCATION_TARGET_VOIDED,
            );
          }
          const balance = Number(payable.balance);
          if (alloc.amount > balance) {
            throw new ValidationError(
              `La asignación (${alloc.amount}) excede el saldo disponible (${balance}) de la CxP`,
              PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
            );
          }
        }
      }

      // 2. Actualizar estado del pago a POSTED
      await this.repo.updateStatusTx(tx, organizationId, id, "POSTED");

      // 3. Construir líneas del asiento y generar el asiento contable
      const lines = buildEntryLines(
        direction === "COBRO",
        payment.method,
        amount,
        settings.cajaGeneralAccountCode,
        settings.bancoAccountCode,
        settings.cxcAccountCode,
        settings.cxpAccountCode,
        payment.contactId,
        payment.accountCode ?? undefined,
      );

      const entry = await this.autoEntryGenerator.generate(tx, {
        organizationId,
        voucherTypeCode,
        contactId: payment.contactId,
        date: payment.date,
        periodId: payment.periodId,
        description: payment.description,
        referenceNumber: payment.referenceNumber ?? undefined,
        sourceType: "payment",
        sourceId: payment.id,
        createdById: userId,
        lines,
      });

      // 4. Aplicar cambios en saldos de cuentas
      await this.balancesService.applyPost(tx, entry);

      // 5. Vincular asiento contable al pago
      await this.repo.linkJournalEntry(tx, organizationId, id, entry.id);

      // 6. Actualizar cada objetivo de asignación CxC/CxP
      for (const alloc of payment.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable) continue;

          const newPaid = Number(receivable.paid) + alloc.amount;
          const newBalance = Number(receivable.amount) - newPaid;

          await this.repo.updateCxCPaymentTx(
            tx,
            organizationId,
            alloc.receivableId,
            newPaid,
            Math.max(0, newBalance),
            computeReceivableStatus(newPaid, Math.max(0, newBalance)),
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable) continue;

          const newPaid = Number(payable.paid) + alloc.amount;
          const newBalance = Number(payable.amount) - newPaid;

          await this.repo.updateCxPPaymentTx(
            tx,
            organizationId,
            alloc.payableId,
            newPaid,
            Math.max(0, newBalance),
            computePayableStatus(newPaid, Math.max(0, newBalance)),
          );
        }
      }
    });

    // Volver a obtener con todos los vínculos poblados
    const updated = await this.repo.findById(organizationId, id);
    if (!updated) throw new NotFoundError("Pago");
    return updated;
  }

  // ── Anular un pago (POSTED → VOIDED) ──

  async void(
    organizationId: string,
    id: string,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);
    const status = payment.status as DocumentStatus;

    // Validar la transición del ciclo de vida
    validateTransition(status, "VOIDED");

    // Si está LOCKED, requerir rol + justificación
    if (status === "LOCKED") {
      if (!role) throw new ValidationError("Se requiere el rol del usuario para anular documentos bloqueados");
      const period = await this.periodsService.getById(organizationId, payment.periodId);
      validateLockedEdit(status, role, period.status as "OPEN" | "CLOSED", justification);
    }

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId, organizationId, justification);

      // 1. Actualizar estado del pago a VOIDED
      await this.repo.updateStatusTx(tx, organizationId, id, "VOIDED");

      // 2. Anular asiento contable vinculado y revertir saldos
      if (payment.journalEntryId) {
        const journalEntry = await tx.journalEntry.findFirst({
          where: { id: payment.journalEntryId, organizationId },
          include: {
            lines: {
              include: { account: true, contact: true },
              orderBy: { order: "asc" as const },
            },
            contact: true,
            voucherType: true,
          },
        });

        if (journalEntry) {
          await tx.journalEntry.update({
            where: { id: journalEntry.id },
            data: { status: "VOIDED", updatedById: userId },
          });
          await this.balancesService.applyVoid(tx, journalEntry as never);
        }
      }

      // 3. Revertir la CxC/CxP de cada asignación
      for (const alloc of payment.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable || receivable.status === "VOIDED") continue;

          const revertedPaid = Math.max(0, Number(receivable.paid) - alloc.amount);
          const revertedBalance = Number(receivable.amount) - revertedPaid;

          await this.repo.updateCxCPaymentTx(
            tx,
            organizationId,
            alloc.receivableId,
            revertedPaid,
            Math.max(0, revertedBalance),
            computeReceivableStatus(revertedPaid, Math.max(0, revertedBalance)),
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable || payable.status === "VOIDED") continue;

          const revertedPaid = Math.max(0, Number(payable.paid) - alloc.amount);
          const revertedBalance = Number(payable.amount) - revertedPaid;

          await this.repo.updateCxPPaymentTx(
            tx,
            organizationId,
            alloc.payableId,
            revertedPaid,
            Math.max(0, revertedBalance),
            computePayableStatus(revertedPaid, Math.max(0, revertedBalance)),
          );
        }
      }

    });

    const updated = await this.repo.findById(organizationId, id);
    if (!updated) throw new NotFoundError("Pago");
    return updated;
  }

  // ── Actualizar asignaciones en un pago POSTED/LOCKED (asiento contable sin cambios) ──

  async updateAllocations(
    organizationId: string,
    id: string,
    newAllocations: AllocationInput[],
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);
    const status = payment.status as DocumentStatus;

    // Solo pagos POSTED o LOCKED pueden tener asignaciones actualizadas de esta forma
    if (status !== "POSTED" && status !== "LOCKED") {
      throw new ValidationError(
        "Solo se pueden reasignar pagos contabilizados o bloqueados. Use la edición normal para borradores.",
        INVALID_STATUS_TRANSITION,
      );
    }

    // LOCKED requiere rol + justificación
    if (status === "LOCKED") {
      if (!role) throw new ValidationError("Se requiere el rol del usuario para reasignar documentos bloqueados");
      const period = await this.periodsService.getById(organizationId, payment.periodId);
      validateLockedEdit(status, role, period.status as "OPEN" | "CLOSED", justification);
    }

    // Validar nuevas asignaciones contra el monto del pago
    validateAllocations(newAllocations, payment.amount);

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId, organizationId, justification);

      // 1. Revertir asignaciones antiguas — restaurar saldos CxC/CxP
      for (const alloc of payment.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable || receivable.status === "VOIDED") continue;

          const revertedPaid = Math.max(0, Number(receivable.paid) - alloc.amount);
          const revertedBalance = Number(receivable.amount) - revertedPaid;

          await this.repo.updateCxCPaymentTx(
            tx,
            organizationId,
            alloc.receivableId,
            revertedPaid,
            Math.max(0, revertedBalance),
            computeReceivableStatus(revertedPaid, Math.max(0, revertedBalance)),
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable || payable.status === "VOIDED") continue;

          const revertedPaid = Math.max(0, Number(payable.paid) - alloc.amount);
          const revertedBalance = Number(payable.amount) - revertedPaid;

          await this.repo.updateCxPPaymentTx(
            tx,
            organizationId,
            alloc.payableId,
            revertedPaid,
            Math.max(0, revertedBalance),
            computePayableStatus(revertedPaid, Math.max(0, revertedBalance)),
          );
        }
      }

      // 2. Eliminar registros de asignaciones antiguas
      await this.repo.updateAllocations(tx, id, []);

      // 3. Validar nuevas asignaciones contra saldos CxC/CxP ACTUALIZADOS (post-reversión)
      for (const alloc of newAllocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable) throw new NotFoundError("Cuenta por cobrar");
          if (receivable.status === "VOIDED") {
            throw new ValidationError(
              "No se puede aplicar pago a una cuenta por cobrar anulada",
              PAYMENT_ALLOCATION_TARGET_VOIDED,
            );
          }
          if (alloc.amount > Number(receivable.balance)) {
            throw new ValidationError(
              `La asignación (${alloc.amount}) excede el saldo disponible (${Number(receivable.balance)}) de la CxC`,
              PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
            );
          }
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable) throw new NotFoundError("Cuenta por pagar");
          if (payable.status === "VOIDED") {
            throw new ValidationError(
              "No se puede aplicar pago a una cuenta por pagar anulada",
              PAYMENT_ALLOCATION_TARGET_VOIDED,
            );
          }
          if (alloc.amount > Number(payable.balance)) {
            throw new ValidationError(
              `La asignación (${alloc.amount}) excede el saldo disponible (${Number(payable.balance)}) de la CxP`,
              PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
            );
          }
        }
      }

      // 4. Crear nuevos registros de asignaciones
      await this.repo.updateAllocations(tx, id, newAllocations);

      // 5. Aplicar nuevas asignaciones — actualizar saldos CxC/CxP
      for (const alloc of newAllocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable) continue;

          const newPaid = Number(receivable.paid) + alloc.amount;
          const newBalance = Number(receivable.amount) - newPaid;

          await this.repo.updateCxCPaymentTx(
            tx,
            organizationId,
            alloc.receivableId,
            newPaid,
            Math.max(0, newBalance),
            computeReceivableStatus(newPaid, Math.max(0, newBalance)),
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable) continue;

          const newPaid = Number(payable.paid) + alloc.amount;
          const newBalance = Number(payable.amount) - newPaid;

          await this.repo.updateCxPPaymentTx(
            tx,
            organizationId,
            alloc.payableId,
            newPaid,
            Math.max(0, newBalance),
            computePayableStatus(newPaid, Math.max(0, newBalance)),
          );
        }
      }

      // 6. El asiento contable NO se modifica — intencional según especificación (REQ-5.4)
    });

    const result = await this.repo.findById(organizationId, id);
    if (!result) throw new NotFoundError("Pago");
    return result;
  }

  // ── Revertir asignaciones (restaurar saldos CxC/CxP) ──

  private async reverseAllocations(
    tx: Prisma.TransactionClient,
    organizationId: string,
    allocations: PaymentWithRelations["allocations"],
  ): Promise<void> {
    for (const alloc of allocations) {
      if (alloc.receivableId) {
        const receivable = await tx.accountsReceivable.findUnique({ where: { id: alloc.receivableId } });
        if (!receivable || receivable.status === "VOIDED") continue;
        const revertedPaid = Math.max(0, Number(receivable.paid) - Number(alloc.amount));
        const revertedBalance = Number(receivable.amount) - revertedPaid;
        await this.repo.updateCxCPaymentTx(
          tx,
          organizationId,
          alloc.receivableId,
          revertedPaid,
          Math.max(0, revertedBalance),
          computeReceivableStatus(revertedPaid, Math.max(0, revertedBalance)),
        );
      } else if (alloc.payableId) {
        const payable = await tx.accountsPayable.findUnique({ where: { id: alloc.payableId } });
        if (!payable || payable.status === "VOIDED") continue;
        const revertedPaid = Math.max(0, Number(payable.paid) - Number(alloc.amount));
        const revertedBalance = Number(payable.amount) - revertedPaid;
        await this.repo.updateCxPPaymentTx(
          tx,
          organizationId,
          alloc.payableId,
          revertedPaid,
          Math.max(0, revertedBalance),
          computePayableStatus(revertedPaid, Math.max(0, revertedBalance)),
        );
      }
    }
  }

  // ── Aplicar asignaciones hacia adelante (actualizar saldos CxC/CxP) ──

  private async applyAllocations(
    tx: Prisma.TransactionClient,
    organizationId: string,
    allocations: { receivableId?: string | null; payableId?: string | null; amount: number }[],
  ): Promise<void> {
    for (const alloc of allocations) {
      if (alloc.receivableId) {
        const receivable = await tx.accountsReceivable.findUnique({ where: { id: alloc.receivableId } });
        if (!receivable) continue;
        const newPaid = Number(receivable.paid) + alloc.amount;
        const newBalance = Number(receivable.amount) - newPaid;
        await this.repo.updateCxCPaymentTx(
          tx,
          organizationId,
          alloc.receivableId,
          newPaid,
          Math.max(0, newBalance),
          computeReceivableStatus(newPaid, Math.max(0, newBalance)),
        );
      } else if (alloc.payableId) {
        const payable = await tx.accountsPayable.findUnique({ where: { id: alloc.payableId } });
        if (!payable) continue;
        const newPaid = Number(payable.paid) + alloc.amount;
        const newBalance = Number(payable.amount) - newPaid;
        await this.repo.updateCxPPaymentTx(
          tx,
          organizationId,
          alloc.payableId,
          newPaid,
          Math.max(0, newBalance),
          computePayableStatus(newPaid, Math.max(0, newBalance)),
        );
      }
    }
  }

  // ── Actualizar un pago POSTED (reversión-modificación-reaplicación atómica) ──

  private async updatePostedPaymentTx(
    organizationId: string,
    payment: PaymentWithRelations,
    input: UpdatePaymentInput,
    userId: string,
  ): Promise<PaymentWithRelations> {
    const newAmount = input.amount ?? payment.amount;
    const oldAmount = payment.amount;

    // 1. Pre-validación (fuera de la transacción)
    if (input.allocations) {
      validateAllocations(input.allocations, newAmount);
    }

    // Si el monto disminuye, verificar que SUMA(asignaciones) ≤ nuevoMonto
    const allocations = input.allocations ?? payment.allocations;
    const allocTotal = allocations.reduce((sum, a) => sum + Number(a.amount), 0);
    const availableFunds = newAmount;
    if (Math.round(allocTotal * 100) > Math.round(availableFunds * 100)) {
      throw new ValidationError(
        `Las asignaciones (${allocTotal}) exceden los fondos disponibles (${availableFunds})`,
        PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
      );
    }

    // Pre-obtener configuración para reconstrucción del asiento contable
    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    await this.repo.transaction(async (tx) => {
      // a. Establecer contexto de auditoría
      await setAuditContext(tx, userId, organizationId);

      // b. Revertir asignaciones antiguas
      await this.reverseAllocations(tx, organizationId, payment.allocations);

      // c. Revertir saldos del asiento contable anterior (si existe)
      if (payment.journalEntryId) {
        const oldEntry = await tx.journalEntry.findFirst({
          where: { id: payment.journalEntryId, organizationId },
          include: {
            lines: {
              include: { account: true, contact: true },
              orderBy: { order: "asc" as const },
            },
            contact: true,
            voucherType: true,
          },
        });
        if (oldEntry) {
          await this.balancesService.applyVoid(tx, oldEntry as never);
        }
      }

      // d. Actualizar campos del pago
      await this.repo.updateTx(tx, organizationId, payment.id, {
        ...input,
        allocations: undefined, // las asignaciones se manejan por separado a continuación
      });

      // e. Manejar el asiento contable según las transiciones de monto
      const direction = await resolveDirection(
        tx,
        payment.allocations.map((a) => ({
          receivableId: a.receivableId ?? undefined,
          payableId: a.payableId ?? undefined,
          amount: Number(a.amount),
        })),
        payment.contactId,
      );
      const voucherTypeCode = direction === "COBRO" ? "CI" : "CE";

      if (oldAmount > 0 && newAmount > 0) {
        // ACTUALIZAR asiento existente en su lugar
        const effectiveDate = input.date ?? payment.date;
        const effectiveDescription = input.description ?? payment.description;
        const newLines = buildEntryLines(
          direction === "COBRO",
          input.method ?? payment.method,
          newAmount,
          settings.cajaGeneralAccountCode,
          settings.bancoAccountCode,
          settings.cxcAccountCode,
          settings.cxpAccountCode,
          payment.contactId,
          input.accountCode ?? payment.accountCode ?? undefined,
        );

        // Resolver IDs de cuenta para las líneas
        const resolvedLines = await Promise.all(
          newLines.map(async (line, idx) => {
            const account = await this.accountsRepo.findByCode(organizationId, line.accountCode);
            if (!account) throw new NotFoundError(`Cuenta ${line.accountCode}`);
            return {
              accountId: account.id,
              debit: line.side === "DEBIT" ? newAmount : 0,
              credit: line.side === "CREDIT" ? newAmount : 0,
              ...(line.contactId !== undefined && { contactId: line.contactId }),
              order: idx,
            };
          }),
        );

        const updatedEntry = await this.journalRepo.updateTx(
          tx,
          organizationId,
          payment.journalEntryId!,
          {
            date: effectiveDate,
            description: effectiveDescription,
            contactId: payment.contactId,
            referenceNumber: input.referenceNumber ?? payment.referenceNumber ?? undefined,
          },
          resolvedLines,
          userId,
        );

        await this.balancesService.applyPost(tx, updatedEntry);
      } else if (oldAmount === 0 && newAmount > 0) {
        // CREAR nuevo asiento contable
        const lines = buildEntryLines(
          direction === "COBRO",
          input.method ?? payment.method,
          newAmount,
          settings.cajaGeneralAccountCode,
          settings.bancoAccountCode,
          settings.cxcAccountCode,
          settings.cxpAccountCode,
          payment.contactId,
          input.accountCode ?? payment.accountCode ?? undefined,
        );

        const entry = await this.autoEntryGenerator.generate(tx, {
          organizationId,
          voucherTypeCode,
          contactId: payment.contactId,
          date: input.date ?? payment.date,
          periodId: payment.periodId,
          description: input.description ?? payment.description,
          referenceNumber: input.referenceNumber ?? payment.referenceNumber ?? undefined,
          sourceType: "payment",
          sourceId: payment.id,
          createdById: userId,
          lines,
        });

        await this.balancesService.applyPost(tx, entry);
        await this.repo.linkJournalEntry(tx, organizationId, payment.id, entry.id);
      } else if (oldAmount > 0 && newAmount === 0) {
        // ANULAR asiento contable existente
        if (payment.journalEntryId) {
          await tx.journalEntry.update({
            where: { id: payment.journalEntryId },
            data: { status: "VOIDED", updatedById: userId },
          });
          // Nota: los saldos ya fueron revertidos en el paso c
        }
      }
      // montoAnterior === 0 && nuevoMonto === 0 → sin cambios en el asiento

      // f. Manejar asignaciones
      const newAllocs = input.allocations;
      if (newAllocs !== undefined) {
        // Eliminar registros de asignaciones antiguas
        await this.repo.updateAllocations(tx, payment.id, []);

        // Validar nuevas asignaciones contra saldos CxC/CxP actualizados (post-reversión)
        for (const alloc of newAllocs) {
          if (alloc.receivableId) {
            const receivable = await tx.accountsReceivable.findUnique({
              where: { id: alloc.receivableId },
            });
            if (!receivable) throw new NotFoundError("Cuenta por cobrar");
            if (receivable.status === "VOIDED") {
              throw new ValidationError(
                "No se puede aplicar pago a una cuenta por cobrar anulada",
                PAYMENT_ALLOCATION_TARGET_VOIDED,
              );
            }
            if (alloc.amount > Number(receivable.balance)) {
              throw new ValidationError(
                `La asignación (${alloc.amount}) excede el saldo disponible (${Number(receivable.balance)}) de la CxC`,
                PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
              );
            }
          } else if (alloc.payableId) {
            const payable = await tx.accountsPayable.findUnique({
              where: { id: alloc.payableId },
            });
            if (!payable) throw new NotFoundError("Cuenta por pagar");
            if (payable.status === "VOIDED") {
              throw new ValidationError(
                "No se puede aplicar pago a una cuenta por pagar anulada",
                PAYMENT_ALLOCATION_TARGET_VOIDED,
              );
            }
            if (alloc.amount > Number(payable.balance)) {
              throw new ValidationError(
                `La asignación (${alloc.amount}) excede el saldo disponible (${Number(payable.balance)}) de la CxP`,
                PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
              );
            }
          }
        }

        // Crear nuevos registros de asignaciones y aplicar
        await this.repo.updateAllocations(tx, payment.id, newAllocs);
        await this.applyAllocations(tx, organizationId, newAllocs);
      } else {
        // Reaplicar asignaciones antiguas (fueron revertidas en el paso b)
        await this.applyAllocations(
          tx,
          organizationId,
          payment.allocations.map((a) => ({
            receivableId: a.receivableId,
            payableId: a.payableId,
            amount: Number(a.amount),
          })),
        );
      }
    });

    return (await this.repo.findById(organizationId, payment.id))!;
  }

  // ── Aplicar crédito de un pago existente a una factura (helper Modo B) ──

  private async applyCreditToInvoice(
    tx: Prisma.TransactionClient,
    organizationId: string,
    sourcePaymentId: string,
    receivableId: string,
    amount: number,
  ): Promise<void> {
    // 1. Validar monto
    if (amount <= 0) {
      throw new ValidationError(
        "El monto de crédito debe ser mayor a cero",
        PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
      );
    }

    // 2. Obtener pago origen con sus asignaciones
    const sourcePayment = await this.repo.findByIdTx(tx, organizationId, sourcePaymentId);
    if (!sourcePayment) throw new NotFoundError("Pago origen");
    if (sourcePayment.status === "VOIDED") {
      throw new ValidationError(
        "No se puede aplicar crédito de un pago anulado",
        PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
      );
    }

    // 3. Calcular monto no aplicado (a nivel de centavos)
    const totalAllocated = sourcePayment.allocations.reduce(
      (sum, a) => sum + Number(a.amount),
      0,
    );
    const unapplied = sourcePayment.amount - totalAllocated;
    if (Math.round(unapplied * 100) < Math.round(amount * 100)) {
      throw new ValidationError(
        `El crédito disponible (${unapplied}) es insuficiente para aplicar (${amount})`,
        PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
      );
    }

    // 4. Obtener la CxC destino
    const receivable = await tx.accountsReceivable.findUnique({
      where: { id: receivableId },
    });
    if (!receivable) throw new NotFoundError("Cuenta por cobrar");
    if (receivable.organizationId !== organizationId) throw new NotFoundError("Cuenta por cobrar");
    if (receivable.status === "VOIDED") {
      throw new ValidationError(
        "No se puede aplicar crédito a una cuenta por cobrar anulada",
        PAYMENT_ALLOCATION_TARGET_VOIDED,
      );
    }
    const cxcBalance = Number(receivable.balance);
    if (Math.round(cxcBalance * 100) < Math.round(amount * 100)) {
      throw new ValidationError(
        `El monto (${amount}) excede el saldo disponible (${cxcBalance}) de la CxC`,
        PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
      );
    }

    // 5. Crear PaymentAllocation en el pago origen apuntando a la CxC
    await tx.paymentAllocation.create({
      data: {
        paymentId: sourcePaymentId,
        receivableId,
        amount,
      },
    });

    // 6. Actualizar pagado/saldo/estado de la CxC
    const newPaid = Number(receivable.paid) + amount;
    const newBalance = Number(receivable.amount) - newPaid;
    await this.repo.updateCxCPaymentTx(
      tx,
      organizationId,
      receivableId,
      newPaid,
      Math.max(0, newBalance),
      computeReceivableStatus(newPaid, Math.max(0, newBalance)),
    );

    // 7. Actualizar el asiento contable del pago origen (si tiene uno)
    if (sourcePayment.journalEntryId) {
      const orgSettings = await this.orgSettingsService.getOrCreate(organizationId);

      const oldEntry = await tx.journalEntry.findFirst({
        where: { id: sourcePayment.journalEntryId, organizationId },
        include: {
          lines: {
            include: { account: true, contact: true },
            orderBy: { order: "asc" as const },
          },
          contact: true,
          voucherType: true,
        },
      });

      if (oldEntry) {
        // Revertir saldos existentes
        await this.balancesService.applyVoid(tx, oldEntry as never);

        // Construir nuevas líneas: líneas existentes + nuevo par de líneas de asignación de crédito CxC
        const cxcAccount = await this.accountsRepo.findByCode(
          organizationId,
          orgSettings.cxcAccountCode,
        );
        if (!cxcAccount) throw new NotFoundError(`Cuenta ${orgSettings.cxcAccountCode}`);

        const existingLines = oldEntry.lines.map((l, idx) => ({
          accountId: l.accountId,
          debit: Number(l.debit),
          credit: Number(l.credit),
          contactId: l.contactId ?? undefined,
          description: l.description ?? undefined,
          order: idx,
        }));

        // Línea de nota de crédito: DEBIT CxC (reduce la CxC) + CREDIT a cuenta contra
        // Patrón: aplicar crédito reduce el saldo CxC — DEBIT CxC, CREDIT Caja/Banco
        // En la práctica: el pago ya tiene Caja DEBIT / CxC CREDIT. Agregar asignación de crédito
        // significa que el saldo CxC disminuye más: agregar DEBIT CxC / CREDIT CxC (contra contacto)
        // Siguiendo el patrón exacto usado en buildEntryLines para cobro (2 líneas):
        // DEBIT Caja, CREDIT CxC — así una aplicación de crédito agrega: sin movimiento de caja, solo
        // el asiento contable de nota de crédito que es un par CxC directo contra.
        // Usar un par débito/crédito simple en la cuenta CxC con contactId.
        const newLines = [
          ...existingLines,
          {
            accountId: cxcAccount.id,
            debit: amount,
            credit: 0,
            contactId: sourcePayment.contactId,
            order: existingLines.length,
          },
          {
            accountId: cxcAccount.id,
            debit: 0,
            credit: amount,
            contactId: receivable.contactId,
            order: existingLines.length + 1,
          },
        ];

        const updatedEntry = await this.journalRepo.updateTx(
          tx,
          organizationId,
          sourcePayment.journalEntryId,
          {},
          newLines,
          "system",
        );

        // Reaplicar saldos con las líneas actualizadas
        await this.balancesService.applyPost(tx, updatedEntry as never);
      }
    }
  }

  // ── Aplicar solo crédito (Modo B: sin nuevo pago en efectivo) ──

  async applyCreditOnly(
    organizationId: string,
    userId: string,
    contactId: string,
    creditSources: CreditAllocationSource[],
  ): Promise<void> {
    // Validar que todos los pagos origen pertenezcan al mismo contacto
    for (const source of creditSources) {
      const payment = await this.repo.findById(organizationId, source.sourcePaymentId);
      if (!payment) throw new NotFoundError("Pago origen");
      if (payment.contactId !== contactId) {
        throw new ValidationError(
          "Todos los pagos origen deben pertenecer al mismo contacto",
          PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
        );
      }
    }

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId, organizationId);
      for (const source of creditSources) {
        await this.applyCreditToInvoice(
          tx,
          organizationId,
          source.sourcePaymentId,
          source.receivableId,
          source.amount,
        );
      }
    });
  }

  // ── Obtener resumen del saldo del cliente ──

  async getCustomerBalance(
    organizationId: string,
    contactId: string,
  ): Promise<{
    totalInvoiced: number;
    totalPaid: number;
    netBalance: number;
    unappliedCredit: number;
  }> {
    return this.repo.getCustomerBalance(organizationId, contactId);
  }
}

// ── Resolver dirección del pago (COBRO / PAGO) ──

async function resolveDirection(
  tx: Prisma.TransactionClient,
  allocations: AllocationInput[],
  contactId: string,
  explicitDirection?: PaymentDirection,
): Promise<PaymentDirection> {
  if (explicitDirection) return explicitDirection;
  if (allocations.length > 0) {
    return allocations[0].receivableId ? "COBRO" : "PAGO";
  }
  const contact = await tx.contact.findUnique({
    where: { id: contactId },
    select: { type: true },
  });
  if (!contact) throw new NotFoundError("Contacto");
  if (contact.type === "CLIENTE") return "COBRO";
  if (contact.type === "PROVEEDOR") return "PAGO";
  throw new ValidationError(
    "No se puede determinar la dirección del pago. Especifique la dirección o agregue al menos una asignación.",
    PAYMENT_DIRECTION_REQUIRED,
  );
}

// ── Validar consistencia de asignaciones ──

function validateAllocations(
  allocations: AllocationInput[],
  totalAmount: number,
): void {
  if (allocations.length > 0) {
    // Validar que todas las asignaciones sean de la misma dirección
    const hasReceivable = allocations.some((a) => !!a.receivableId);
    const hasPayable = allocations.some((a) => !!a.payableId);

    if (hasReceivable && hasPayable) {
      throw new ValidationError(
        "Todas las asignaciones deben ser del mismo tipo (CxC o CxP), no se pueden mezclar",
        PAYMENT_MIXED_ALLOCATION,
      );
    }
  }

  // Validar que SUMA(asignaciones) <= monto
  const allocTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
  // Usar comparación a nivel de centavos para evitar problemas de punto flotante
  if (Math.round(allocTotal * 100) > Math.round(totalAmount * 100)) {
    throw new ValidationError(
      `La suma de asignaciones (${allocTotal}) excede los fondos disponibles (${totalAmount})`,
      PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
    );
  }
}

// ── Regla de tesorería: construir líneas del asiento según dirección y método ──

function buildEntryLines(
  isCollection: boolean,
  method: string,
  amount: number,
  cajaAccountCode: string,
  bancoAccountCode: string,
  cxcAccountCode: string,
  cxpAccountCode: string,
  contactId: string,
  selectedAccountCode?: string,
): EntryLineTemplate[] {
  const isBankTransfer = method === "TRANSFERENCIA" || method === "DEPOSITO";

  if (isCollection) {
    if (isBankTransfer) {
      // Asiento de 4 líneas: cobro vía banco
      return [
        {
          accountCode: cajaAccountCode,
          side: "DEBIT",
          amount,
        },
        {
          accountCode: cxcAccountCode,
          side: "CREDIT",
          amount,
          contactId,
        },
        {
          accountCode: selectedAccountCode ?? bancoAccountCode,
          side: "DEBIT",
          amount,
        },
        {
          accountCode: cajaAccountCode,
          side: "CREDIT",
          amount,
        },
      ];
    } else {
      // Asiento de 2 líneas: cobro vía efectivo/cheque
      return [
        {
          accountCode: selectedAccountCode ?? cajaAccountCode,
          side: "DEBIT",
          amount,
        },
        {
          accountCode: cxcAccountCode,
          side: "CREDIT",
          amount,
          contactId,
        },
      ];
    }
  } else {
    if (isBankTransfer) {
      // Asiento de 4 líneas: pago vía banco
      return [
        {
          accountCode: cxpAccountCode,
          side: "DEBIT",
          amount,
          contactId,
        },
        {
          accountCode: cajaAccountCode,
          side: "CREDIT",
          amount,
        },
        {
          accountCode: cajaAccountCode,
          side: "DEBIT",
          amount,
        },
        {
          accountCode: selectedAccountCode ?? bancoAccountCode,
          side: "CREDIT",
          amount,
        },
      ];
    } else {
      // Asiento de 2 líneas: pago vía efectivo/cheque
      return [
        {
          accountCode: cxpAccountCode,
          side: "DEBIT",
          amount,
          contactId,
        },
        {
          accountCode: selectedAccountCode ?? cajaAccountCode,
          side: "CREDIT",
          amount,
        },
      ];
    }
  }
}
