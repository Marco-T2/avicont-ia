import { Prisma } from "@/generated/prisma/client";
import {
  NotFoundError,
  ValidationError,
  PAYMENT_MIXED_ALLOCATION,
  PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
  PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
  PAYMENT_ALLOCATION_TARGET_VOIDED,
  PAYMENT_DIRECTION_REQUIRED,
  PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
  PAYMENT_HAS_ACTIVE_CREDIT_CONSUMERS,
  PAYMENT_INSUFFICIENT_FUNDS,
  INVALID_STATUS_TRANSITION,
} from "@/features/shared/errors";
import {
  validateTransition,
  validateDraftOnly,
  validateLockedEdit,
  validatePeriodOpen,
  type DocumentStatus,
} from "@/features/shared/document-lifecycle.service";
import { setAuditContext } from "@/features/shared/audit-context";
import { PaymentRepository } from "./payment.repository";
import { OrgSettingsService } from "@/features/org-settings";
import { AutoEntryGenerator } from "@/features/shared/auto-entry-generator";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { VoucherTypesRepository } from "@/features/voucher-types/voucher-types.repository";
import { AccountBalancesService } from "@/features/account-balances";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import type {
  PaymentWithRelations,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilters,
  AllocationInput,
  PaymentDirection,
} from "./payment.types";
import type { EntryLineTemplate } from "@/features/shared/auto-entry-generator";

export class PaymentService {
  private readonly repo: PaymentRepository;
  private readonly orgSettingsService: OrgSettingsService;
  private readonly autoEntryGenerator: AutoEntryGenerator;
  private readonly balancesService: AccountBalancesService;
  private readonly periodsService: FiscalPeriodsService;

  constructor(
    repo?: PaymentRepository,
    orgSettingsService?: OrgSettingsService,
    autoEntryGenerator?: AutoEntryGenerator,
    balancesService?: AccountBalancesService,
    periodsService?: FiscalPeriodsService,
  ) {
    this.repo = repo ?? new PaymentRepository();
    this.orgSettingsService = orgSettingsService ?? new OrgSettingsService();
    this.balancesService = balancesService ?? new AccountBalancesService();
    this.periodsService = periodsService ?? new FiscalPeriodsService();

    const accountsRepo = new AccountsRepository();
    const voucherTypesRepo = new VoucherTypesRepository();
    this.autoEntryGenerator =
      autoEntryGenerator ?? new AutoEntryGenerator(accountsRepo, voucherTypesRepo);
  }

  // ── List payments ──

