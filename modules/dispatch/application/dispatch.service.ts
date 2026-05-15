import { NotFoundError, ValidationError } from "@/features/shared/errors";
import {
  DISPATCH_NO_DETAILS,
  DISPATCH_BC_FIELDS_ON_ND,
  DISPATCH_INVALID_CONTACT_TYPE,
  DISPATCH_CONTACT_CHANGE_BLOCKED,
  INVALID_STATUS_TRANSITION,
  DISPATCH_NOT_DRAFT,
  DispatchBcFieldsOnNd,
  DispatchNoDetails,
  DispatchNotDraft,
} from "../domain/errors/dispatch-errors";
import {
  Dispatch,
  type CreateDispatchDraftInput,
  type ApplyDispatchEditInput,
} from "../domain/dispatch.entity";
import { DispatchDetail } from "../domain/dispatch-detail.entity";
import type { DispatchType } from "../domain/value-objects/dispatch-type";
import type {
  DispatchRepository,
  DispatchFilters,
} from "../domain/ports/dispatch.repository";
import type {
  PaginationOptions,
  PaginatedResult,
} from "@/modules/shared/domain/value-objects/pagination";
import type {
  DispatchJournalEntryFactoryPort,
  DispatchJournalTemplate,
} from "../domain/ports/dispatch-journal-entry-factory.port";
import type {
  DispatchAccountBalancesPort,
} from "../domain/ports/dispatch-account-balances.port";
import type {
  DispatchOrgSettingsReaderPort,
} from "../domain/ports/dispatch-org-settings-reader.port";
import type {
  DispatchContactsPort,
} from "../domain/ports/dispatch-contacts.port";
import type {
  DispatchFiscalPeriodsPort,
} from "../domain/ports/dispatch-fiscal-periods.port";
import type {
  DispatchReceivablesPort,
} from "../domain/ports/dispatch-receivables.port";
import {
  computeLineAmounts,
  type ComputedDetail,
  type DetailLineInput,
} from "../domain/compute-line-amounts";
import {
  computeBcSummary,
  type BcSummary,
} from "../domain/compute-bc-summary";
import { roundTotal } from "../domain/round-total";

// ── Display code helper (presentation concern kept thin) ───────────────────

