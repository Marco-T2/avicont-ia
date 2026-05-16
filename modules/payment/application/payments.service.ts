import "server-only";
import { withAuditTx } from "@/features/shared/audit-tx";
// Reuse the shared LOCKED-edit helper (REQ-A6) — single source of truth for
// role + period + justification length validation.
import { validateLockedEdit } from "@/features/accounting/server";

/**
 * Tx-bound write use cases return the resulting Payment aggregate plus the
 * correlationId allocated by withAuditTx. The shim in `features/payment/`
 * translates this into the legacy `WithCorrelation<PaymentWithRelations>`
 * row shape — at the application layer we keep the entity instance to avoid
 * losing its behaviour (status getter, allocations getters etc.) which would
 * happen if we tried to spread a class instance into a plain object.
 */
export interface PaymentResult {
  payment: Payment;
  correlationId: string;
}

type AuditTxRepo = Parameters<typeof withAuditTx>[0];

function asAuditTxRepo(repo: PaymentRepository): AuditTxRepo {
  return {
    transaction: (fn, options) =>
      repo.transaction(
        (tx) => fn(tx as Parameters<typeof fn>[0]),
        options,
      ),
  };
}
import { NotFoundError, ValidationError } from "@/features/shared/errors";
import type { Payment } from "../domain/payment.entity";
import type {
  PaymentRepository,
  PaymentFilters,
  CustomerBalanceSnapshot,
} from "../domain/payment.repository";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";
import type { PaymentMethod } from "../domain/value-objects/payment-method";
import type { PaymentDirection } from "../domain/value-objects/payment-direction";
import type { ReceivablesPort } from "../domain/ports/receivables.port";
import type { PayablesPort } from "../domain/ports/payables.port";
import type { OrgSettingsReadPort } from "../domain/ports/org-settings-read.port";
import type { FiscalPeriodsReadPort } from "../domain/ports/fiscal-periods-read.port";
import type {
  AccountingPort,
  ResolvedEntryLine,
} from "../domain/ports/accounting.port";
import type { AccountBalancesPort } from "../domain/ports/account-balances.port";
import type { ContactReadPort } from "../domain/ports/contact-read.port";
import { Payment as PaymentEntity } from "../domain/payment.entity";
import { PaymentAllocation } from "../domain/payment-allocation.entity";
import { AllocationTarget } from "../domain/value-objects/allocation-target";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
  FISCAL_PERIOD_CLOSED,
  INVALID_STATUS_TRANSITION,
} from "@/features/shared/errors";
import {
  resolveDirection,
  type AllocationDirectionInput,
} from "./helpers/resolve-direction";
import { buildEntryLines } from "./helpers/build-entry-lines";
import { isDateWithinPeriod } from "@/modules/fiscal-periods/domain/date-period-check";
import { PaymentDateOutsidePeriod } from "../domain/errors/payment-errors";

// ── Service-layer input shapes ─────────────────────────────────────────────

export interface AllocationInput {
  receivableId?: string;
  payableId?: string;
  amount: number;
}

export interface CreditAllocationSource {
  sourcePaymentId: string;
  receivableId: string;
  amount: number;
}

export interface CreatePaymentServiceInput {
  method: PaymentMethod;
  date: Date;
  amount: number;
  direction?: PaymentDirection;
  description: string;
  periodId: string;
  contactId: string;
  referenceNumber?: number | null;
  operationalDocTypeId?: string | null;
  accountCode?: string | null;
  notes?: string | null;
  allocations: AllocationInput[];
  creditSources?: CreditAllocationSource[];
}

export interface UpdatePaymentServiceInput {
  method?: PaymentMethod;
  date?: Date;
  amount?: number;
  description?: string;
  referenceNumber?: number | null;
  operationalDocTypeId?: string | null;
  accountCode?: string | null;
  notes?: string | null;
  allocations?: AllocationInput[];
}

/**
 * Context carried by edit-style use cases (`update`, `void`,
 * `updateAllocations`) to satisfy REQ-A6 when the target payment is in
 * `LOCKED` status. Both fields are optional at the input layer because the
 * same use cases also serve DRAFT/POSTED/VOIDED transitions where they are
 * not applicable; the LOCKED branch validates them at runtime via
 * `validateLockedEdit`. Mirrors the legacy
 * (role?, justification?) tail parameters in
 * `features/payment/payment.service.ts`.
 */