  async list(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<PaymentWithRelations[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Get a single payment ──

  async getById(organizationId: string, id: string): Promise<PaymentWithRelations> {
    const row = await this.repo.findById(organizationId, id);
    if (!row) throw new NotFoundError("Pago");
    return row;
  }

  // ── Create a payment in DRAFT ──

  async create(
    organizationId: string,
    input: CreatePaymentInput,
  ): Promise<PaymentWithRelations> {
    // 1. Validate allocations
    validateAllocations(input.allocations, input.amount);

    // 2. Create payment with allocations
    return this.repo.create(organizationId, input);
  }

  // ── Create and post a payment in one atomic transaction ──

  async createAndPost(
    organizationId: string,
    input: CreatePaymentInput,
    userId: string,
  ): Promise<PaymentWithRelations> {
    // 1. Validate allocations (amount=0 allowed when creditApplied covers it)
    validateAllocations(input.allocations, input.amount, input.creditApplied ?? 0);

    // 1b. Pre-validate credit if provided
    if (input.creditApplied && input.creditApplied > 0) {
      const balance = await this.repo.getCustomerBalance(organizationId, input.contactId);
      if (input.creditApplied > balance.unappliedCredit) {
        throw new ValidationError(
          `El crédito aplicado (${input.creditApplied}) excede el crédito disponible del cliente (${balance.unappliedCredit})`,
          PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
        );
      }
      const allocTotal = input.allocations.reduce((sum, a) => sum + a.amount, 0);
      const totalFunds = input.amount + input.creditApplied;
      if (Math.round(allocTotal * 100) > Math.round(totalFunds * 100)) {
        throw new ValidationError(
          `Los fondos disponibles (efectivo + crédito = ${totalFunds}) no cubren las asignaciones (${allocTotal})`,
          PAYMENT_INSUFFICIENT_FUNDS,
        );
      }
    }

    // 2. Validate fiscal period is OPEN
    const period = await this.periodsService.getById(organizationId, input.periodId);
    await validatePeriodOpen(period);

    // 3. Get org settings for account codes (outside transaction — read-only)
    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    let paymentId = "";

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId);

      // Resolve direction inside transaction (may need to query Contact.type)
      const direction = await resolveDirection(
        tx,
        input.allocations,
        input.contactId,
        input.direction,
      );

      const voucherTypeCode = direction === "COBRO" ? "CI" : "CE";
      const amount = input.amount;

      // Create payment directly as POSTED
      const payment = await this.repo.createPostedTx(tx, organizationId, input);
      paymentId = payment.id;

      // Validate each allocation against fresh CxC/CxP balance
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

      // Generate journal entry only when amount > 0 (skip for credit-only payments)
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

        // Apply account balance changes
        await this.balancesService.applyPost(tx, entry);

        // Link journal entry to payment
        await this.repo.linkJournalEntry(tx, payment.id, entry.id);
      }

      // Update each CxC/CxP allocation target
      for (const alloc of input.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable) continue;

          const newPaid = Number(receivable.paid) + alloc.amount;
          const newBalance = Number(receivable.amount) - newPaid;
          const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";

          await this.repo.updateCxCPaymentTx(
            tx,
            alloc.receivableId,
            newPaid,
            Math.max(0, newBalance),
            newStatus,
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable) continue;

          const newPaid = Number(payable.paid) + alloc.amount;
          const newBalance = Number(payable.amount) - newPaid;
          const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";

          await this.repo.updateCxPPaymentTx(
            tx,
            alloc.payableId,
            newPaid,
            Math.max(0, newBalance),
            newStatus,
          );
        }
      }

      // Apply credit consumption FIFO if creditApplied > 0
      if (input.creditApplied && input.creditApplied > 0) {
        await allocateCredit(
          tx,
          organizationId,
          input.contactId,
          payment.id,
          input.creditApplied,
        );
      }
    });

    const result = await this.repo.findById(organizationId, paymentId);
    return result!;
  }

  // ── Update a DRAFT payment (or LOCKED with justification) ──

  async update(
    organizationId: string,
    id: string,
    input: UpdatePaymentInput,
    role?: string,
    justification?: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);
    const status = payment.status as DocumentStatus;

    if (status === "LOCKED") {
      validateLockedEdit(status, role!, justification);
    } else {
      validateDraftOnly(status);
    }

    // Validate new allocations if provided
    if (input.allocations) {
      const amount = input.amount ?? payment.amount;
      validateAllocations(input.allocations, amount);
    }

    // For LOCKED edits, wrap in transaction with audit context
    if (status === "LOCKED") {
      return this.repo.transaction(async (tx) => {
        await setAuditContext(tx, payment.createdById ?? "unknown", justification);
        return this.repo.updateTx(tx, organizationId, id, input);
      });
    }

    return this.repo.update(organizationId, id, input);
  }

  // ── Delete a DRAFT payment ──

  async delete(organizationId: string, id: string): Promise<void> {
    const payment = await this.getById(organizationId, id);
    validateDraftOnly(payment.status as DocumentStatus);
    await this.repo.delete(organizationId, id);
  }

  // ── Post a payment (DRAFT → POSTED) ──

  async post(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);

    // Validate lifecycle transition
    validateTransition(
      payment.status as DocumentStatus,
      "POSTED",
    );

    // Validate fiscal period is OPEN
    const period = await this.periodsService.getById(organizationId, payment.periodId);
    await validatePeriodOpen(period);

    // Get org settings for account codes (outside transaction — read-only)
    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    await this.repo.transaction(async (tx) => {
      // Resolve direction inside transaction (may need to query Contact.type)
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

      // 1. Validate each allocation against fresh CxC/CxP balance
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

      // 2. Update payment status to POSTED
      await this.repo.updateStatusTx(tx, organizationId, id, "POSTED");

      // 3. Build entry lines and generate journal entry
      const lines = buildEntryLines(
        direction === "COBRO",
        payment.method,
        amount,
        settings.cajaGeneralAccountCode,
        settings.bancoAccountCode,
        settings.cxcAccountCode,
        settings.cxpAccountCode,
        payment.contactId,
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

      // 4. Apply account balance changes
      await this.balancesService.applyPost(tx, entry);

      // 5. Link journal entry to payment
      await this.repo.linkJournalEntry(tx, id, entry.id);

      // 6. Update each CxC/CxP allocation target
      for (const alloc of payment.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable) continue;

          const newPaid = Number(receivable.paid) + alloc.amount;
          const newBalance = Number(receivable.amount) - newPaid;
          const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";

          await this.repo.updateCxCPaymentTx(
            tx,
            alloc.receivableId,
            newPaid,
            Math.max(0, newBalance),
            newStatus,
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable) continue;

          const newPaid = Number(payable.paid) + alloc.amount;
          const newBalance = Number(payable.amount) - newPaid;
          const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";

          await this.repo.updateCxPPaymentTx(
            tx,
            alloc.payableId,
            newPaid,
            Math.max(0, newBalance),
            newStatus,
          );
        }
      }
    });

    // Re-fetch with all links populated
    const updated = await this.repo.findById(organizationId, id);
    return updated!;
  }

  // ── Void a payment (POSTED → VOIDED) ──

  async void(
    organizationId: string,
    id: string,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);
    const status = payment.status as DocumentStatus;

    // Validate lifecycle transition
    validateTransition(status, "VOIDED");

    // If LOCKED, require role + justification
    if (status === "LOCKED") {
      validateLockedEdit(status, role!, justification);
    }

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId, justification);

      // 0. Guard: block if this payment's credit was consumed by active payments
      const activeConsumers = await tx.creditConsumption.findMany({
        where: {
          sourcePaymentId: id,
          consumerPayment: { status: { not: "VOIDED" } },
        },
        include: {
          consumerPayment: { select: { description: true, amount: true } },
        },
      });

      if (activeConsumers.length > 0) {
        const list = activeConsumers
          .map(
            (c) =>
              `${c.consumerPayment.description} (${Number(c.consumerPayment.amount).toFixed(2)})`,
          )
          .join(", ");
        throw new ValidationError(
          `No se puede anular el pago porque su crédito fue aplicado en otros cobros. Anule primero: ${list}`,
          PAYMENT_HAS_ACTIVE_CREDIT_CONSUMERS,
        );
      }

      // 1. Update payment status to VOIDED
      await this.repo.updateStatusTx(tx, organizationId, id, "VOIDED");

      // 2. Void linked journal entry and reverse balances
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

      // 3. Revert each allocation's CxC/CxP
      for (const alloc of payment.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable || receivable.status === "VOIDED") continue;

          const revertedPaid = Math.max(0, Number(receivable.paid) - alloc.amount);
          const revertedBalance = Number(receivable.amount) - revertedPaid;
          const revertedStatus = revertedPaid === 0 ? "PENDING" : "PARTIAL";

          await this.repo.updateCxCPaymentTx(
            tx,
            alloc.receivableId,
            revertedPaid,
            Math.max(0, revertedBalance),
            revertedStatus,
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable || payable.status === "VOIDED") continue;

          const revertedPaid = Math.max(0, Number(payable.paid) - alloc.amount);
          const revertedBalance = Number(payable.amount) - revertedPaid;
          const revertedStatus = revertedPaid === 0 ? "PENDING" : "PARTIAL";

          await this.repo.updateCxPPaymentTx(
            tx,
            alloc.payableId,
            revertedPaid,
            Math.max(0, revertedBalance),
            revertedStatus,
          );
        }
      }

      // 4. Restore credit: delete consumption records where this payment consumed credit
      await tx.creditConsumption.deleteMany({
        where: { consumerPaymentId: id },
      });
    });

    const updated = await this.repo.findById(organizationId, id);
    return updated!;
  }

  // ── Update allocations on a POSTED/LOCKED payment (journal entry unchanged) ──

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

    // Only POSTED or LOCKED payments can have allocations updated this way
    if (status !== "POSTED" && status !== "LOCKED") {
      throw new ValidationError(
        "Solo se pueden reasignar pagos contabilizados o bloqueados. Use la edición normal para borradores.",
        INVALID_STATUS_TRANSITION,
      );
    }

    // LOCKED requires role + justification
    if (status === "LOCKED") {
      validateLockedEdit(status, role!, justification);
    }

    // Validate new allocations against payment amount + creditApplied
    const creditApplied = Number(payment.creditApplied ?? 0);
    validateAllocations(newAllocations, payment.amount, creditApplied);

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId, justification);

      // 1. Reverse old allocations — restore CxC/CxP balances
      for (const alloc of payment.allocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable || receivable.status === "VOIDED") continue;

          const revertedPaid = Math.max(0, Number(receivable.paid) - alloc.amount);
          const revertedBalance = Number(receivable.amount) - revertedPaid;
          const revertedStatus = revertedPaid === 0 ? "PENDING" : "PARTIAL";

          await this.repo.updateCxCPaymentTx(
            tx,
            alloc.receivableId,
            revertedPaid,
            Math.max(0, revertedBalance),
            revertedStatus,
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable || payable.status === "VOIDED") continue;

          const revertedPaid = Math.max(0, Number(payable.paid) - alloc.amount);
          const revertedBalance = Number(payable.amount) - revertedPaid;
          const revertedStatus = revertedPaid === 0 ? "PENDING" : "PARTIAL";

          await this.repo.updateCxPPaymentTx(
            tx,
            alloc.payableId,
            revertedPaid,
            Math.max(0, revertedBalance),
            revertedStatus,
          );
        }
      }

      // 2. Delete old allocation records
      await this.repo.updateAllocations(tx, id, []);

      // 3. Validate new allocations against FRESH CxC/CxP balances (post-reversal)
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

      // 4. Create new allocation records
      await this.repo.updateAllocations(tx, id, newAllocations);

      // 5. Apply new allocations — update CxC/CxP balances
      for (const alloc of newAllocations) {
        if (alloc.receivableId) {
          const receivable = await tx.accountsReceivable.findUnique({
            where: { id: alloc.receivableId },
          });
          if (!receivable) continue;

          const newPaid = Number(receivable.paid) + alloc.amount;
          const newBalance = Number(receivable.amount) - newPaid;
          const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";

          await this.repo.updateCxCPaymentTx(
            tx,
            alloc.receivableId,
            newPaid,
            Math.max(0, newBalance),
            newStatus,
          );
        } else if (alloc.payableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: alloc.payableId },
          });
          if (!payable) continue;

          const newPaid = Number(payable.paid) + alloc.amount;
          const newBalance = Number(payable.amount) - newPaid;
          const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";

          await this.repo.updateCxPPaymentTx(
            tx,
            alloc.payableId,
            newPaid,
            Math.max(0, newBalance),
            newStatus,
          );
        }
      }

      // 6. Journal entry is NOT touched — intentional per spec (REQ-5.4)
    });

    return (await this.repo.findById(organizationId, id))!;
  }

  // ── Get customer balance summary ──

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

