import {
  NotFoundError,
  ValidationError,
  DISPATCH_NO_DETAILS,
  DISPATCH_BC_FIELDS_ON_ND,
  DISPATCH_INVALID_CONTACT_TYPE,
  DISPATCH_NOT_DRAFT,
  DISPATCH_HAS_ACTIVE_PAYMENTS,
  DISPATCH_CONTACT_CHANGE_BLOCKED,
  INVALID_STATUS_TRANSITION,
} from "@/features/shared/errors";
import {
  validateTransition,
  validateDraftOnly,
  validateEditable,
  validateLockedEdit,
  validatePeriodOpen,
  type DocumentStatus,
} from "@/features/shared/document-lifecycle.service";
import { computeReceivableStatus } from "@/features/shared/accounting-helpers";
import { JournalRepository } from "@/features/accounting/journal.repository";
import { setAuditContext } from "@/features/shared/audit-context";
import { Prisma } from "@/generated/prisma/client";
import { DispatchRepository } from "./dispatch.repository";
import type { ComputedDetail, BcSummary } from "./dispatch.repository";
import { OrgSettingsService } from "@/features/org-settings";
import { AutoEntryGenerator } from "@/features/shared/auto-entry-generator";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { VoucherTypesRepository } from "@/features/voucher-types/voucher-types.repository";
import { ContactsService } from "@/features/contacts";
import { ReceivablesRepository } from "@/features/receivables/receivables.repository";
import { AccountBalancesService } from "@/features/account-balances";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import type { DispatchType } from "@/generated/prisma/client";
import type {
  DispatchWithDetails,
  CreateDispatchInput,
  UpdateDispatchInput,
  DispatchFilters,
  DispatchDetailInput,
} from "./dispatch.types";
import { roundTotal } from "./dispatch.utils";

// ── Helper: compute display code ──