export interface LockedEditContext {
  role?: string;
  justification?: string;
}

export interface PaymentsServiceDeps {
  repo: PaymentRepository;
  receivables: ReceivablesPort;
  payables: PayablesPort;
  orgSettings: OrgSettingsReadPort;
  fiscalPeriods: FiscalPeriodsReadPort;
  accounting: AccountingPort;
  accountBalances: AccountBalancesPort;
  contacts: ContactReadPort;
}

/**
 * Payment application service. Mirror of `features/payment/payment.service.ts`
 * — keeps method names, signatures and tx semantics identical to legacy so
 * the C5 shim is a thin pass-through.
 *
 * Orchestration pattern (single tx per write use case):
 *   1. Pre-validate / read collaborators OUTSIDE the tx (period, settings).
 *   2. Open audit-tx via withAuditTx(repo, ctx, fn).
 *   3. Inside fn(tx, correlationId): load aggregate(s), mutate entity, persist
 *      via repo.{save,update,delete}Tx(tx, payment), then call cross-feature
 *      ports (accounting, balances, receivables, payables) tx-aware.
 *   4. After tx: re-fetch via repo.findById to get the canonical aggregate
 *      to return.
 */
export class PaymentsService {
  private readonly repo: PaymentRepository;
  private readonly receivables: ReceivablesPort;
  private readonly payables: PayablesPort;
  private readonly orgSettings: OrgSettingsReadPort;
  private readonly fiscalPeriods: FiscalPeriodsReadPort;
  private readonly accounting: AccountingPort;
  private readonly accountBalances: AccountBalancesPort;
  private readonly contacts: ContactReadPort;

  constructor(deps: PaymentsServiceDeps) {
    this.repo = deps.repo;
    this.receivables = deps.receivables;
    this.payables = deps.payables;
    this.orgSettings = deps.orgSettings;
    this.fiscalPeriods = deps.fiscalPeriods;
    this.accounting = deps.accounting;
    this.accountBalances = deps.accountBalances;
    this.contacts = deps.contacts;
  }

  // ── Reads ────────────────────────────────────────────────────────────────

  async list(
    organizationId: string,
    filters?: PaymentFilters,
  ): Promise<Payment[]> {
    return this.repo.findAll(organizationId, filters);
  }

