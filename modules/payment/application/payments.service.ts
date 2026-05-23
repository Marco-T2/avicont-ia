import "server-only";
import { withAuditTx } from "@/features/shared/audit-tx";
// Reuse the shared LOCKED-edit helper (REQ-A6) — single source of truth for
// role + period + justification length validation.
import { validateLockedEdit } from "@/modules/accounting/domain/document-lifecycle";

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
import type { CreditConsumptionPort } from "../domain/ports/credit-consumption.port";
import { Payment as PaymentEntity } from "../domain/payment.entity";
import { PaymentAllocation } from "../domain/payment-allocation.entity";
import { AllocationTarget } from "../domain/value-objects/allocation-target";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  PAYMENT_CREDIT_EXCEEDS_AVAILABLE,
  PAYMENT_CREDIT_WRONG_CONTACT,
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
// buildPaymentGlosa / PaymentAllocationGlosa removed: glosa is now client-authoritative
// (REQ-PAY-5, W-2). The builder is still used at the domain layer and in the
// client-side payment form — NOT in the service post path.

// ── Service-layer input shapes ─────────────────────────────────────────────

export interface AllocationInput {
  receivableId?: string;
  payableId?: string;
  amount: number;
}

/**
 * A credit source the consumer applies, carrying an XOR allocation target:
 * EITHER `receivableId` (COBRO credit) OR `payableId` (PAGO credit), never both,
 * never neither — mirroring `AllocationInput` and the `AllocationTarget` VO. The
 * service builds an `AllocationTarget` from whichever id is present and
 * dispatches to the matching port (pago-credit-system, design D1). Receivable
 * callers stay source-compatible (omit `payableId`).
 */
export interface CreditAllocationSource {
  sourcePaymentId: string;
  receivableId?: string;
  payableId?: string;
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
  /**
   * Credit sources the edited payment consumes (REQ-PAY-3b, Phase 4). The edit
   * path REVERTS all prior credit (link-driven, authoritative) then RE-APPLIES
   * these. Omitted/empty → prior credit is reverted with no re-apply (Scenario
   * H). The HTTP layers (Zod / DTO / adapter, L1–L3) thread this in Phase 5;
   * here only the service input + edit-path consumption land.
   */
  creditSources?: CreditAllocationSource[];
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
  creditConsumption: CreditConsumptionPort;
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
  private readonly creditConsumption: CreditConsumptionPort;