// ── Resolve payment direction (COBRO / PAGO) ──

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

// ── Allocate credit FIFO from source payments ──

async function allocateCredit(
  tx: Prisma.TransactionClient,
  organizationId: string,
  contactId: string,
  consumerPaymentId: string,
  creditNeeded: number,
): Promise<void> {
  // Find non-voided payments for this contact (excluding the consumer itself), ordered FIFO
  const payments = await tx.payment.findMany({
    where: {
      organizationId,
      contactId,
      status: { not: "VOIDED" },
      id: { not: consumerPaymentId },
    },
    include: {
      allocations: true,
      creditSources: true, // credit already consumed FROM this payment
    },
    orderBy: { date: "asc" },
  });

  let remaining = creditNeeded;

  for (const payment of payments) {
    if (remaining <= 0) break;

    const paymentAmount = Number(payment.amount);
    const totalAllocated = payment.allocations.reduce(
      (sum, a) => sum + Number(a.amount),
      0,
    );
    const totalConsumedFromThis = payment.creditSources.reduce(
      (sum, c) => sum + Number(c.amount),
      0,
    );
    const available = paymentAmount - totalAllocated - totalConsumedFromThis;

    if (available <= 0) continue;

    const consume = Math.min(available, remaining);

    await tx.creditConsumption.create({
      data: {
        organizationId,
        consumerPaymentId,
        sourcePaymentId: payment.id,
        amount: new Prisma.Decimal(consume),
      },
    });

    remaining -= consume;
  }

  // Safety net — should not happen if pre-validation passed
  if (remaining > 0.001) {
    throw new ValidationError(
      `Crédito insuficiente: no se encontró suficiente crédito disponible`,
      PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
    );
  }
}