  async listPaginated(
    organizationId: string,
    filters?: PaymentFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Payment>> {
    return this.repo.findPaginated(organizationId, filters, pagination);
  }

  async getById(organizationId: string, id: string): Promise<Payment> {
    const found = await this.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Pago");
    return found;
  }

  async getCustomerBalance(
    organizationId: string,
    contactId: string,
  ): Promise<CustomerBalanceSnapshot> {
    return this.repo.getCustomerBalance(organizationId, contactId);
  }

  // ── Writes ───────────────────────────────────────────────────────────────

  async create(
    organizationId: string,
    userId: string,
    input: CreatePaymentServiceInput,
  ): Promise<Payment> {
    // I12 — defense in depth: DRAFT permite período CLOSED (legacy parity),
    // pero exigimos coherencia date∈período. Cierra el gap para callers que
    // salten el FE (el FE deriva periodId de la fecha).
    const period = await this.fiscalPeriods.getById(
      organizationId,
      input.periodId,
    );
    if (!isDateWithinPeriod(input.date, period)) {
      throw new PaymentDateOutsidePeriod(input.date, period.name);
    }

    const aggregate = PaymentEntity.create({
      organizationId,
      method: input.method,
      date: input.date,
      amount: input.amount,
      description: input.description,
      periodId: input.periodId,
      contactId: input.contactId,
      createdById: userId,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      accountCode: input.accountCode ?? null,
      operationalDocTypeId: input.operationalDocTypeId ?? null,
      allocations: input.allocations.map((a) => ({
        target: a.receivableId
          ? AllocationTarget.forReceivable(a.receivableId)
          : AllocationTarget.forPayable(a.payableId!),
        amount: a.amount,
      })),
    });
    await this.repo.save(aggregate);
    return aggregate;
  }

  async delete(organizationId: string, id: string): Promise<void> {
    const payment = await this.getById(organizationId, id);
    if (payment.status !== "DRAFT") {
      // Mirror legacy validateDraftOnly: only DRAFTs are deletable.
      const code =
        payment.status === "VOIDED"
          ? "ENTRY_VOIDED_IMMUTABLE"
          : payment.status === "LOCKED"
            ? "ENTRY_LOCKED_IMMUTABLE"
            : "ENTRY_POSTED_LINES_IMMUTABLE";
      throw new ValidationError(
        legacyDraftOnlyMessage(payment.status),
        code,
      );
    }
    await this.repo.delete(organizationId, id);
  }

  async post(
    organizationId: string,
    userId: string,
    id: string,
  ): Promise<PaymentResult> {
    const payment = await this.getById(organizationId, id);
    // Pre-validation OUTSIDE the tx (mirror legacy)
    const period = await this.fiscalPeriods.getById(
      organizationId,
      payment.periodId,
    );
    assertPeriodOpen(period);
    // I12 — date∈período antes del POST.
    if (!isDateWithinPeriod(payment.date, period)) {
      throw new PaymentDateOutsidePeriod(payment.date, period.name);
    }
    const settings = await this.orgSettings.getOrCreate(organizationId);

    const { result, correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      { userId, organizationId },
      async (tx) => {
        return this.postInternal(tx, organizationId, userId, payment, settings);
      },
    );
    return { payment: result, correlationId };
  }

  async createAndPost(
    organizationId: string,
    userId: string,
    input: CreatePaymentServiceInput,
  ): Promise<PaymentResult> {
    const period = await this.fiscalPeriods.getById(
      organizationId,
      input.periodId,
    );
    assertPeriodOpen(period);
    // I12 — date∈período (createAndPost: nace con input.date + input.periodId).
    if (!isDateWithinPeriod(input.date, period)) {
      throw new PaymentDateOutsidePeriod(input.date, period.name);
    }
    const settings = await this.orgSettings.getOrCreate(organizationId);

    const draft = PaymentEntity.create({
      organizationId,
      method: input.method,
      date: input.date,
      amount: input.amount,
      description: input.description,
      periodId: input.periodId,
      contactId: input.contactId,
      createdById: userId,
      referenceNumber: input.referenceNumber ?? null,
      notes: input.notes ?? null,
      accountCode: input.accountCode ?? null,
      operationalDocTypeId: input.operationalDocTypeId ?? null,
      allocations: input.allocations.map((a) => ({
        target: a.receivableId
          ? AllocationTarget.forReceivable(a.receivableId)
          : AllocationTarget.forPayable(a.payableId!),
        amount: a.amount,
      })),
    });

    const { result, correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      { userId, organizationId },
      async (tx) => {
        const allocsForDirection: AllocationDirectionInput[] = input.allocations;
        const direction = await resolveDirection(
          tx,
          this.contacts,
          allocsForDirection,
          input.contactId,
          input.direction,
        );
        const posted = await this.postInternal(
          tx,
          organizationId,
          userId,
          draft,
          settings,
          { directionOverride: direction, isCreateAndPost: true },
        );
        // Apply credit sources (Modo A)
        for (const cs of input.creditSources ?? []) {
          await this.applyCreditToInvoiceTx(
            tx,
            organizationId,
            cs.sourcePaymentId,
            cs.receivableId,
            cs.amount,
          );
        }
        return posted;
      },
    );
    return { payment: result, correlationId };
  }

  async void(
    organizationId: string,
    userId: string,
    id: string,
    lockedCtx: LockedEditContext = {},
  ): Promise<PaymentResult> {
    const payment = await this.getById(organizationId, id);

    // REQ-A6 — LOCKED-edit parity with legacy:
    //   1. role is mandatory
    //   2. period.status drives justification length (50 if CLOSED, 10 if OPEN)
    //   3. justification is forwarded to withAuditTx → setAuditContext
    if (payment.status === "LOCKED") {
      if (!lockedCtx.role) {
        throw new ValidationError(
          "Se requiere el rol del usuario para anular documentos bloqueados",
        );
      }
      const period = await this.fiscalPeriods.getById(
        organizationId,
        payment.periodId,
      );
      validateLockedEdit(
        payment.status,
        lockedCtx.role,
        period.status,
        lockedCtx.justification,
      );
    }

    const { correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      { userId, organizationId, justification: lockedCtx.justification },
      async (tx) => {
        // 1. Transition aggregate to VOIDED
        const voided = payment.void();
        await this.repo.updateTx(tx, voided);

        // 2. Reverse linked journal entry + balances
        if (payment.journalEntryId) {
          const entry = await this.accounting.findEntryByIdTx(
            tx,
            organizationId,
            payment.journalEntryId,
          );
          if (entry) {
            const updated = await this.accounting.voidEntryTx(
              tx,
              organizationId,
              payment.journalEntryId,
              userId,
            );
            await this.accountBalances.applyVoidTx(tx, updated);
          }
        }

        // 3. Revert allocations (skip VOIDED targets — legacy parity)
        for (const alloc of payment.allocations) {
          await this.revertAllocationTx(tx, organizationId, alloc);
        }

        return voided;
      },
    );

    const refreshed = await this.repo.findById(organizationId, id);
    if (!refreshed) throw new NotFoundError("Pago");
    return { payment: refreshed, correlationId };
  }

  async update(
    organizationId: string,
    userId: string,
    id: string,
    input: UpdatePaymentServiceInput,
    lockedCtx: LockedEditContext = {},
  ): Promise<PaymentResult> {
    const payment = await this.getById(organizationId, id);

    if (payment.status === "POSTED") {
      // Atomic reverse-modify-reapply path (mirror legacy updatePostedPaymentTx)
      const period = await this.fiscalPeriods.getById(
        organizationId,
        payment.periodId,
      );
      assertPeriodOpen(period);
      // I12 — si la fecha cambia en update POSTED, la nueva debe caer en el período.
      const nextDate = input.date ?? payment.date;
      if (!isDateWithinPeriod(nextDate, period)) {
        throw new PaymentDateOutsidePeriod(nextDate, period.name);
      }
      return this.updatePostedPaymentTx(
        organizationId,
        userId,
        payment,
        input,
      );
    }

    // VOIDED rejection lives inside the entity (`payment.update()` calls
    // `assertNotVoided` which throws `CannotModifyVoidedPayment` carrying the
    // SHARED `ENTRY_VOIDED_IMMUTABLE` code — legacy parity, C2-FIX-2). We
    // intentionally drop the previous explicit guard here that emitted
    // `INVALID_STATUS_TRANSITION` with a different message; the entity guard
    // is the single source of truth for "can this aggregate be mutated".

    // REQ-A6 — LOCKED-edit parity with legacy: validate role + justification
    // against period status, then proceed with the same mutation path used
    // by DRAFT, but wrap the audit-tx with `justification` so the
    // setAuditContext call writes app.audit_justification.
    if (payment.status === "LOCKED") {
      if (!lockedCtx.role) {
        throw new ValidationError(
          "Se requiere el rol del usuario para editar documentos bloqueados",
        );
      }
      const period = await this.fiscalPeriods.getById(
        organizationId,
        payment.periodId,
      );
      validateLockedEdit(
        payment.status,
        lockedCtx.role,
        period.status,
        lockedCtx.justification,
      );
    }

    // DRAFT or LOCKED (post-validation) — same mutation path. The aggregate
    // permits non-status edits on LOCKED (only VOIDED is rejected); the
    // role/justification gate above is the LOCKED enforcement layer.
    const next = payment.update({
      method: input.method,
      date: input.date,
      amount: input.amount,
      description: input.description,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      accountCode: input.accountCode,
      operationalDocTypeId: input.operationalDocTypeId,
    });

    const replaced = input.allocations
      ? next.replaceAllocations(
          input.allocations.map((a) =>
            PaymentAllocation.create({
              paymentId: next.id,
              target: a.receivableId
                ? AllocationTarget.forReceivable(a.receivableId)
                : AllocationTarget.forPayable(a.payableId!),
              amount: a.amount,
            }),
          ),
        )
      : next;

    const { result, correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      {
        userId,
        organizationId,
        // For DRAFT this is undefined; for LOCKED it is the validated
        // justification. Mirrors legacy update() audit-tx wrapping.
        justification:
          payment.status === "LOCKED" ? lockedCtx.justification : undefined,
      },
      async (tx) => {
        await this.repo.updateTx(tx, replaced);
        return replaced;
      },
    );
    return { payment: result, correlationId };
  }

  async updateAllocations(
    organizationId: string,
    userId: string,
    id: string,
    newAllocations: AllocationInput[],
    lockedCtx: LockedEditContext = {},
  ): Promise<PaymentResult> {
    const payment = await this.getById(organizationId, id);

    if (payment.status !== "POSTED" && payment.status !== "LOCKED") {
      throw new ValidationError(
        "Solo se pueden reasignar pagos contabilizados o bloqueados. Use la edición normal para borradores.",
        INVALID_STATUS_TRANSITION,
      );
    }

    // REQ-A6 — LOCKED-edit parity with legacy.
    if (payment.status === "LOCKED") {
      if (!lockedCtx.role) {
        throw new ValidationError(
          "Se requiere el rol del usuario para reasignar documentos bloqueados",
        );
      }
      const period = await this.fiscalPeriods.getById(
        organizationId,
        payment.periodId,
      );
      validateLockedEdit(
        payment.status,
        lockedCtx.role,
        period.status,
        lockedCtx.justification,
      );
    }

    const next = payment.replaceAllocations(
      newAllocations.map((a) =>
        PaymentAllocation.create({
          paymentId: payment.id,
          target: a.receivableId
            ? AllocationTarget.forReceivable(a.receivableId)
            : AllocationTarget.forPayable(a.payableId!),
          amount: a.amount,
        }),
      ),
    );

    const { result, correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      {
        userId,
        organizationId,
        justification:
          payment.status === "LOCKED" ? lockedCtx.justification : undefined,
      },
      async (tx) => {
        // 1. Revert old allocations (skip VOIDED)
        for (const old of payment.allocations) {
          await this.revertAllocationTx(tx, organizationId, old);
        }
        // 2. Persist the new aggregate (replaces allocation rows wholesale)
        await this.repo.updateTx(tx, next);
        // 3. Apply new allocations (validates VOIDED + balance via the
        //    receivables/payables apply use case — throws on violation)
        for (const fresh of next.allocations) {
          await this.applyAllocationTx(tx, organizationId, fresh);
        }
        return next;
      },
    );
    return { payment: result, correlationId };
  }

  async applyCreditOnly(
    organizationId: string,
    userId: string,
    contactId: string,
    creditSources: CreditAllocationSource[],
  ): Promise<{ correlationId: string }> {
    // Pre-validate OUTSIDE the tx: every source belongs to contactId.
    for (const cs of creditSources) {
      const sp = await this.repo.findById(organizationId, cs.sourcePaymentId);
      if (!sp) throw new NotFoundError("Pago origen");
      if (sp.contactId !== contactId) {
        throw new ValidationError(
          "Todos los pagos origen deben pertenecer al mismo contacto",
          PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
        );
      }
    }

    const { correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      { userId, organizationId },
      async (tx) => {
        for (const cs of creditSources) {
          await this.applyCreditToInvoiceTx(
            tx,
            organizationId,
            cs.sourcePaymentId,
            cs.receivableId,
            cs.amount,
          );
        }
        return undefined;
      },
    );

    return { correlationId };
  }

  // ── Internal: post + applyCreditToInvoice + updatePosted ─────────────────

  private async postInternal(
    tx: unknown,
    organizationId: string,
    userId: string,
    payment: Payment,
    settings: { cajaGeneralAccountCode: string; bancoAccountCode: string; cxcAccountCode: string; cxpAccountCode: string },
    opts: { directionOverride?: PaymentDirection; isCreateAndPost?: boolean } = {},
  ): Promise<Payment> {
    // 1. Resolve direction
    const allocsForDirection: AllocationDirectionInput[] = payment.allocations.map(
      (a) => ({ receivableId: a.receivableId, payableId: a.payableId }),
    );
    const direction =
      opts.directionOverride ??
      (await resolveDirection(
        tx,
        this.contacts,
        allocsForDirection,
        payment.contactId,
      ));

    // 2. Transition aggregate to POSTED (or persist as POSTED for createAndPost)
    let posted = opts.isCreateAndPost ? payment.post() : payment.post();
    if (opts.isCreateAndPost) {
      await this.repo.saveTx(tx, posted);
    } else {
      await this.repo.updateTx(tx, posted);
    }

    // 3. Generate journal entry when amount > 0 (skip for credit-only)
    if (payment.amount.value > 0) {
      const voucherTypeCode = direction === "COBRO" ? "CI" : "CE";
      const lines = buildEntryLines({
        isCollection: direction === "COBRO",
        method: payment.method,
        amount: payment.amount.value,
        cajaAccountCode: settings.cajaGeneralAccountCode,
        bancoAccountCode: settings.bancoAccountCode,
        cxcAccountCode: settings.cxcAccountCode,
        cxpAccountCode: settings.cxpAccountCode,
        contactId: payment.contactId,
        selectedAccountCode: payment.accountCode ?? undefined,
      });
      const entry = await this.accounting.generateEntryTx(tx, {
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
      await this.accountBalances.applyPostTx(tx, entry);

      // 4. Wire entryId onto the aggregate
      posted = posted.linkJournalEntry(entry.id);
      await this.repo.updateTx(tx, posted);
    }

    // 5. Apply allocations (each is validated by receivables/payables apply use case)
    for (const alloc of payment.allocations) {
      await this.applyAllocationTx(tx, organizationId, alloc);
    }

    return posted;
  }

  private async updatePostedPaymentTx(
    organizationId: string,
    userId: string,
    payment: Payment,
    input: UpdatePaymentServiceInput,
  ): Promise<PaymentResult> {
    const newAmount = input.amount ?? payment.amount.value;
    const oldAmount = payment.amount.value;

    const settings = await this.orgSettings.getOrCreate(organizationId);

    const { result, correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      { userId, organizationId },
      async (tx) => {
        // a. Revert old allocations
        for (const old of payment.allocations) {
          await this.revertAllocationTx(tx, organizationId, old);
        }

        // b. Reverse old journal entry balances if any
        if (payment.journalEntryId) {
          const old = await this.accounting.findEntryByIdTx(
            tx,
            organizationId,
            payment.journalEntryId,
          );
          if (old) await this.accountBalances.applyVoidTx(tx, old);
        }

        // c. Update payment fields (no allocations yet)
        let updated = payment.update({
          method: input.method,
          date: input.date,
          amount: input.amount,
          description: input.description,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          accountCode: input.accountCode,
          operationalDocTypeId: input.operationalDocTypeId,
        });

        // d. Resolve direction (uses original allocations to derive)
        const allocsForDirection: AllocationDirectionInput[] = payment.allocations.map(
          (a) => ({ receivableId: a.receivableId, payableId: a.payableId }),
        );
        const direction = await resolveDirection(
          tx,
          this.contacts,
          allocsForDirection,
          payment.contactId,
        );
        const voucherTypeCode = direction === "COBRO" ? "CI" : "CE";

        // e. Journal entry transitions based on amount
        if (oldAmount > 0 && newAmount > 0) {
          // Update existing entry in place
          const newLines = buildEntryLines({
            isCollection: direction === "COBRO",
            method: updated.method,
            amount: newAmount,
            cajaAccountCode: settings.cajaGeneralAccountCode,
            bancoAccountCode: settings.bancoAccountCode,
            cxcAccountCode: settings.cxcAccountCode,
            cxpAccountCode: settings.cxpAccountCode,
            contactId: payment.contactId,
            selectedAccountCode:
              input.accountCode ?? payment.accountCode ?? undefined,
          });
          const resolvedLines: ResolvedEntryLine[] = [];
          for (let i = 0; i < newLines.length; i++) {
            const line = newLines[i];
            const account = await this.accounting.findAccountByCodeTx(
              tx,
              organizationId,
              line.accountCode,
            );
            if (!account) {
              throw new NotFoundError(`Cuenta ${line.accountCode}`);
            }
            resolvedLines.push({
              accountId: account.id,
              debit: line.side === "DEBIT" ? newAmount : 0,
              credit: line.side === "CREDIT" ? newAmount : 0,
              contactId: line.contactId,
              order: i,
            });
          }
          const entry = await this.accounting.updateEntryTx(
            tx,
            organizationId,
            payment.journalEntryId!,
            {
              date: updated.date,
              description: updated.description,
              contactId: payment.contactId,
              referenceNumber: updated.referenceNumber ?? undefined,
            },
            resolvedLines,
            userId,
          );
          await this.accountBalances.applyPostTx(tx, entry);
        } else if (oldAmount === 0 && newAmount > 0) {
          // Create a fresh entry
          const newLines = buildEntryLines({
            isCollection: direction === "COBRO",
            method: updated.method,
            amount: newAmount,
            cajaAccountCode: settings.cajaGeneralAccountCode,
            bancoAccountCode: settings.bancoAccountCode,
            cxcAccountCode: settings.cxcAccountCode,
            cxpAccountCode: settings.cxpAccountCode,
            contactId: payment.contactId,
            selectedAccountCode:
              input.accountCode ?? payment.accountCode ?? undefined,
          });
          const entry = await this.accounting.generateEntryTx(tx, {
            organizationId,
            voucherTypeCode,
            contactId: payment.contactId,
            date: updated.date,
            periodId: payment.periodId,
            description: updated.description,
            referenceNumber: updated.referenceNumber ?? undefined,
            sourceType: "payment",
            sourceId: payment.id,
            createdById: userId,
            lines: newLines,
          });
          await this.accountBalances.applyPostTx(tx, entry);
          updated = updated.linkJournalEntry(entry.id);
        } else if (oldAmount > 0 && newAmount === 0) {
          // Void existing entry (balances already reversed in step b)
          if (payment.journalEntryId) {
            await this.accounting.voidEntryTx(
              tx,
              organizationId,
              payment.journalEntryId,
              userId,
            );
          }
        }

        // f. Persist new allocations or re-apply old ones
        const allocsToApply: AllocationInput[] =
          input.allocations ??
          payment.allocations.map((a) => ({
            receivableId: a.receivableId ?? undefined,
            payableId: a.payableId ?? undefined,
            amount: a.amount.value,
          }));

        const refreshedAllocs = allocsToApply.map((a) =>
          PaymentAllocation.create({
            paymentId: updated.id,
            target: a.receivableId
              ? AllocationTarget.forReceivable(a.receivableId)
              : AllocationTarget.forPayable(a.payableId!),
            amount: a.amount,
          }),
        );
        updated = updated.replaceAllocations(refreshedAllocs);
        await this.repo.updateTx(tx, updated);

        for (const alloc of updated.allocations) {
          await this.applyAllocationTx(tx, organizationId, alloc);
        }

        return updated;
      },
    );

    return { payment: result, correlationId };
  }

  private async applyCreditToInvoiceTx(
    tx: unknown,
    organizationId: string,
    sourcePaymentId: string,
    receivableId: string,
    amount: number,
  ): Promise<void> {
    // 1. Validate amount
    if (amount <= 0) {
      throw new ValidationError(
        "El monto de crédito debe ser mayor a cero",
        PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
      );
    }

    // 2. Load source payment + assert not VOIDED
    const source = await this.repo.findByIdTx(tx, organizationId, sourcePaymentId);
    if (!source) throw new NotFoundError("Pago origen");
    if (source.status === "VOIDED") {
      throw new ValidationError(
        "No se puede aplicar crédito de un pago anulado",
        PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
      );
    }

    // 3. Validate unappliedAmount >= amount
    const unapplied = source.unappliedAmount;
    const requested = MonetaryAmount.of(amount);
    if (unapplied.isLessThan(requested)) {
      throw new ValidationError(
        `El crédito disponible (${unapplied.value}) es insuficiente para aplicar (${amount})`,
        PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
      );
    }

    // 4. Mutate source aggregate + persist (creates the credit-application
    //    allocation pointing at the target receivable).
    const newAllocation = PaymentAllocation.create({
      paymentId: source.id,
      target: AllocationTarget.forReceivable(receivableId),
      amount,
    });
    const updated = source.applyCreditAllocation(newAllocation);
    await this.repo.updateTx(tx, updated);

    // 5. Apply to receivable. Receivables entity is the only invariant guard:
    //    throws NotFoundError on missing target, PAYMENT_ALLOCATION_TARGET_VOIDED
    //    when target is VOIDED, PAYMENT_ALLOCATION_EXCEEDS_BALANCE when amount
    //    exceeds available balance. Tx rollback handles atomicity for step 4.
    await this.receivables.applyAllocation(
      tx,
      organizationId,
      receivableId,
      requested,
    );

    // 6. Update source payment's journal entry: append the credit-application
    //    line pair (DEBIT cxc / CREDIT cxc with proper contact ids).
    if (source.journalEntryId) {
      const settings = await this.orgSettings.getOrCreate(organizationId);
      const oldEntry = await this.accounting.findEntryByIdTx(
        tx,
        organizationId,
        source.journalEntryId,
      );
      if (oldEntry) {
        await this.accountBalances.applyVoidTx(tx, oldEntry);
        const cxcAccount = await this.accounting.findAccountByCodeTx(
          tx,
          organizationId,
          settings.cxcAccountCode,
        );
        if (!cxcAccount) {
          throw new NotFoundError(`Cuenta ${settings.cxcAccountCode}`);
        }

        const existingLines: ResolvedEntryLine[] = oldEntry.lines.map(
          (l, idx) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            contactId: l.contactId ?? undefined,
            order: idx,
          }),
        );
        const newLines: ResolvedEntryLine[] = [
          ...existingLines,
          {
            accountId: cxcAccount.id,
            debit: amount,
            credit: 0,
            contactId: source.contactId,
            order: existingLines.length,
          },
          {
            accountId: cxcAccount.id,
            debit: 0,
            credit: amount,
            // contactId of the receivable's owner — legacy reads it from
            // the receivable row. Without a receivable read, we use source
            // contactId as a fallback (legacy parity preserved when the
            // receivable belongs to the same contact, which is the common
            // case for credit-application).
            contactId: source.contactId,
            order: existingLines.length + 1,
          },
        ];
        const updatedEntry = await this.accounting.updateEntryTx(
          tx,
          organizationId,
          source.journalEntryId,
          {},
          newLines,
          "system",
        );
        await this.accountBalances.applyPostTx(tx, updatedEntry);
      }
    }
  }

  // ── Allocation tx helpers (delegate to receivables/payables ports) ───────

  private async applyAllocationTx(
    tx: unknown,
    organizationId: string,
    alloc: { receivableId: string | null; payableId: string | null; amount: MonetaryAmount },
  ): Promise<void> {
    if (alloc.receivableId) {
      await this.receivables.applyAllocation(
        tx,
        organizationId,
        alloc.receivableId,
        alloc.amount,
      );
    } else if (alloc.payableId) {
      await this.payables.applyAllocation(
        tx,
        organizationId,
        alloc.payableId,
        alloc.amount,
      );
    }
  }

  private async revertAllocationTx(
    tx: unknown,
    organizationId: string,
    alloc: { receivableId: string | null; payableId: string | null; amount: MonetaryAmount },
  ): Promise<void> {
    if (alloc.receivableId) {
      // Filter VOIDED + missing — symmetric to legacy `revertAllocations`
      const status = await this.receivables.getStatusByIdTx(
        tx,
        organizationId,
        alloc.receivableId,
      );
      if (status === null || status === "VOIDED") return;
      await this.receivables.revertAllocation(
        tx,
        organizationId,
        alloc.receivableId,
        alloc.amount,
      );
    } else if (alloc.payableId) {
      const status = await this.payables.getStatusByIdTx(
        tx,
        organizationId,
        alloc.payableId,
      );
      if (status === null || status === "VOIDED") return;
      await this.payables.revertAllocation(
        tx,
        organizationId,
        alloc.payableId,
        alloc.amount,
      );
    }
  }
}

// ─────────────────────────── Helpers ────────────────────────────────────────

function assertPeriodOpen(period: { status: "OPEN" | "CLOSED" }): void {
  if (period.status !== "OPEN") {
    throw new ValidationError(
      "No se puede operar en un período cerrado",
      FISCAL_PERIOD_CLOSED,
    );
  }
}

function legacyDraftOnlyMessage(status: string): string {
  if (status === "VOIDED") return "Un documento anulado no puede ser modificado";
  if (status === "LOCKED")
    return "Un documento bloqueado no puede ser modificado sin justificación";
  return "Un documento contabilizado no puede ser modificado";
}