  constructor(deps: PaymentsServiceDeps) {
    this.repo = deps.repo;
    this.receivables = deps.receivables;
    this.payables = deps.payables;
    this.orgSettings = deps.orgSettings;
    this.fiscalPeriods = deps.fiscalPeriods;
    this.accounting = deps.accounting;
    this.accountBalances = deps.accountBalances;
    this.contacts = deps.contacts;
    this.creditConsumption = deps.creditConsumption;
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
          {
            directionOverride: direction,
            isCreateAndPost: true,
          },
        );
        // Apply credit sources (Modo A). The newly-posted payment is the
        // consumer — link each credit to it so a later edit can revert it.
        for (const cs of input.creditSources ?? []) {
          await this.applyCreditToInvoiceTx(
            tx,
            organizationId,
            cs.sourcePaymentId,
            creditTargetOf(cs),
            cs.amount,
            posted.id,
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

    // REQ-A6 / W-1 — LOCKED-edit gate, validated BEFORE the status branch so it
    // covers BOTH the unified POSTED|LOCKED path and the DRAFT path. The gate
    // (role mandatory + validateLockedEdit on justification length vs period
    // status) is the enforcement the now-dead updateAllocations carried; the
    // unified path MUST preserve it (Scenario F2/F3). Only fires for LOCKED.
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

    if (payment.status === "POSTED" || payment.status === "LOCKED") {
      // Unified atomic reverse-modify-reapply path (REQ-PAY-2 §2). A POSTED or
      // LOCKED edit — whether cash, allocations, or credit changes — goes
      // through updatePostedPaymentTx. The didCashChange seam decides journal
      // recompute; credit is reverted+reapplied; the LOCKED gate above already
      // authorized a LOCKED edit. justification is forwarded so the audit tx
      // writes app.audit_justification (LOCKED only; undefined for POSTED).
      //
      // PERIOD CHECKS are POSTED-only. A POSTED edit requires an OPEN period
      // (assertPeriodOpen) and date∈period (I12). A LOCKED edit is, BY DESIGN,
      // the authorized path to amend a CLOSED-period document — validateLockedEdit
      // above already gated it (role + 50-char justification when CLOSED). Running
      // assertPeriodOpen for LOCKED would defeat the LOCKED-edit policy and break
      // REQ-A6 parity (legacy allowed LOCKED edits on CLOSED periods).
      if (payment.status === "POSTED") {
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
      }
      return this.updatePostedPaymentTx(
        organizationId,
        userId,
        payment,
        input,
        lockedCtx,
      );
    }

    // VOIDED rejection lives inside the entity (`payment.update()` calls
    // `assertNotVoided` which throws `CannotModifyVoidedPayment` carrying the
    // SHARED `ENTRY_VOIDED_IMMUTABLE` code — legacy parity, C2-FIX-2). We
    // intentionally drop the previous explicit guard here that emitted
    // `INVALID_STATUS_TRANSITION` with a different message; the entity guard
    // is the single source of truth for "can this aggregate be mutated".

    // DRAFT — same mutation path. The aggregate
    // permits non-status edits on LOCKED (only VOIDED is rejected); the
    // role/justification gate above is the LOCKED enforcement layer.
    //
    // Build the new allocations (keyed on payment.id — stable across update())
    // BEFORE the single update() call and pass them in, so the SUM ≤ amount
    // invariant is evaluated against the FINAL aggregate state (new amount + new
    // allocations) instead of an intermediate state (new amount vs old allocs).
    // Omitting input.allocations leaves the entity's old allocations in place.
    const newAllocations = input.allocations
      ? input.allocations.map((a) =>
          PaymentAllocation.create({
            paymentId: payment.id,
            target: a.receivableId
              ? AllocationTarget.forReceivable(a.receivableId)
              : AllocationTarget.forPayable(a.payableId!),
            amount: a.amount,
          }),
        )
      : undefined;

    const next = payment.update({
      method: input.method,
      date: input.date,
      amount: input.amount,
      description: input.description,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      accountCode: input.accountCode,
      operationalDocTypeId: input.operationalDocTypeId,
      allocations: newAllocations,
    });

    // DRAFT only — LOCKED is routed to updatePostedPaymentTx above, so no
    // justification is forwarded here (DRAFT edits never carry one).
    const { result, correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      { userId, organizationId },
      async (tx) => {
        await this.repo.updateTx(tx, next);
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
          PAYMENT_CREDIT_WRONG_CONTACT,
        );
      }
    }

    const { correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      { userId, organizationId },
      async (tx) => {
        for (const cs of creditSources) {
          // Standalone apply-credit — there is no consumer payment, only a
          // source supplying credit to a receivable OR payable (consumerPaymentId
          // = null). The target is dispatched by the source's XOR id.
          await this.applyCreditToInvoiceTx(
            tx,
            organizationId,
            cs.sourcePaymentId,
            creditTargetOf(cs),
            cs.amount,
            null,
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
    opts: {
      directionOverride?: PaymentDirection;
      isCreateAndPost?: boolean;
    } = {},
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
      // REQ-PAY-5 (W-2) — glosa is client-authoritative on both create and edit.
      // The server previously rebuilt COBRO glosa via findGlosaMetaTx + buildPaymentGlosa
      // (using real receivable metadata). That server-side rebuild is REMOVED.
      // The client computes buildPaymentGlosa and sends the result as payment.description;
      // the server persists it as-is. Minor format differences for shortcut-mode payments
      // are accepted — client glosa is authoritative by design (spec W-2 accepted behavior
      // change). PAGO passthrough is unchanged — Marco lock: glosa PAGO out of scope.
      const entryDescription = payment.description;
      const entry = await this.accounting.generateEntryTx(tx, {
        organizationId,
        voucherTypeCode,
        contactId: payment.contactId,
        date: payment.date,
        periodId: payment.periodId,
        description: entryDescription,
        referenceNumber: payment.referenceNumber ?? undefined,
        // journal-physical-document Phase 6 — Payment already carries the
        // operationalDocTypeId selected via admin UI; forward it directly
        // (no findByCode lookup needed, sister of Sale/Purchase/Dispatch).
        operationalDocTypeId: payment.operationalDocTypeId ?? null,
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
    lockedCtx: LockedEditContext = {},
  ): Promise<PaymentResult> {
    const newAmount = input.amount ?? payment.amount.value;
    const oldAmount = payment.amount.value;

    // REQ-PAY-2 — journal↔matching seam. "Cash changed" = amount / method /
    // date / accountCode differs from the persisted values (payment.entity
    // didCashChange, pure). When cash did NOT change, the journal entry is left
    // BYTE-IDENTICAL: we skip the entire void/regenerate block below
    // (Scenario E). Only the allocations (and any credit) are reassigned.
    const cashChanged = payment.didCashChange({
      amount: input.amount,
      method: input.method,
      date: input.date,
      accountCode: input.accountCode,
    });

    const settings = await this.orgSettings.getOrCreate(organizationId);

    const { result, correlationId } = await withAuditTx(
      asAuditTxRepo(this.repo),
      {
        userId,
        organizationId,
        // LOCKED edit (W-1): forward the validated justification so
        // setAuditContext writes app.audit_justification. undefined for POSTED.
        justification:
          payment.status === "LOCKED" ? lockedCtx.justification : undefined,
      },
      async (tx) => {
        // a. Revert old allocations
        for (const old of payment.allocations) {
          await this.revertAllocationTx(tx, organizationId, old);
        }

        // a2. Revert ALL prior credit this payment consumed (REQ-PAY-3a,
        //     Scenario G-order). Link-driven + authoritative — reads the
        //     CreditConsumption rows keyed by this payment, restores each
        //     source's unappliedAmount + the receivable, and deletes the links.
        //     MUST run BEFORE the reapply (step f2): reapplying first would
        //     throw PAYMENT_CREDIT_EXCEEDS_AVAILABLE on a still-depleted source.
        //     NO journal touch (design v2 §CENTERPIECE).
        await this.revertCreditTx(tx, organizationId, payment.id);

        // b. Reverse old journal entry balances if any — ONLY when cash changed.
        if (cashChanged && payment.journalEntryId) {
          const old = await this.accounting.findEntryByIdTx(
            tx,
            organizationId,
            payment.journalEntryId,
          );
          if (old) await this.accountBalances.applyVoidTx(tx, old);
        }

        // c0. Resolve the allocations to apply BEFORE update() so the SUM ≤
        //     amount invariant is evaluated against the FINAL aggregate state
        //     (new amount + new allocations) inside the single update() call,
        //     not an intermediate state (new amount vs old allocations). When
        //     input.allocations is omitted, fall back to the old allocations so
        //     the invariant still fires on the intermediate state (reduce-only
        //     edits without new allocations remain rejected). paymentId is keyed
        //     on payment.id — stable across update() (id is never reassigned).
        const allocsToApply: AllocationInput[] =
          input.allocations ??
          payment.allocations.map((a) => ({
            receivableId: a.receivableId ?? undefined,
            payableId: a.payableId ?? undefined,
            amount: a.amount.value,
          }));
        const refreshedAllocs = allocsToApply.map((a) =>
          PaymentAllocation.create({
            paymentId: payment.id,
            target: a.receivableId
              ? AllocationTarget.forReceivable(a.receivableId)
              : AllocationTarget.forPayable(a.payableId!),
            amount: a.amount,
          }),
        );

        // c. Update payment fields AND allocations atomically.
        let updated = payment.update({
          method: input.method,
          date: input.date,
          amount: input.amount,
          description: input.description,
          referenceNumber: input.referenceNumber,
          notes: input.notes,
          accountCode: input.accountCode,
          operationalDocTypeId: input.operationalDocTypeId,
          allocations: refreshedAllocs,
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

        // e. Journal entry transitions based on amount — ONLY when cash changed.
        //    Cash unchanged → the entry stays exactly as posted (Scenario E):
        //    no findAccountByCodeTx / updateEntryTx / generateEntryTx / voidEntryTx
        //    / applyPostTx. The journal is the source of truth for the cash leg;
        //    an allocation-only edit never touches it. The whole block is gated
        //    so the seam is unambiguous (the oldAmount/newAmount sub-branches are
        //    only reachable when the amount — hence cash — changed anyway).
        if (cashChanged) {
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
              // journal-physical-document Phase 6 — same as create path; the
              // updated aggregate's operationalDocTypeId reflects any changes
              // the user made on the edit form.
              operationalDocTypeId: updated.operationalDocTypeId ?? null,
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
        }

        // f. Persist the updated aggregate (allocations were already applied
        //    atomically inside update() at step c — refreshedAllocs above) and
        //    re-apply each allocation against its target document.
        await this.repo.updateTx(tx, updated);

        for (const alloc of updated.allocations) {
          await this.applyAllocationTx(tx, organizationId, alloc);
        }

        // f2. Re-apply the new credit sources (REQ-PAY-3b, Scenario G-order/H).
        //     Prior credit was already reverted (step a2), so each source's
        //     unappliedAmount is restored and the apply will not falsely throw
        //     PAYMENT_CREDIT_EXCEEDS_AVAILABLE. This payment is the consumer —
        //     pass its id so a later edit can revert these via the links.
        //     Omitted/empty creditSources → nothing re-applied (Scenario H).
        //     MATCHING only — NO journal touch.
        for (const cs of input.creditSources ?? []) {
          await this.applyCreditToInvoiceTx(
            tx,
            organizationId,
            cs.sourcePaymentId,
            creditTargetOf(cs),
            cs.amount,
            updated.id,
          );
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
    target: AllocationTarget,
    amount: number,
    consumerPaymentId: string | null,
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

    // 2b. Same-contact scope guard (supplier-scope-guard, design D-1/D-3).
    //     Single enforcement seam: source.contactId is live (step 2) and we are
    //     BEFORE the first mutation (step 4), so every credit call site
    //     (createAndPost, applyCreditOnly, update) is covered here. The target's
    //     contactId is looked up via the matching port, dispatched by the XOR id
    //     mirroring step 5. SKIP-ON-NULL (design D-2): a null target contactId
    //     means the row is missing — we skip the compare and let step 5
    //     applyAllocation surface NotFound (preserves the existing NotFound
    //     taxonomy). Only a non-null, DIFFERING contactId is rejected.
    const targetContactId = target.receivableId
      ? await this.receivables.getContactIdByIdTx(
          tx,
          organizationId,
          target.receivableId,
        )
      : await this.payables.getContactIdByIdTx(
          tx,
          organizationId,
          target.payableId!,
        );
    if (targetContactId !== null && targetContactId !== source.contactId) {
      throw new ValidationError(
        "El crédito origen pertenece a un contacto distinto del documento destino",
        PAYMENT_CREDIT_WRONG_CONTACT,
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
    //    allocation pointing at the XOR target — receivable OR payable). The
    //    aggregate's enforceAllocationInvariants rejects a mixed-direction credit
    //    (PAYABLE credit on a COBRO source) by construction (design D3).
    const newAllocation = PaymentAllocation.create({
      paymentId: source.id,
      target,
      amount,
    });
    const updated = source.applyCreditAllocation(newAllocation);
    await this.repo.updateTx(tx, updated);

    // 5. Apply to the target via the matching port — dispatch by the present id,
    //    mirroring applyAllocationTx. The receivables/payables entity is the only
    //    invariant guard: throws NotFoundError on missing target,
    //    PAYMENT_ALLOCATION_TARGET_VOIDED when VOIDED, PAYMENT_ALLOCATION_EXCEEDS_BALANCE
    //    when amount exceeds balance. Tx rollback handles atomicity for step 4.
    if (target.receivableId) {
      await this.receivables.applyAllocation(
        tx,
        organizationId,
        target.receivableId,
        requested,
      );
    } else {
      await this.payables.applyAllocation(
        tx,
        organizationId,
        target.payableId!,
        requested,
      );
    }

    // 6. (v2 — design §CENTERPIECE D-H) Record the reversible consumer↔source
    //    link instead of mutating the source journal. Applying credit is pure
    //    MATCHING: the source's original entry already posted the full cash to
    //    CxC (build-entry-lines.ts:46-66, REQ-PAY-7 QB-pure); the invoice's
    //    CxC-positive and the source's CxC-negative net WITHIN CxC with no extra
    //    line. The old step 6 appended a net-zero Dr-cxc/Cr-cxc pair on the SAME
    //    account+contact (accounting-neutral) — REMOVED. The CreditConsumption
    //    row is what makes revertCreditTx authoritative (no journal touch). The
    //    link carries the XOR target — receivableId for COBRO, payableId for PAGO.
    await this.creditConsumption.writeTx(tx, {
      organizationId,
      consumerPaymentId,
      sourcePaymentId,
      receivableId: target.receivableId,
      payableId: target.payableId,
      amount: requested,
    });
  }

  /**
   * Reverts ALL credit that a consumer payment applied, using the
   * CreditConsumption links as the authoritative record (design v2
   * §CENTERPIECE / D-C, Scenario G-revert). Trivial by construction — NO
   * journal mutation:
   *   1. Read links WHERE consumerPaymentId (server-side truth, not the client).
   *   2. For each link: remove the credit allocation from the source aggregate
   *      (restoring its unappliedAmount) and restore the receivable balance.
   *      A VOIDED source is skipped — symmetric to revertAllocationTx (a voided
   *      source's allocations are frozen; its journal already reversed on void).
   *   3. Delete all the consumer's links so no orphan persists (Scenario H).
   * The whole thing runs inside the caller's tx; a throw rolls everything back
   * (Scenario G-rollback). DEC-1: amounts stay MonetaryAmount through the app.
   */
  private async revertCreditTx(
    tx: unknown,
    organizationId: string,
    consumerPaymentId: string,
  ): Promise<void> {
    const links = await this.creditConsumption.findByConsumerPaymentIdTx(
      tx,
      organizationId,
      consumerPaymentId,
    );

    for (const link of links) {
      const source = await this.repo.findByIdTx(
        tx,
        organizationId,
        link.sourcePaymentId,
      );
      // Skip a missing or VOIDED source (symmetric to revertAllocationTx) — the
      // link is still cleared below so no orphan remains.
      if (!source || source.status === "VOIDED") continue;

      // Build the AllocationTarget from the link's XOR (pago-credit-system):
      // a payable link has payableId set → forPayable; a legacy/COBRO link has
      // payableId null → forReceivable. removeCreditAllocation matches by this
      // target VO (kind-sensitive equality).
      const target = link.payableId
        ? AllocationTarget.forPayable(link.payableId)
        : AllocationTarget.forReceivable(link.receivableId!);
      const restored = source.removeCreditAllocation(
        link.sourcePaymentId,
        target,
        link.amount,
      );
      await this.repo.updateTx(tx, restored);

      // Restore the target balance via the matching port — dispatch by the
      // present id, mirroring revertAllocationTx. Legacy receivable-only links
      // (payableId null) route to receivables; payable links route to payables.
      if (target.receivableId) {
        await this.receivables.revertAllocation(
          tx,
          organizationId,
          target.receivableId,
          link.amount,
        );
      } else {
        await this.payables.revertAllocation(
          tx,
          organizationId,
          target.payableId!,
          link.amount,
        );
      }
    }

    await this.creditConsumption.deleteByConsumerPaymentIdTx(
      tx,
      organizationId,
      consumerPaymentId,
    );
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

/**
 * Build the `AllocationTarget` for a credit source by dispatching on the present
 * XOR id (pago-credit-system, design D1) — receivableId → forReceivable, else
 * payableId → forPayable. Mirrors the receivable|payable mapping already used for
 * `AllocationInput` (e.g. payments.service.ts allocation mapping). The XOR
 * (both/neither rejection, code `PAYMENT_CREDIT_INVALID_TARGET`) is enforced at
 * the API edge by the Zod schema (Phase 5) and is valid-by-construction here
 * because exactly one factory is called.
 */
function creditTargetOf(cs: CreditAllocationSource): AllocationTarget {
  return cs.receivableId
    ? AllocationTarget.forReceivable(cs.receivableId)
    : AllocationTarget.forPayable(cs.payableId!);
}

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