function getDisplayCode(type: DispatchType, seq: number): string {
  const prefix = type === "NOTA_DESPACHO" ? "ND" : "BC";
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

// ── Service deps ───────────────────────────────────────────────────────────

export interface DispatchServiceDeps {
  repo: DispatchRepository;
  journalEntryFactory: DispatchJournalEntryFactoryPort;
  accountBalances: DispatchAccountBalancesPort;
  orgSettings: DispatchOrgSettingsReaderPort;
  contacts: DispatchContactsPort;
  fiscalPeriods: DispatchFiscalPeriodsPort;
  receivables: DispatchReceivablesPort;
}

// ── Create dispatch input type ─────────────────────────────────────────────

export interface CreateDispatchInput {
  dispatchType: DispatchType;
  date: Date;
  contactId: string;
  periodId: string;
  description: string;
  referenceNumber?: number;
  notes?: string;
  createdById: string;
  farmOrigin?: string;
  chickenCount?: number;
  shrinkagePct?: number;
  details: DetailLineInput[];
}

export interface UpdateDispatchInput {
  date?: Date;
  contactId?: string;
  description?: string;
  referenceNumber?: number;
  notes?: string;
  farmOrigin?: string;
  chickenCount?: number;
  shrinkagePct?: number;
  details?: DetailLineInput[];
}

// ── DispatchService ────────────────────────────────────────────────────────

export class DispatchService {
  constructor(private readonly deps: DispatchServiceDeps) {}

  // ── List ──────────────────────────────────────────────────────────────

  async list(
    organizationId: string,
    filters?: DispatchFilters,
  ): Promise<Dispatch[]> {
    return this.deps.repo.findAll(organizationId, filters);
  }

  /**
   * Paginated read — thin delegation to `repo.findPaginated`. Additive
   * alongside `list` (dual-method additive-transitional per Journal POC
   * precedent). Consumed by `/sales` RSC twin-call UNION pagination
   * (poc-sales-unified-pagination).
   */
  async listPaginated(
    organizationId: string,
    filters?: DispatchFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Dispatch>> {
    return this.deps.repo.findPaginated(organizationId, filters, pagination);
  }

  // ── Get by ID ────────────────────────────────────────────────────────

  async getById(organizationId: string, id: string): Promise<Dispatch> {
    const dispatch = await this.deps.repo.findById(organizationId, id);
    if (!dispatch) throw new NotFoundError("Despacho");
    return dispatch;
  }

  // ── Create DRAFT ─────────────────────────────────────────────────────

  async create(
    organizationId: string,
    input: CreateDispatchInput,
  ): Promise<Dispatch> {
    // Validate contact is CLIENTE
    const contact = await this.deps.contacts.getActiveById(
      organizationId,
      input.contactId,
    );
    if (contact.type !== "CLIENTE") {
      throw new ValidationError(
        "El contacto debe ser de tipo CLIENTE para crear un despacho",
        DISPATCH_INVALID_CONTACT_TYPE,
      );
    }

    // Validate BC fields not on ND
    if (input.dispatchType === "NOTA_DESPACHO") {
      if (
        input.farmOrigin !== undefined ||
        input.chickenCount !== undefined ||
        input.shrinkagePct !== undefined
      ) {
        throw new DispatchBcFieldsOnNd();
      }
    }

    // Compute line amounts
    const shrinkagePct =
      input.dispatchType === "BOLETA_CERRADA"
        ? (input.shrinkagePct ?? 0)
        : 0;
    const computedDetails = computeLineAmounts(
      input.details,
      input.dispatchType,
      shrinkagePct,
    );

    // Build domain entity with pre-computed details
    const draftInput: CreateDispatchDraftInput = {
      organizationId,
      dispatchType: input.dispatchType,
      contactId: input.contactId,
      periodId: input.periodId,
      date: input.date,
      description: input.description,
      createdById: input.createdById,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      farmOrigin: input.farmOrigin,
      chickenCount: input.chickenCount,
      shrinkagePct: input.shrinkagePct,
      details: computedDetails.map((d) => ({
        description: d.description,
        boxes: d.boxes,
        grossWeight: d.grossWeight,
        tare: d.tare,
        netWeight: d.netWeight,
        unitPrice: d.unitPrice,
        lineAmount: d.lineAmount,
        order: d.order,
        productTypeId: d.productTypeId,
        detailNote: d.detailNote,
        shrinkage: d.shrinkage,
        shortage: d.shortage,
        realNetWeight: d.realNetWeight,
      })),
    };

    let dispatch = Dispatch.createDraft(draftInput);

    // Compute BC summary
    if (
      input.dispatchType === "BOLETA_CERRADA" &&
      input.chickenCount !== undefined
    ) {
      const bcSummary = computeBcSummary(computedDetails, input.chickenCount);
      dispatch = dispatch.setBcSummary(bcSummary);
    }

    return this.deps.repo.saveTx(dispatch);
  }

  // ── Create and Post (atomic) ─────────────────────────────────────────

  async createAndPost(
    organizationId: string,
    input: CreateDispatchInput,
    userId: string,
  ): Promise<{ dispatch: Dispatch; correlationId: string }> {
    // Validate contact
    const contact = await this.deps.contacts.getActiveById(
      organizationId,
      input.contactId,
    );
    if (contact.type !== "CLIENTE") {
      throw new ValidationError(
        "El contacto debe ser de tipo CLIENTE para crear un despacho",
        DISPATCH_INVALID_CONTACT_TYPE,
      );
    }

    // Validate BC fields on ND
    if (input.dispatchType === "NOTA_DESPACHO") {
      if (
        input.farmOrigin !== undefined ||
        input.chickenCount !== undefined ||
        input.shrinkagePct !== undefined
      ) {
        throw new DispatchBcFieldsOnNd();
      }
    }

    // Validate period open
    const period = await this.deps.fiscalPeriods.getById(
      organizationId,
      input.periodId,
    );
    if (period.status !== "OPEN") {
      throw new ValidationError(
        "El período fiscal debe estar ABIERTO",
        "PERIOD_CLOSED",
      );
    }

    // Compute details
    const shrinkagePct =
      input.dispatchType === "BOLETA_CERRADA"
        ? (input.shrinkagePct ?? 0)
        : 0;
    const computedDetails = computeLineAmounts(
      input.details,
      input.dispatchType,
      shrinkagePct,
    );

    if (computedDetails.length === 0) {
      throw new DispatchNoDetails();
    }

    // Compute BC summary
    let bcSummary: BcSummary | undefined;
    if (
      input.dispatchType === "BOLETA_CERRADA" &&
      input.chickenCount !== undefined
    ) {
      bcSummary = computeBcSummary(computedDetails, input.chickenCount);
    }

    // Compute total amount
    const exactTotal = computedDetails.reduce(
      (sum, d) => sum + d.lineAmount,
      0,
    );
    const settings = await this.deps.orgSettings.getOrCreate(organizationId);
    const totalAmount = roundTotal(exactTotal, settings.roundingThreshold);

    const incomeAccountCode =
      input.dispatchType === "NOTA_DESPACHO" ? "4.1.2" : "4.1.1";

    // Get sequence number
    const sequenceNumber =
      await this.deps.repo.getNextSequenceNumberTx(
        organizationId,
        input.dispatchType,
      );

    // Build entity
    const draftInput: CreateDispatchDraftInput = {
      organizationId,
      dispatchType: input.dispatchType,
      contactId: input.contactId,
      periodId: input.periodId,
      date: input.date,
      description: input.description,
      createdById: userId,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      farmOrigin: input.farmOrigin,
      chickenCount: input.chickenCount,
      shrinkagePct: input.shrinkagePct,
      details: computedDetails.map((d) => ({
        description: d.description,
        boxes: d.boxes,
        grossWeight: d.grossWeight,
        tare: d.tare,
        netWeight: d.netWeight,
        unitPrice: d.unitPrice,
        lineAmount: d.lineAmount,
        order: d.order,
        productTypeId: d.productTypeId,
        detailNote: d.detailNote,
        shrinkage: d.shrinkage,
        shortage: d.shortage,
        realNetWeight: d.realNetWeight,
      })),
    };

    let dispatch = Dispatch.createDraft(draftInput);
    dispatch = dispatch.assignSequenceNumber(sequenceNumber);
    dispatch = dispatch.setTotalAmount(totalAmount);
    if (bcSummary) dispatch = dispatch.setBcSummary(bcSummary);
    dispatch = dispatch.post();

    // Persist
    dispatch = await this.deps.repo.saveTx(dispatch);

    // Generate journal entry
    const displayCode = getDisplayCode(input.dispatchType, sequenceNumber);
    const journalDescription = input.notes
      ? `${displayCode} - ${input.description} | ${input.notes}`
      : `${displayCode} - ${input.description}`;

    const journalEntryId = await this.deps.journalEntryFactory.generateForDispatch({
      organizationId,
      contactId: input.contactId,
      date: input.date,
      periodId: input.periodId,
      description: journalDescription,
      sourceType: "dispatch",
      sourceId: dispatch.id,
      createdById: userId,
      lines: [
        {
          accountCode: settings.cxcAccountCode,
          side: "DEBIT",
          amount: totalAmount,
          contactId: input.contactId,
        },
        {
          accountCode: incomeAccountCode,
          side: "CREDIT",
          amount: totalAmount,
        },
      ],
    });

    // Apply balances
    await this.deps.accountBalances.applyPost(journalEntryId);

    // Create receivable
    const paymentTermsDays = contact.paymentTermsDays ?? 30;
    const dueDate = new Date(
      input.date.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
    );

    const receivableId = await this.deps.receivables.createTx({
      organizationId,
      contactId: input.contactId,
      description: journalDescription,
      amount: totalAmount,
      dueDate,
      sourceType: "dispatch",
      sourceId: dispatch.id,
      journalEntryId,
    });

    // Link
    await this.deps.repo.linkJournalAndReceivableTx(
      organizationId,
      dispatch.id,
      journalEntryId,
      receivableId,
    );

    dispatch = dispatch.linkJournal(journalEntryId);
    dispatch = dispatch.linkReceivable(receivableId);

    return { dispatch, correlationId: crypto.randomUUID() };
  }

  // ── Update ───────────────────────────────────────────────────────────

  async update(
    organizationId: string,
    id: string,
    input: UpdateDispatchInput,
    role?: string,
    justification?: string,
    userId?: string,
  ): Promise<{ dispatch: Dispatch; correlationId: string }> {
    let dispatch = await this.getById(organizationId, id);
    const status = dispatch.status;

    // Validate editability
    if (status === "VOIDED") {
      throw new ValidationError(
        "Un despacho anulado no puede ser modificado",
        INVALID_STATUS_TRANSITION,
      );
    }

    if (status === "LOCKED") {
      if (!role || role !== "admin") {
        throw new ValidationError(
          "Solo administradores pueden editar despachos bloqueados",
          INVALID_STATUS_TRANSITION,
        );
      }
    }

    // Validate contact type if changing
    if (input.contactId !== undefined) {
      const contact = await this.deps.contacts.getActiveById(
        organizationId,
        input.contactId,
      );
      if (contact.type !== "CLIENTE") {
        throw new ValidationError(
          "El contacto debe ser de tipo CLIENTE",
          DISPATCH_INVALID_CONTACT_TYPE,
        );
      }
    }

    // Validate BC fields on ND
    if (dispatch.dispatchType === "NOTA_DESPACHO") {
      if (
        input.farmOrigin !== undefined ||
        input.chickenCount !== undefined ||
        input.shrinkagePct !== undefined
      ) {
        throw new DispatchBcFieldsOnNd();
      }
    }

    // Compute details if provided
    let computedDetails: ComputedDetail[] | undefined;
    let bcSummary: BcSummary | undefined;

    if (input.details !== undefined) {
      const shrinkagePct =
        dispatch.dispatchType === "BOLETA_CERRADA"
          ? (input.shrinkagePct ?? dispatch.shrinkagePct ?? 0)
          : 0;
      computedDetails = computeLineAmounts(
        input.details,
        dispatch.dispatchType,
        shrinkagePct,
      );

      if (dispatch.dispatchType === "BOLETA_CERRADA") {
        const chickenCount =
          input.chickenCount ?? dispatch.chickenCount ?? undefined;
        if (chickenCount !== undefined) {
          bcSummary = computeBcSummary(computedDetails, chickenCount);
        }
      }
    }

    // Apply edit
    const editInput: ApplyDispatchEditInput = {};
    if (input.date !== undefined) editInput.date = input.date;
    if (input.description !== undefined)
      editInput.description = input.description;
    if (input.contactId !== undefined) editInput.contactId = input.contactId;
    if ("referenceNumber" in input) editInput.referenceNumber = input.referenceNumber;
    if ("notes" in input) editInput.notes = input.notes;
    if ("farmOrigin" in input) editInput.farmOrigin = input.farmOrigin;
    if ("chickenCount" in input) editInput.chickenCount = input.chickenCount;
    if ("shrinkagePct" in input) editInput.shrinkagePct = input.shrinkagePct;

    dispatch = dispatch.applyEdit(editInput);

    if (computedDetails !== undefined) {
      const newDetails = computedDetails.map((d) =>
        DispatchDetail.create({
          dispatchId: dispatch.id,
          description: d.description,
          boxes: d.boxes,
          grossWeight: d.grossWeight,
          tare: d.tare,
          netWeight: d.netWeight,
          unitPrice: d.unitPrice,
          lineAmount: d.lineAmount,
          order: d.order,
          productTypeId: d.productTypeId,
          detailNote: d.detailNote,
          shrinkage: d.shrinkage,
          shortage: d.shortage,
          realNetWeight: d.realNetWeight,
        }),
      );
      dispatch = dispatch.replaceDetails(newDetails);
    }

    if (bcSummary) {
      dispatch = dispatch.setBcSummary(bcSummary);
    }

    dispatch = await this.deps.repo.updateTx(dispatch, {
      replaceDetails: computedDetails !== undefined,
      computedDetails,
      bcSummary,
    });

    return { dispatch, correlationId: crypto.randomUUID() };
  }

  // ── Delete DRAFT ─────────────────────────────────────────────────────

  async delete(organizationId: string, id: string): Promise<void> {
    const dispatch = await this.getById(organizationId, id);
    dispatch.assertCanDelete();
    await this.deps.repo.deleteTx(organizationId, id);
  }

  // ── Post (DRAFT → POSTED) ───────────────────────────────────────────

  async post(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<{ dispatch: Dispatch; correlationId: string }> {
    let dispatch = await this.getById(organizationId, id);

    // Validate period open
    const period = await this.deps.fiscalPeriods.getById(
      organizationId,
      dispatch.periodId,
    );
    if (period.status !== "OPEN") {
      throw new ValidationError(
        "El período fiscal debe estar ABIERTO",
        "PERIOD_CLOSED",
      );
    }

    // Post via entity
    dispatch = dispatch.post();

    // Compute total
    const exactTotal = dispatch.details.reduce(
      (sum, d) => sum + d.lineAmount,
      0,
    );
    const settings = await this.deps.orgSettings.getOrCreate(organizationId);
    const totalAmount = roundTotal(exactTotal, settings.roundingThreshold);
    dispatch = dispatch.setTotalAmount(totalAmount);

    // Assign sequence
    const sequenceNumber =
      await this.deps.repo.getNextSequenceNumberTx(
        organizationId,
        dispatch.dispatchType,
      );
    dispatch = dispatch.assignSequenceNumber(sequenceNumber);

    // Persist
    dispatch = await this.deps.repo.updateTx(dispatch, {
      replaceDetails: false,
    });

    // Journal
    const displayCode = getDisplayCode(dispatch.dispatchType, sequenceNumber);
    const incomeAccountCode =
      dispatch.dispatchType === "NOTA_DESPACHO" ? "4.1.2" : "4.1.1";

    const journalDescription = dispatch.notes
      ? `${displayCode} - ${dispatch.description} | ${dispatch.notes}`
      : `${displayCode} - ${dispatch.description}`;

    const journalEntryId = await this.deps.journalEntryFactory.generateForDispatch({
      organizationId,
      contactId: dispatch.contactId,
      date: dispatch.date,
      periodId: dispatch.periodId,
      description: journalDescription,
      sourceType: "dispatch",
      sourceId: dispatch.id,
      createdById: userId,
      lines: [
        {
          accountCode: settings.cxcAccountCode,
          side: "DEBIT",
          amount: totalAmount,
          contactId: dispatch.contactId,
        },
        {
          accountCode: incomeAccountCode,
          side: "CREDIT",
          amount: totalAmount,
        },
      ],
    });

    // Balances
    await this.deps.accountBalances.applyPost(journalEntryId);

    // Receivable
    const contact = await this.deps.contacts.getActiveById(
      organizationId,
      dispatch.contactId,
    );
    const paymentTermsDays = contact.paymentTermsDays ?? 30;
    const dueDate = new Date(
      dispatch.date.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
    );

    const receivableId = await this.deps.receivables.createTx({
      organizationId,
      contactId: dispatch.contactId,
      description: journalDescription,
      amount: totalAmount,
      dueDate,
      sourceType: "dispatch",
      sourceId: dispatch.id,
      journalEntryId,
    });

    // Link
    await this.deps.repo.linkJournalAndReceivableTx(
      organizationId,
      dispatch.id,
      journalEntryId,
      receivableId,
    );

    dispatch = dispatch.linkJournal(journalEntryId);
    dispatch = dispatch.linkReceivable(receivableId);

    return { dispatch, correlationId: crypto.randomUUID() };
  }

  // ── Void (POSTED/LOCKED → VOIDED) ───────────────────────────────────

  async voidDispatch(
    organizationId: string,
    id: string,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<{ dispatch: Dispatch; correlationId: string }> {
    let dispatch = await this.getById(organizationId, id);

    // Void via entity (validates transition)
    dispatch = dispatch.void();

    // Update status
    dispatch = await this.deps.repo.updateStatusTx(
      organizationId,
      id,
      "VOIDED",
    );

    // Void journal
    if (dispatch.journalEntryId) {
      await this.deps.accountBalances.applyVoid(dispatch.journalEntryId);
    }

    // Void receivable
    if (dispatch.receivableId) {
      await this.deps.receivables.voidTx(organizationId, dispatch.receivableId);
    }

    return { dispatch, correlationId: crypto.randomUUID() };
  }

  // ── Hard Delete DRAFT ────────────────────────────────────────────────

  async hardDelete(organizationId: string, id: string): Promise<void> {
    const dispatch = await this.getById(organizationId, id);
    if (dispatch.status !== "DRAFT") {
      throw new DispatchNotDraft();
    }
    await this.deps.repo.deleteTx(organizationId, id);
  }

  // ── Recreate (POSTED → VOIDED + clone to DRAFT) ─────────────────────

  /**
   * @deprecated Prefer in-place editing via update() for POSTED dispatches.
   */
  async recreate(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<{
    voidedId: string;
    newDraftId: string;
    correlationId: string;
  }> {
    const dispatch = await this.getById(organizationId, id);

    if (dispatch.status !== "POSTED") {
      throw new ValidationError(
        "Solo se pueden recrear despachos en estado CONTABILIZADO",
        INVALID_STATUS_TRANSITION,
      );
    }

    // Void the original
    await this.deps.repo.updateStatusTx(organizationId, id, "VOIDED");

    if (dispatch.journalEntryId) {
      await this.deps.accountBalances.applyVoid(dispatch.journalEntryId);
    }
    if (dispatch.receivableId) {
      await this.deps.receivables.voidTx(organizationId, dispatch.receivableId);
    }

    // Clone to DRAFT
    const newDraft = await this.deps.repo.cloneToDraftTx(
      organizationId,
      dispatch,
    );

    return {
      voidedId: dispatch.id,
      newDraftId: newDraft.id,
      correlationId: crypto.randomUUID(),
    };
  }
}