function getDisplayCode(type: DispatchType, seq: number): string {
  const prefix = type === "NOTA_DESPACHO" ? "ND" : "BC";
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

// ── Helper: compute all derived fields per detail line ──
// lineAmount = raw weight × unitPrice, rounded to 2 decimals (no per-line custom rounding)

function computeLineAmounts(
  details: DispatchDetailInput[],
  dispatchType: DispatchType,
  shrinkagePct: number,
): ComputedDetail[] {
  return details.map((d) => {
    const tare = d.boxes * 2;
    const netWeight = d.grossWeight - tare;

    if (dispatchType === "BOLETA_CERRADA") {
      const shrinkage = netWeight * (shrinkagePct / 100);
      const shortage = d.shortage ?? 0;
      const realNetWeight = netWeight - shrinkage - shortage;
      const lineAmount = Math.round(realNetWeight * d.unitPrice * 100) / 100;
      return {
        productTypeId: d.productTypeId,
        detailNote: d.detailNote,
        description: d.description,
        boxes: d.boxes,
        grossWeight: d.grossWeight,
        tare,
        netWeight,
        unitPrice: d.unitPrice,
        shrinkage,
        shortage,
        realNetWeight,
        lineAmount,
        order: d.order,
      };
    }

    // NOTA_DESPACHO
    const lineAmount = Math.round(netWeight * d.unitPrice * 100) / 100;
    return {
      productTypeId: d.productTypeId,
      detailNote: d.detailNote,
      description: d.description,
      boxes: d.boxes,
      grossWeight: d.grossWeight,
      tare,
      netWeight,
      unitPrice: d.unitPrice,
      lineAmount,
      order: d.order,
    };
  });
}

// ── Helper: compute BC header summary from computed details ──

function computeBcSummary(
  computedDetails: ComputedDetail[],
  chickenCount: number,
): BcSummary {
  const totalGrossKg = computedDetails.reduce((s, d) => s + d.grossWeight, 0);
  const totalNetKg = computedDetails.reduce((s, d) => s + d.netWeight, 0);
  const totalShrinkKg = computedDetails.reduce(
    (s, d) => s + (d.shrinkage ?? 0),
    0,
  );
  const totalShortageKg = computedDetails.reduce(
    (s, d) => s + (d.shortage ?? 0),
    0,
  );
  const totalRealNetKg = computedDetails.reduce(
    (s, d) => s + (d.realNetWeight ?? 0),
    0,
  );
  const avgKgPerChicken = chickenCount > 0 ? totalNetKg / chickenCount : 0;
  return {
    totalGrossKg,
    totalNetKg,
    totalShrinkKg,
    totalShortageKg,
    totalRealNetKg,
    avgKgPerChicken,
  };
}

// ── Helper: add displayCode to result ──

function withDisplayCode(dispatch: DispatchWithDetails): DispatchWithDetails {
  return {
    ...dispatch,
    displayCode: getDisplayCode(
      dispatch.dispatchType as DispatchType,
      dispatch.sequenceNumber,
    ),
  };
}

export class DispatchService {
  private readonly repo: DispatchRepository;
  private readonly orgSettingsService: OrgSettingsService;
  private readonly autoEntryGenerator: AutoEntryGenerator;
  private readonly contactsService: ContactsService;
  private readonly receivablesRepo: ReceivablesRepository;
  private readonly balancesService: AccountBalancesService;
  private readonly periodsService: FiscalPeriodsService;
  private readonly accountsRepo: AccountsRepository;
  private readonly journalRepo: JournalRepository;

  constructor(
    repo?: DispatchRepository,
    orgSettingsService?: OrgSettingsService,
    autoEntryGenerator?: AutoEntryGenerator,
    contactsService?: ContactsService,
    receivablesRepo?: ReceivablesRepository,
    balancesService?: AccountBalancesService,
    periodsService?: FiscalPeriodsService,
    accountsRepo?: AccountsRepository,
    journalRepo?: JournalRepository,
  ) {
    this.repo = repo ?? new DispatchRepository();
    this.orgSettingsService = orgSettingsService ?? new OrgSettingsService();
    this.contactsService = contactsService ?? new ContactsService();
    this.receivablesRepo = receivablesRepo ?? new ReceivablesRepository();
    this.balancesService = balancesService ?? new AccountBalancesService();
    this.periodsService = periodsService ?? new FiscalPeriodsService();
    this.accountsRepo = accountsRepo ?? new AccountsRepository();
    this.journalRepo = journalRepo ?? new JournalRepository();

    const voucherTypesRepo = new VoucherTypesRepository();
    this.autoEntryGenerator =
      autoEntryGenerator ?? new AutoEntryGenerator(this.accountsRepo, voucherTypesRepo);
  }

  // ── List dispatches ──

  async list(
    organizationId: string,
    filters?: DispatchFilters,
  ): Promise<DispatchWithDetails[]> {
    const rows = await this.repo.findAll(organizationId, filters);
    return rows.map(withDisplayCode);
  }

  // ── Get a single dispatch ──

  async getById(organizationId: string, id: string): Promise<DispatchWithDetails> {
    const row = await this.repo.findById(organizationId, id);
    if (!row) throw new NotFoundError("Despacho");
    return withDisplayCode(row);
  }

  // ── Create a dispatch in DRAFT ──

  async create(
    organizationId: string,
    input: CreateDispatchInput,
  ): Promise<DispatchWithDetails> {
    // 1. Validate contact exists and is CLIENTE
    const contact = await this.contactsService.getActiveById(organizationId, input.contactId);
    if (contact.type !== "CLIENTE") {
      throw new ValidationError(
        "El contacto debe ser de tipo CLIENTE para crear un despacho",
        DISPATCH_INVALID_CONTACT_TYPE,
      );
    }

    // 2. Validate BC fields not provided for ND
    if (input.dispatchType === "NOTA_DESPACHO") {
      if (
        input.farmOrigin !== undefined ||
        input.chickenCount !== undefined ||
        input.shrinkagePct !== undefined
      ) {
        throw new ValidationError(
          "Los campos de Boleta Cerrada no son permitidos en Notas de Despacho",
          DISPATCH_BC_FIELDS_ON_ND,
        );
      }
    }

    // 3. Compute all derived fields per detail line
    const shrinkagePct =
      input.dispatchType === "BOLETA_CERRADA" ? (input.shrinkagePct ?? 0) : 0;
    const computedDetails = computeLineAmounts(
      input.details,
      input.dispatchType,
      shrinkagePct,
    );

    // 5. Compute BC header summary
    let bcSummary: BcSummary | undefined;
    if (input.dispatchType === "BOLETA_CERRADA" && input.chickenCount !== undefined) {
      bcSummary = computeBcSummary(computedDetails, input.chickenCount);
    }

    // 6. Create with sequenceNumber = 0 (placeholder; proper seq assigned at POST)
    //    For DRAFT, sequenceNumber = 0 so display code shows ND-000 — update at POST
    const row = await this.repo.create(
      organizationId,
      input,
      0,
      computedDetails,
      bcSummary,
    );

    return withDisplayCode(row);
  }

  // ── Create and post a dispatch in one atomic transaction ──

  async createAndPost(
    organizationId: string,
    input: CreateDispatchInput,
    userId: string,
  ): Promise<DispatchWithDetails> {
    // 1. Validate contact exists and is CLIENTE
    const contact = await this.contactsService.getActiveById(organizationId, input.contactId);
    if (contact.type !== "CLIENTE") {
      throw new ValidationError(
        "El contacto debe ser de tipo CLIENTE para crear un despacho",
        DISPATCH_INVALID_CONTACT_TYPE,
      );
    }

    // 2. Validate BC fields not provided for ND
    if (input.dispatchType === "NOTA_DESPACHO") {
      if (
        input.farmOrigin !== undefined ||
        input.chickenCount !== undefined ||
        input.shrinkagePct !== undefined
      ) {
        throw new ValidationError(
          "Los campos de Boleta Cerrada no son permitidos en Notas de Despacho",
          DISPATCH_BC_FIELDS_ON_ND,
        );
      }
    }

    // 3. Validate fiscal period is OPEN
    const period = await this.periodsService.getById(organizationId, input.periodId);
    await validatePeriodOpen(period);

    // 4. Compute details
    const shrinkagePct =
      input.dispatchType === "BOLETA_CERRADA" ? (input.shrinkagePct ?? 0) : 0;
    const computedDetails = computeLineAmounts(
      input.details,
      input.dispatchType,
      shrinkagePct,
    );

    if (computedDetails.length === 0) {
      throw new ValidationError(
        "El despacho debe tener al menos una línea de detalle para ser contabilizado",
        DISPATCH_NO_DETAILS,
      );
    }

    // 5. Compute BC header summary
    let bcSummary: BcSummary | undefined;
    if (input.dispatchType === "BOLETA_CERRADA" && input.chickenCount !== undefined) {
      bcSummary = computeBcSummary(computedDetails, input.chickenCount);
    }

    // 6. Compute totalAmount
    const exactTotal = computedDetails.reduce((sum, d) => sum + d.lineAmount, 0);
    const settings = await this.orgSettingsService.getOrCreate(organizationId);
    const threshold = Number(settings.roundingThreshold);
    const totalAmount = roundTotal(exactTotal, threshold);

    const incomeAccountCode =
      input.dispatchType === "NOTA_DESPACHO" ? "4.1.2" : "4.1.1";

    // Pre-fetch contact payment terms before transaction
    const paymentTermsDays = (contact as { paymentTermsDays?: number }).paymentTermsDays ?? 30;

    // 7. Single atomic transaction
    let dispatchId = "";

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId);

      const sequenceNumber = await this.repo.getNextSequenceNumber(
        tx,
        organizationId,
        input.dispatchType,
      );

      const dispatch = await this.repo.createPostedTx(
        tx,
        organizationId,
        input,
        sequenceNumber,
        computedDetails,
        totalAmount,
        bcSummary,
      );
      dispatchId = dispatch.id;

      const displayCode = getDisplayCode(input.dispatchType, sequenceNumber);

      const journalDescription = input.notes
        ? `${displayCode} - ${input.description} | ${input.notes}`
        : `${displayCode} - ${input.description}`;

      const entry = await this.autoEntryGenerator.generate(tx, {
        organizationId,
        voucherTypeCode: "CD",
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

      await this.balancesService.applyPost(tx, entry);

      const dueDate = new Date(
        input.date.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
      );

      const receivable = await this.receivablesRepo.createTx(tx, {
        organizationId,
        contactId: input.contactId,
        description: journalDescription,
        amount: totalAmount,
        dueDate,
        sourceType: "dispatch",
        sourceId: dispatch.id,
        journalEntryId: entry.id,
      });

      await this.repo.linkJournalAndReceivable(
        tx,
        dispatch.id,
        entry.id,
        receivable.id,
      );
    });

    const result = await this.repo.findById(organizationId, dispatchId);
    return withDisplayCode(result!);
  }

  // ── Update a DRAFT dispatch (or LOCKED with justification) ──

  async update(
    organizationId: string,
    id: string,
    input: UpdateDispatchInput,
    role?: string,
    justification?: string,
    userId?: string,
  ): Promise<DispatchWithDetails> {
    const dispatch = await this.getById(organizationId, id);
    const status = dispatch.status as DocumentStatus;

    if (status === "LOCKED") {
      validateLockedEdit(status, role!, justification);
    } else {
      validateEditable(status);
    }

    // Validate new contact type if changing
    if (input.contactId !== undefined) {
      const contact = await this.contactsService.getActiveById(
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

    // Validate BC fields not on ND
    if (dispatch.dispatchType === "NOTA_DESPACHO") {
      if (
        input.farmOrigin !== undefined ||
        input.chickenCount !== undefined ||
        input.shrinkagePct !== undefined
      ) {
        throw new ValidationError(
          "Los campos de Boleta Cerrada no son permitidos en Notas de Despacho",
          DISPATCH_BC_FIELDS_ON_ND,
        );
      }
    }

    // Recompute lineAmounts if details changed
    let computedDetails: ComputedDetail[] | undefined;
    let bcSummary: BcSummary | undefined;

    if (input.details !== undefined) {
      const shrinkagePct =
        dispatch.dispatchType === "BOLETA_CERRADA"
          ? (input.shrinkagePct ??
              (dispatch.shrinkagePct !== null ? Number(dispatch.shrinkagePct) : 0))
          : 0;

      computedDetails = computeLineAmounts(
        input.details,
        dispatch.dispatchType as DispatchType,
        shrinkagePct,
      );

      // Recompute BC header summary if relevant
      if (dispatch.dispatchType === "BOLETA_CERRADA") {
        const chickenCount =
          input.chickenCount ??
          (dispatch.chickenCount !== null ? dispatch.chickenCount : undefined);
        if (chickenCount !== undefined) {
          bcSummary = computeBcSummary(computedDetails, chickenCount);
        }
      }
    }

    const { details: _details, ...dataWithoutDetails } = input;

    // For POSTED dispatches, run the atomic reverse-modify-reapply path
    if (status === "POSTED") {
      const period = await this.periodsService.getById(organizationId, dispatch.periodId);
      await validatePeriodOpen(period);
      return this.updatePostedDispatchTx(
        organizationId,
        dispatch,
        input,
        computedDetails,
        bcSummary,
        userId ?? "unknown",
      );
    }

    // For LOCKED edits, wrap in transaction with audit context
    if (status === "LOCKED") {
      const row = await this.repo.transaction(async (tx) => {
        await setAuditContext(tx, dispatch.createdById ?? "unknown", justification);
        return this.repo.updateTx(
          tx,
          organizationId,
          id,
          dataWithoutDetails,
          computedDetails,
          bcSummary,
        );
      });
      return withDisplayCode(row);
    }

    const row = await this.repo.update(
      organizationId,
      id,
      dataWithoutDetails,
      computedDetails,
      bcSummary,
    );
    return withDisplayCode(row);
  }

  // ── Update a POSTED dispatch (atomic reverse-modify-reapply) ──

  private async updatePostedDispatchTx(
    organizationId: string,
    dispatch: DispatchWithDetails,
    input: UpdateDispatchInput,
    computedDetails: ComputedDetail[] | undefined,
    bcSummary: BcSummary | undefined,
    userId: string,
  ): Promise<DispatchWithDetails> {
    // 1. Validate at least 1 detail line if details are changing
    if (computedDetails !== undefined && computedDetails.length === 0) {
      throw new ValidationError(
        "El despacho debe tener al menos una línea de detalle para ser contabilizado",
        DISPATCH_NO_DETAILS,
      );
    }

    // 2. Pre-fetch settings and compute newTotalAmount if details changed
    const settings = await this.orgSettingsService.getOrCreate(organizationId);
    let newTotalAmount: number | undefined;
    if (computedDetails !== undefined) {
      const threshold = Number(settings.roundingThreshold);
      const exactTotal = computedDetails.reduce((sum, d) => sum + d.lineAmount, 0);
      newTotalAmount = roundTotal(exactTotal, threshold);
    }

    // 3. Pre-validate contact change: block if CxC has active payment allocations
    if (input.contactId !== undefined && input.contactId !== dispatch.contactId) {
      if (dispatch.receivableId) {
        const allocations = await this.repo.transaction(async (tx) => {
          return tx.paymentAllocation.findMany({
            where: {
              receivableId: dispatch.receivableId!,
              amount: { gt: 0 },
              payment: { status: { not: "VOIDED" } },
            },
          });
        });
        if (allocations.length > 0) {
          throw new ValidationError(
            "No se puede cambiar el contacto del despacho porque tiene pagos activos asociados",
            DISPATCH_CONTACT_CHANGE_BLOCKED,
          );
        }
      }
    }

    const { details: _details, ...dataWithoutDetails } = input;

    // 4. Resolve account IDs before the transaction
    const incomeAccountCode =
      dispatch.dispatchType === "NOTA_DESPACHO" ? "4.1.2" : "4.1.1";

    const cxcAccount = await this.accountsRepo.findByCode(
      organizationId,
      settings.cxcAccountCode,
    );
    if (!cxcAccount || !cxcAccount.isActive || !cxcAccount.isDetail) {
      throw new ValidationError(
        `Cuenta ${settings.cxcAccountCode} no es posteable`,
        "ACCOUNT_NOT_POSTABLE",
      );
    }
    const incomeAccount = await this.accountsRepo.findByCode(
      organizationId,
      incomeAccountCode,
    );
    if (!incomeAccount || !incomeAccount.isActive || !incomeAccount.isDetail) {
      throw new ValidationError(
        `Cuenta ${incomeAccountCode} no es posteable`,
        "ACCOUNT_NOT_POSTABLE",
      );
    }

    // 5. Execute atomic transaction
    await this.repo.transaction(async (tx) => {
      // a. Set audit context
      await setAuditContext(tx, userId);

      // b. Reverse old journal entry balances
      if (dispatch.journalEntryId) {
        const oldEntry = await tx.journalEntry.findFirst({
          where: { id: dispatch.journalEntryId, organizationId },
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

      // c. Update dispatch fields + details
      await this.repo.updateTx(
        tx,
        organizationId,
        dispatch.id,
        dataWithoutDetails,
        computedDetails,
        bcSummary,
      );

      // d. If totalAmount changed, update it on the dispatch record
      if (newTotalAmount !== undefined) {
        await this.repo.updateStatusTx(
          tx,
          organizationId,
          dispatch.id,
          "POSTED",
          newTotalAmount,
        );
      }

      // e. Build new journal lines
      const effectiveTotalAmount = newTotalAmount ?? Number(dispatch.totalAmount);
      const effectiveContactId = input.contactId ?? dispatch.contactId;

      const newLines = [
        {
          accountId: cxcAccount.id,
          debit: effectiveTotalAmount,
          credit: 0,
          contactId: effectiveContactId,
          order: 0,
        },
        {
          accountId: incomeAccount.id,
          debit: 0,
          credit: effectiveTotalAmount,
          order: 1,
        },
      ];

      // f. Update journal entry
      const effectiveDate = input.date ?? dispatch.date;
      const effectiveDescription = input.description ?? dispatch.description;
      const effectiveNotes = input.notes ?? dispatch.notes;
      const displayCode = getDisplayCode(
        dispatch.dispatchType as DispatchType,
        dispatch.sequenceNumber,
      );
      const journalDescription = effectiveNotes
        ? `${displayCode} - ${effectiveDescription} | ${effectiveNotes}`
        : `${displayCode} - ${effectiveDescription}`;

      const updatedEntry = await this.journalRepo.updateTx(
        tx,
        organizationId,
        dispatch.journalEntryId!,
        {
          date: effectiveDate,
          description: journalDescription,
          contactId: effectiveContactId,
        },
        newLines,
        userId,
      );

      // g. Apply new balances
      await this.balancesService.applyPost(tx, updatedEntry);

      // h. Update CxC: amount, balance, status
      if (dispatch.receivableId) {
        const existingReceivable = await tx.accountsReceivable.findFirst({
          where: { id: dispatch.receivableId },
          select: { paid: true },
        });
        const paid = existingReceivable ? Number(existingReceivable.paid) : 0;
        const newBalance = Math.max(0, effectiveTotalAmount - paid);
        const newStatus = computeReceivableStatus(paid, newBalance);

        await tx.accountsReceivable.update({
          where: { id: dispatch.receivableId },
          data: {
            amount: new Prisma.Decimal(effectiveTotalAmount),
            balance: new Prisma.Decimal(newBalance),
            status: newStatus,
            ...(input.contactId !== undefined && { contactId: input.contactId }),
          },
        });
      }
    });

    const updated = await this.repo.findById(organizationId, dispatch.id);
    return withDisplayCode(updated!);
  }

  // ── Delete a DRAFT dispatch ──

  async delete(organizationId: string, id: string): Promise<void> {
    const dispatch = await this.getById(organizationId, id);
    validateDraftOnly(dispatch.status as DocumentStatus);
    await this.repo.delete(organizationId, id);
  }

  // ── Post a dispatch (DRAFT → POSTED) ──

  async post(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<DispatchWithDetails> {
    const dispatch = await this.getById(organizationId, id);

    // Validate lifecycle transition
    validateTransition(
      dispatch.status as DocumentStatus,
      "POSTED",
    );

    // Validate fiscal period is OPEN
    const period = await this.periodsService.getById(organizationId, dispatch.periodId);
    await validatePeriodOpen(period);

    // Validate at least 1 detail line
    if (!dispatch.details || dispatch.details.length === 0) {
      throw new ValidationError(
        "El despacho debe tener al menos una línea de detalle para ser contabilizado",
        DISPATCH_NO_DETAILS,
      );
    }

    // Compute totalAmount: sum raw lineAmounts, then apply roundTotal
    const exactTotal = dispatch.details.reduce(
      (sum, d) => sum + Number(d.lineAmount),
      0,
    );
    const settings = await this.orgSettingsService.getOrCreate(organizationId);
    const threshold = Number(settings.roundingThreshold);
    const totalAmount = roundTotal(exactTotal, threshold);

    // Determine income account based on dispatch type
    const incomeAccountCode =
      dispatch.dispatchType === "NOTA_DESPACHO" ? "4.1.2" : "4.1.1";

    // Get next sequence number and run all within one transaction
    await this.repo.transaction(async (tx) => {
      // 1. Assign sequence number within transaction
      const sequenceNumber = await this.repo.getNextSequenceNumber(
        tx,
        organizationId,
        dispatch.dispatchType as DispatchType,
      );

      const displayCode = getDisplayCode(dispatch.dispatchType as DispatchType, sequenceNumber);

      // 2. Update dispatch status, totalAmount, sequenceNumber
      await this.repo.updateStatusTx(
        tx,
        organizationId,
        id,
        "POSTED",
        totalAmount,
        sequenceNumber,
      );

      // 3. Build and generate journal entry
      // (settings already fetched above — reused here)
      const journalDescription = dispatch.notes
        ? `${displayCode} - ${dispatch.description} | ${dispatch.notes}`
        : `${displayCode} - ${dispatch.description}`;
      const entry = await this.autoEntryGenerator.generate(tx, {
        organizationId,
        voucherTypeCode: "CD",
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

      // 4. Apply account balance changes
      await this.balancesService.applyPost(tx, entry);

      // 5. Compute dueDate from contact paymentTermsDays
      const contact = dispatch.contact as { paymentTermsDays?: number };
      const paymentTermsDays = contact.paymentTermsDays ?? 30;
      const dueDate = new Date(
        dispatch.date.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
      );

      // 6. Create AccountsReceivable
      const receivable = await this.receivablesRepo.createTx(tx, {
        organizationId,
        contactId: dispatch.contactId,
        description: journalDescription,
        amount: totalAmount,
        dueDate,
        sourceType: "dispatch",
        sourceId: dispatch.id,
        journalEntryId: entry.id,
      });

      // 7. Link journalEntryId and receivableId back to dispatch
      await this.repo.linkJournalAndReceivable(
        tx,
        id,
        entry.id,
        receivable.id,
      );
    });

    // Re-fetch with all links populated
    const updated = await this.repo.findById(organizationId, id);
    return withDisplayCode(updated!);
  }

  // ── Void a dispatch (POSTED → VOIDED) ──

  async void(
    organizationId: string,
    id: string,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<DispatchWithDetails> {
    const dispatch = await this.getById(organizationId, id);
    const status = dispatch.status as DocumentStatus;

    // Validate lifecycle transition
    validateTransition(status, "VOIDED");

    // If LOCKED, require role + justification
    if (status === "LOCKED") {
      validateLockedEdit(status, role!, justification);
    }

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId, justification);
      await this.voidCascadeTx(tx, organizationId, dispatch, userId);
    });

    const updated = await this.repo.findById(organizationId, id);
    return withDisplayCode(updated!);
  }

  // ── Hard delete a DRAFT dispatch ──

  async hardDelete(organizationId: string, id: string): Promise<void> {
    const dispatch = await this.getById(organizationId, id);

    if (dispatch.status !== "DRAFT") {
      throw new ValidationError(
        "Solo se pueden eliminar despachos en estado BORRADOR",
        DISPATCH_NOT_DRAFT,
      );
    }

    await this.repo.hardDelete(organizationId, id);
  }

  // ── Recreate: void a POSTED dispatch and clone it to a new DRAFT ──

  /**
   * @deprecated Prefer edit-in-place via update() for POSTED dispatches.
   * This method voids and recreates, which changes document identity and
   * breaks the continuity of the accounting trail.
   * Kept for backward compatibility and exceptional cases.
   * @see update() for the preferred correction path
   */
  async recreate(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<{ voidedId: string; newDraftId: string }> {
    const dispatch = await this.getById(organizationId, id);

    if (dispatch.status !== "POSTED") {
      throw new ValidationError(
        "Solo se pueden recrear despachos en estado CONTABILIZADO",
        INVALID_STATUS_TRANSITION,
      );
    }

    const result = await this.repo.transaction(async (tx) => {
      // 1. Void cascade: status, journal entry, CxC, balances
      await this.voidCascadeTx(tx, organizationId, dispatch, userId);

      // 2. Clone to new DRAFT
      const newDraft = await this.repo.cloneToDraft(tx, organizationId, dispatch);

      return { voidedId: dispatch.id, newDraftId: newDraft.id };
    });

    return result;
  }

  // ── Internal: void cascade within a transaction ──

  private async voidCascadeTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    dispatch: DispatchWithDetails,
    userId: string,
  ): Promise<void> {
    // 0. Unlink active payment allocations before voiding
    if (dispatch.receivableId) {
      const activeAllocations = await tx.paymentAllocation.findMany({
        where: {
          receivableId: dispatch.receivableId,
          amount: { gt: 0 },
          payment: { status: { not: "VOIDED" } },
        },
      });

      if (activeAllocations.length > 0) {
        // Reverse allocation effects on CxC before voiding
        const receivable = await tx.accountsReceivable.findUnique({
          where: { id: dispatch.receivableId },
        });
        if (receivable && receivable.status !== "VOIDED") {
          const totalToReverse = activeAllocations.reduce((sum, a) => sum + Number(a.amount), 0);
          const revertedPaid = Math.max(0, Number(receivable.paid) - totalToReverse);
          const revertedBalance = Number(receivable.amount) - revertedPaid;
          const revertedStatus = computeReceivableStatus(revertedPaid, Math.max(0, revertedBalance));
          await tx.accountsReceivable.update({
            where: { id: dispatch.receivableId },
            data: {
              paid: new Prisma.Decimal(revertedPaid),
              balance: new Prisma.Decimal(Math.max(0, revertedBalance)),
              status: revertedStatus,
            },
          });
        }

        // Hard delete the allocation records
        await tx.paymentAllocation.deleteMany({
          where: {
            receivableId: dispatch.receivableId,
            payment: { status: { not: "VOIDED" } },
          },
        });
      }
    }

    // 1. Update dispatch status to VOIDED
    await this.repo.updateStatusTx(tx, organizationId, dispatch.id, "VOIDED");

    // 2. Void the linked JournalEntry
    if (dispatch.journalEntryId) {
      const journalEntry = await tx.journalEntry.findFirst({
        where: { id: dispatch.journalEntryId, organizationId },
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

        // 3. Reverse account balances
        await this.balancesService.applyVoid(tx, journalEntry as never);
      }
    }

    // 4. Void the linked AccountsReceivable
    if (dispatch.receivableId) {
      await this.receivablesRepo.voidTx(tx, dispatch.receivableId);
    }
  }
}
