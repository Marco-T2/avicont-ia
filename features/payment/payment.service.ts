import {
  NotFoundError,
  ValidationError,
  PAYMENT_AMBIGUOUS_LINK,
  PAYMENT_MISSING_LINK,
  PAYMENT_EXCEEDS_BALANCE,
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
import { ReceivablesRepository } from "@/features/receivables/receivables.repository";
import { PayablesRepository } from "@/features/payables/payables.repository";
import { AccountBalancesService } from "@/features/account-balances";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import type {
  PaymentWithRelations,
  CreatePaymentInput,
  UpdatePaymentInput,
  PaymentFilters,
} from "./payment.types";
import type { EntryLineTemplate } from "@/features/shared/auto-entry-generator";

export class PaymentService {
  private readonly repo: PaymentRepository;
  private readonly orgSettingsService: OrgSettingsService;
  private readonly autoEntryGenerator: AutoEntryGenerator;
  private readonly receivablesRepo: ReceivablesRepository;
  private readonly payablesRepo: PayablesRepository;
  private readonly balancesService: AccountBalancesService;
  private readonly periodsService: FiscalPeriodsService;

  constructor(
    repo?: PaymentRepository,
    orgSettingsService?: OrgSettingsService,
    autoEntryGenerator?: AutoEntryGenerator,
    receivablesRepo?: ReceivablesRepository,
    payablesRepo?: PayablesRepository,
    balancesService?: AccountBalancesService,
    periodsService?: FiscalPeriodsService,
  ) {
    this.repo = repo ?? new PaymentRepository();
    this.orgSettingsService = orgSettingsService ?? new OrgSettingsService();
    this.receivablesRepo = receivablesRepo ?? new ReceivablesRepository();
    this.payablesRepo = payablesRepo ?? new PayablesRepository();
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
    // 1. Validate exactly one link
    const hasReceivable = !!input.receivableId;
    const hasPayable = !!input.payableId;

    if (hasReceivable && hasPayable) {
      throw new ValidationError(
        "El pago no puede estar vinculado a una CxC y a una CxP simultáneamente",
        PAYMENT_AMBIGUOUS_LINK,
      );
    }
    if (!hasReceivable && !hasPayable) {
      throw new ValidationError(
        "El pago debe estar vinculado a una CxC o a una CxP",
        PAYMENT_MISSING_LINK,
      );
    }

    // 2. Fetch linked document, derive contactId and validate balance
    let contactId: string;
    let linkedBalance: number;

    if (hasReceivable) {
      const receivable = await this.receivablesRepo.findById(
        organizationId,
        input.receivableId!,
      );
      if (!receivable) throw new NotFoundError("Cuenta por cobrar");
      contactId = receivable.contactId;
      linkedBalance = Number(receivable.balance);
    } else {
      const payable = await this.payablesRepo.findById(
        organizationId,
        input.payableId!,
      );
      if (!payable) throw new NotFoundError("Cuenta por pagar");
      contactId = payable.contactId;
      linkedBalance = Number(payable.balance);
    }

    // 3. Validate amount does not exceed balance
    if (input.amount > linkedBalance) {
      throw new ValidationError(
        `El monto del pago (${input.amount}) excede el saldo disponible (${linkedBalance})`,
        PAYMENT_EXCEEDS_BALANCE,
      );
    }

    // 4. Create payment with DRAFT status
    return this.repo.create(organizationId, input, contactId);
  }

  // ── Update a DRAFT payment ──

  async update(
    organizationId: string,
    id: string,
    input: UpdatePaymentInput,
  ): Promise<PaymentWithRelations> {
    const payment = await this.getById(organizationId, id);
    validateDraftOnly(payment.status as "DRAFT" | "POSTED" | "VOIDED");

    // If amount is changing, validate against linked document balance
    if (input.amount !== undefined) {
      let linkedBalance: number;
      if (payment.receivableId) {
        const receivable = await this.receivablesRepo.findById(
          organizationId,
          payment.receivableId,
        );
        if (!receivable) throw new NotFoundError("Cuenta por cobrar");
        linkedBalance = Number(receivable.balance);
      } else if (payment.payableId) {
        const payable = await this.payablesRepo.findById(
          organizationId,
          payment.payableId,
        );
        if (!payable) throw new NotFoundError("Cuenta por pagar");
        linkedBalance = Number(payable.balance);
      } else {
        linkedBalance = Infinity;
      }

      if (input.amount > linkedBalance) {
        throw new ValidationError(
          `El monto del pago (${input.amount}) excede el saldo disponible (${linkedBalance})`,
          PAYMENT_EXCEEDS_BALANCE,
        );
      }
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

    // Get org settings for account codes
    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    const isCollection = !!payment.receivableId;
    const amount = Number(payment.amount);

    // Fetch fresh linked document and validate balance again
    let linkedDocBalance: number;
    let linkedDocPaid: number;
    let linkedDocAmount: number;
    let linkedDocContactId: string;

    if (isCollection) {
      const receivable = await this.receivablesRepo.findById(
        organizationId,
        payment.receivableId!,
      );
      if (!receivable) throw new NotFoundError("Cuenta por cobrar");
      linkedDocBalance = Number(receivable.balance);
      linkedDocPaid = Number(receivable.paid);
      linkedDocAmount = Number(receivable.amount);
      linkedDocContactId = receivable.contactId;
    } else {
      const payable = await this.payablesRepo.findById(
        organizationId,
        payment.payableId!,
      );
      if (!payable) throw new NotFoundError("Cuenta por pagar");
      linkedDocBalance = Number(payable.balance);
      linkedDocPaid = Number(payable.paid);
      linkedDocAmount = Number(payable.amount);
      linkedDocContactId = payable.contactId;
    }

    if (amount > linkedDocBalance) {
      throw new ValidationError(
        `El monto del pago (${amount}) excede el saldo disponible (${linkedDocBalance})`,
        PAYMENT_EXCEEDS_BALANCE,
      );
    }

    // Build entry lines based on direction and method
    const voucherTypeCode = isCollection ? "CI" : "CE";
    const lines = buildEntryLines(
      isCollection,
      payment.method,
      amount,
      settings.cajaGeneralAccountCode,
      settings.bancoAccountCode,
      settings.cxcAccountCode,
      settings.cxpAccountCode,
      linkedDocContactId,
    );

    await this.repo.transaction(async (tx) => {
      // 1. Update payment status to POSTED
      await this.repo.updateStatusTx(tx, organizationId, id, "POSTED");

      // 2. Generate journal entry
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

      // 3. Apply account balance changes
      await this.balancesService.applyPost(tx, entry);

      // 4. Link journal entry to payment
      await this.repo.linkJournalEntry(tx, id, entry.id);

      // 5. Update linked CxC or CxP
      const newPaid = linkedDocPaid + amount;
      const newBalance = linkedDocAmount - newPaid;
      const newStatus = newBalance <= 0 ? "PAID" : "PARTIAL";

      if (isCollection) {
        await this.receivablesRepo.updatePaymentTx(
          tx,
          payment.receivableId!,
          newPaid,
          Math.max(0, newBalance),
          newStatus,
        );
      } else {
        await this.payablesRepo.updatePaymentTx(
          tx,
          payment.payableId!,
          newPaid,
          Math.max(0, newBalance),
          newStatus,
        );
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

    const amount = Number(payment.amount);

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

      // 3. Revert linked CxC or CxP
      if (payment.receivableId) {
        const receivable = await tx.accountsReceivable.findUnique({
          where: { id: payment.receivableId },
        });
        if (receivable) {
          const revertedPaid = Math.max(0, Number(receivable.paid) - amount);
          const revertedBalance = Number(receivable.amount) - revertedPaid;
          const revertedStatus = revertedPaid === 0 ? "PENDING" : "PARTIAL";
          await this.receivablesRepo.updatePaymentTx(
            tx,
            payment.receivableId,
            revertedPaid,
            revertedBalance,
            revertedStatus,
          );
        }
      } else if (payment.payableId) {
        const payable = await tx.accountsPayable.findUnique({
          where: { id: payment.payableId },
        });
        if (payable) {
          const revertedPaid = Math.max(0, Number(payable.paid) - amount);
          const revertedBalance = Number(payable.amount) - revertedPaid;
          const revertedStatus = revertedPaid === 0 ? "PENDING" : "PARTIAL";
          await this.payablesRepo.updatePaymentTx(
            tx,
            payment.payableId,
            revertedPaid,
            revertedBalance,
            revertedStatus,
          );
        }
      }
    });

    const updated = await this.repo.findById(organizationId, id);
    return updated!;
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
