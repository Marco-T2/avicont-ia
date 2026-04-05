import {
  NotFoundError,
  ValidationError,
  PAYMENT_MIXED_ALLOCATION,
  PAYMENT_ALLOCATION_EXCEEDS_BALANCE,
  PAYMENT_ALLOCATIONS_EXCEED_TOTAL,
  PAYMENT_ALLOCATION_TARGET_VOIDED,
  PAYMENT_NO_ALLOCATIONS,
} from "@/features/shared/errors";
import {
  validateTransition,
  validateDraftOnly,
  validatePeriodOpen,
} from "@/features/shared/document-lifecycle.service";
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

  // ── Update a DRAFT payment ──

  async update(
    organizationId: string,
    id: string,
    input: UpdatePaymentInput,
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);
    validateDraftOnly(payment.status as "DRAFT" | "POSTED" | "VOIDED");

    // Validate new allocations if provided
    if (input.allocations) {
      const amount = input.amount ?? payment.amount;
      validateAllocations(input.allocations, amount);
    }

    return this.repo.update(organizationId, id, input);
  }

  // ── Delete a DRAFT payment ──

  async delete(organizationId: string, id: string): Promise<void> {
    const payment = await this.getById(organizationId, id);
    validateDraftOnly(payment.status as "DRAFT" | "POSTED" | "VOIDED");
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
      payment.status as "DRAFT" | "POSTED" | "VOIDED",
      "POSTED",
    );

    // Validate fiscal period is OPEN
    const period = await this.periodsService.getById(organizationId, payment.periodId);
    await validatePeriodOpen(period);

    // Validate at least 1 allocation
    if (!payment.allocations || payment.allocations.length === 0) {
      throw new ValidationError(
        "El pago debe tener al menos una asignación para ser contabilizado",
        PAYMENT_NO_ALLOCATIONS,
      );
    }

    // Determine direction from allocations
    const direction: PaymentDirection = payment.allocations[0].receivableId
      ? "COBRO"
      : "PAGO";

    // Get org settings for account codes
    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    const voucherTypeCode = direction === "COBRO" ? "CI" : "CE";
    const amount = payment.amount;

    // Build entry lines based on direction and method
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

    await this.repo.transaction(async (tx) => {
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

      // 3. Generate journal entry
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
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);

    // Validate lifecycle transition
    validateTransition(
      payment.status as "DRAFT" | "POSTED" | "VOIDED",
      "VOIDED",
    );

    await this.repo.transaction(async (tx) => {
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
    });

    const updated = await this.repo.findById(organizationId, id);
    return updated!;
  }
}

// ── Validate allocations consistency ──

function validateAllocations(allocations: AllocationInput[], totalAmount: number): void {
  if (!allocations || allocations.length === 0) {
    throw new ValidationError(
      "El pago debe tener al menos una asignación",
      PAYMENT_NO_ALLOCATIONS,
    );
  }

  // Validate all allocations same direction
  const hasReceivable = allocations.some((a) => !!a.receivableId);
  const hasPayable = allocations.some((a) => !!a.payableId);

  if (hasReceivable && hasPayable) {
    throw new ValidationError(
      "Todas las asignaciones deben ser del mismo tipo (CxC o CxP), no se pueden mezclar",
      PAYMENT_MIXED_ALLOCATION,
    );
  }

  // Validate SUM(allocations) <= amount
  const allocTotal = allocations.reduce((sum, a) => sum + a.amount, 0);
  // Use cent-level comparison to avoid floating point issues
  if (Math.round(allocTotal * 100) > Math.round(totalAmount * 100)) {
    throw new ValidationError(
      `La suma de asignaciones (${allocTotal}) excede el monto total del pago (${totalAmount})`,
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