// ── Validate allocations consistency ──

function validateAllocations(
  allocations: AllocationInput[],
  totalAmount: number,
  creditApplied: number = 0,
): void {
  if (allocations.length > 0) {
    // Validate all allocations same direction
    const hasReceivable = allocations.some((a) => !!a.receivableId);
    const hasPayable = allocations.some((a) => !!a.payableId);

    if (hasReceivable && hasPayable) {
      throw new ValidationError(
        "Todas las asignaciones deben ser del mismo tipo (CxC o CxP), no se pueden mezclar",
        PAYMENT_MIXED_ALLOCATION,
      );
    }
  }

  // Validate SUM(allocations) <= amount + creditApplied
  const allocTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
  const availableFunds = totalAmount + creditApplied;
  // Use cent-level comparison to avoid floating point issues
  if (Math.round(allocTotal * 100) > Math.round(availableFunds * 100)) {
    throw new ValidationError(
      `La suma de asignaciones (${allocTotal}) excede los fondos disponibles (${availableFunds})`,
      PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
    );
  }
}

// ── Treasury rule: build entry lines based on direction and method ──

function buildEntryLines(
  isCollection: boolean,
  method: string,
  amount: number,
  cajaAccountCode: string,
  bancoAccountCode: string,
  cxcAccountCode: string,
  cxpAccountCode: string,
  contactId: string,
): EntryLineTemplate[] {
  const isBankTransfer = method === "TRANSFERENCIA" || method === "DEPOSITO";

  if (isCollection) {
    if (isBankTransfer) {
      // 4-line entry: cobro via bank
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
          accountCode: bancoAccountCode,
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
      // 2-line entry: cobro via cash/check
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
      ];
    }
  } else {
    if (isBankTransfer) {
      // 4-line entry: pago via bank
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
          accountCode: bancoAccountCode,
          side: "CREDIT",
          amount,
        },
      ];
    } else {
      // 2-line entry: pago via cash/check
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
      ];
    }
  }
}
