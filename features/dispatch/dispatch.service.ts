import "server-only";
import {
  NotFoundError,
  ValidationError,
  DISPATCH_NO_DETAILS,
  DISPATCH_BC_FIELDS_ON_ND,
  DISPATCH_INVALID_CONTACT_TYPE,
  DISPATCH_NOT_DRAFT,
  DISPATCH_CONTACT_CHANGE_BLOCKED,
  INVALID_STATUS_TRANSITION,
} from "@/features/shared/errors";
import { setAuditContext } from "@/features/shared/audit-context";
import { withAuditTx, type WithCorrelation } from "@/features/shared/audit-tx";
import { Prisma } from "@/generated/prisma/client";
import { DispatchRepository } from "./dispatch.repository";
import type { ComputedDetail, BcSummary } from "./dispatch.repository";
import { OrgSettingsService, makeOrgSettingsService } from "@/modules/org-settings/presentation/server";
import {
  AutoEntryGenerator,
  JournalRepository,
  AccountsRepository,
  validateTransition,
  validateDraftOnly,
  validateEditable,
  validateLockedEdit,
  validatePeriodOpen,
  computeReceivableStatus,
  type DocumentStatus,
} from "@/features/accounting/server";
import { makeVoucherTypeRepository } from "@/modules/voucher-types/presentation/server";
import { ContactsService } from "@/features/contacts/server";
import { ReceivablesRepository } from "@/features/receivables/server";
import { AccountBalancesService } from "@/features/account-balances/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { DispatchType } from "@/generated/prisma/client";
import type {
  DispatchWithDetails,
  CreateDispatchInput,
  UpdateDispatchInput,
  DispatchFilters,
  DispatchDetailInput,
} from "./dispatch.types";
import { roundTotal } from "./dispatch.utils";

// ── Auxiliar: calcular código de visualización ──

function getDisplayCode(type: DispatchType, seq: number): string {
  const prefix = type === "NOTA_DESPACHO" ? "ND" : "BC";
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

// ── Auxiliar: calcular todos los campos derivados por línea de detalle ──
// lineAmount = peso bruto × unitPrice, redondeado a 2 decimales (sin redondeo personalizado por línea)

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

// ── Auxiliar: calcular resumen de cabecera BC a partir de los detalles calculados ──

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

// ── Auxiliar: agregar displayCode al resultado ──

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
    this.orgSettingsService = orgSettingsService ?? makeOrgSettingsService();
    this.contactsService = contactsService ?? new ContactsService();
    this.receivablesRepo = receivablesRepo ?? new ReceivablesRepository();
    this.balancesService = balancesService ?? new AccountBalancesService();
    this.periodsService = periodsService ?? new FiscalPeriodsService();
    this.accountsRepo = accountsRepo ?? new AccountsRepository();
    this.journalRepo = journalRepo ?? new JournalRepository();

    const voucherTypesRepo = makeVoucherTypeRepository();
    this.autoEntryGenerator =
      autoEntryGenerator ?? new AutoEntryGenerator(this.accountsRepo, voucherTypesRepo);
  }

  // ── Listar despachos ──

  async list(
    organizationId: string,
    filters?: DispatchFilters,
  ): Promise<DispatchWithDetails[]> {
    const rows = await this.repo.findAll(organizationId, filters);
    return rows.map(withDisplayCode);
  }

  // ── Obtener un despacho por ID ──

  async getById(organizationId: string, id: string): Promise<DispatchWithDetails> {
    const row = await this.repo.findById(organizationId, id);
    if (!row) throw new NotFoundError("Despacho");
    return withDisplayCode(row);
  }

  // ── Crear un despacho en DRAFT ──

  async create(
    organizationId: string,
    input: CreateDispatchInput,
  ): Promise<DispatchWithDetails> {
    // 1. Validar que el contacto exista y sea de tipo CLIENTE
    const contact = await this.contactsService.getActiveById(organizationId, input.contactId);
    if (contact.type !== "CLIENTE") {
      throw new ValidationError(
        "El contacto debe ser de tipo CLIENTE para crear un despacho",
        DISPATCH_INVALID_CONTACT_TYPE,
      );
    }

    // 2. Validar que los campos BC no se envíen en una ND
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

    // 3. Calcular todos los campos derivados por línea de detalle
    const shrinkagePct =
      input.dispatchType === "BOLETA_CERRADA" ? (input.shrinkagePct ?? 0) : 0;
    const computedDetails = computeLineAmounts(
      input.details,
      input.dispatchType,
      shrinkagePct,
    );

    // 5. Calcular resumen de cabecera BC
    let bcSummary: BcSummary | undefined;
    if (input.dispatchType === "BOLETA_CERRADA" && input.chickenCount !== undefined) {
      bcSummary = computeBcSummary(computedDetails, input.chickenCount);
    }

    // 6. Crear con sequenceNumber = 0 (provisional; el número definitivo se asigna al contabilizar)
    //    En DRAFT, sequenceNumber = 0 para que el código muestre ND-000 — se actualiza al contabilizar
    const row = await this.repo.create(
      organizationId,
      input,
      0,
      computedDetails,
      bcSummary,
    );

    return withDisplayCode(row);
  }

  // ── Crear y contabilizar un despacho en una sola transacción atómica ──

  async createAndPost(
    organizationId: string,
    input: CreateDispatchInput,
    userId: string,
  ): Promise<WithCorrelation<DispatchWithDetails>> {
    // 1. Validar que el contacto exista y sea de tipo CLIENTE
    const contact = await this.contactsService.getActiveById(organizationId, input.contactId);
    if (contact.type !== "CLIENTE") {
      throw new ValidationError(
        "El contacto debe ser de tipo CLIENTE para crear un despacho",
        DISPATCH_INVALID_CONTACT_TYPE,
      );
    }

    // 2. Validar que los campos BC no se envíen en una ND
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

    // 3. Validar que el período fiscal esté ABIERTO
    const period = await this.periodsService.getById(organizationId, input.periodId);
    await validatePeriodOpen(period);

    // 4. Calcular detalles
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

    // 5. Calcular resumen de cabecera BC
    let bcSummary: BcSummary | undefined;
    if (input.dispatchType === "BOLETA_CERRADA" && input.chickenCount !== undefined) {
      bcSummary = computeBcSummary(computedDetails, input.chickenCount);
    }

    // 6. Calcular totalAmount
    const exactTotal = computedDetails.reduce((sum, d) => sum + d.lineAmount, 0);
    const settings = (await this.orgSettingsService.getOrCreate(organizationId)).toSnapshot();
    const threshold = Number(settings.roundingThreshold);
    const totalAmount = roundTotal(exactTotal, threshold);

    const incomeAccountCode =
      input.dispatchType === "NOTA_DESPACHO" ? "4.1.2" : "4.1.1";

    // Pre-cargar los días de plazo de pago del contacto antes de la transacción
    const paymentTermsDays = (contact as { paymentTermsDays?: number }).paymentTermsDays ?? 30;

    // 7. Transacción atómica única
    let dispatchId = "";

    const { correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId },
      async (tx) => {

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
        organizationId,
        dispatch.id,
        entry.id,
        receivable.id,
      );

      return undefined;
      },
    );

    const result = await this.repo.findById(organizationId, dispatchId);
    return { ...withDisplayCode(result!), correlationId };
  }

  // ── Actualizar un despacho DRAFT (o LOCKED con justificación) ──

  async update(
    organizationId: string,
    id: string,
    input: UpdateDispatchInput,
    role?: string,
    justification?: string,
    userId?: string,
  ): Promise<WithCorrelation<DispatchWithDetails>> {
    const dispatch = await this.getById(organizationId, id);
    const status = dispatch.status as DocumentStatus;

    if (status === "LOCKED") {
      const period = await this.periodsService.getById(
        organizationId,
        dispatch.periodId,
      );
      validateLockedEdit(
        status,
        role!,
        period.status as "OPEN" | "CLOSED",
        justification,
      );
    } else {
      validateEditable(status);
    }

    // Validar el tipo del nuevo contacto si está cambiando
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

    // Validar que los campos BC no estén presentes en una ND
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

    // Recalcular lineAmounts si cambiaron los detalles
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

      // Recalcular resumen de cabecera BC si aplica
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

    // Para despachos POSTED, ejecutar el flujo atómico de reversión-modificación-reaplicación
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

    // Para ediciones LOCKED, envolver en transacción con contexto de auditoría
    if (status === "LOCKED") {
      const { result, correlationId } = await withAuditTx(
        this.repo,
        { userId: dispatch.createdById ?? "unknown", organizationId, justification },
        async (tx) => this.repo.updateTx(
          tx,
          organizationId,
          id,
          dataWithoutDetails,
          computedDetails,
          bcSummary,
        ),
      );
      return { ...withDisplayCode(result), correlationId };
    }

    // DRAFT branch — wrapped in withAuditTx so audit_logs rows share the same
    // correlationId that is returned to the caller (REQ-CORR.2 / INV-2).
    const { result: row, correlationId } = await withAuditTx(
      this.repo,
      { userId: userId ?? "unknown", organizationId },
      async (tx) => this.repo.updateTx(
        tx,
        organizationId,
        id,
        dataWithoutDetails,
        computedDetails,
        bcSummary,
      ),
    );
    return { ...withDisplayCode(row), correlationId };
  }

  // ── Actualizar un despacho POSTED (reversión-modificación-reaplicación atómica) ──

  private async updatePostedDispatchTx(
    organizationId: string,
    dispatch: DispatchWithDetails,
    input: UpdateDispatchInput,
    computedDetails: ComputedDetail[] | undefined,
    bcSummary: BcSummary | undefined,
    userId: string,
  ): Promise<WithCorrelation<DispatchWithDetails>> {
    // 1. Validar que haya al menos 1 línea de detalle si se están cambiando los detalles
    if (computedDetails !== undefined && computedDetails.length === 0) {
      throw new ValidationError(
        "El despacho debe tener al menos una línea de detalle para ser contabilizado",
        DISPATCH_NO_DETAILS,
      );
    }

    // 2. Pre-cargar configuración y calcular newTotalAmount si cambiaron los detalles
    const settings = (await this.orgSettingsService.getOrCreate(organizationId)).toSnapshot();
    let newTotalAmount: number | undefined;
    if (computedDetails !== undefined) {
      const threshold = Number(settings.roundingThreshold);
      const exactTotal = computedDetails.reduce((sum, d) => sum + d.lineAmount, 0);
      newTotalAmount = roundTotal(exactTotal, threshold);
    }

    // 3. Pre-validar cambio de contacto: bloquear si la CxC tiene asignaciones de pago activas
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

    // 4. Resolver IDs de cuentas antes de la transacción
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

    // 5. Ejecutar transacción atómica
    const { correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId },
      async (tx) => {

      // b. Revertir saldos del asiento contable anterior
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

      // c. Actualizar campos y detalles del despacho
      await this.repo.updateTx(
        tx,
        organizationId,
        dispatch.id,
        dataWithoutDetails,
        computedDetails,
        bcSummary,
      );

      // d. Si cambió totalAmount, actualizarlo en el registro del despacho
      if (newTotalAmount !== undefined) {
        await this.repo.updateStatusTx(
          tx,
          organizationId,
          dispatch.id,
          "POSTED",
          newTotalAmount,
        );
      }

      // e. Construir nuevas líneas del asiento contable
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

      // f. Actualizar el asiento contable
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

      // g. Aplicar nuevos saldos
      await this.balancesService.applyPost(tx, updatedEntry);

      // h. Actualizar CxC: monto, saldo, estado
      // Si el nuevo monto es menor al pagado, limitar pagado al nuevo monto y reducir asignaciones LIFO
      if (dispatch.receivableId) {
        const existingReceivable = await tx.accountsReceivable.findFirst({
          where: { id: dispatch.receivableId },
          select: { paid: true },
        });
        const rawPaid = existingReceivable ? Number(existingReceivable.paid) : 0;
        const cappedPaid = Math.min(rawPaid, effectiveTotalAmount);
        const newBalance = effectiveTotalAmount - cappedPaid;
        const newStatus = computeReceivableStatus(cappedPaid, newBalance);

        // Si lo pagado supera el nuevo monto, reducir las asignaciones de pago en orden LIFO
        if (rawPaid > effectiveTotalAmount) {
          const allocations = await tx.paymentAllocation.findMany({
            where: {
              receivableId: dispatch.receivableId,
              payment: { status: { not: "VOIDED" } },
            },
            orderBy: { id: "desc" }, // LIFO — reducir primero las más nuevas (cuid es ordenable por tiempo)
          });

          let excess = rawPaid - effectiveTotalAmount;
          for (const alloc of allocations) {
            if (excess <= 0) break;
            const allocAmount = Number(alloc.amount);
            const reduction = Math.min(allocAmount, excess);
            const newAllocAmount = allocAmount - reduction;

            if (newAllocAmount <= 0) {
              // Eliminar la asignación por completo
              await tx.paymentAllocation.delete({ where: { id: alloc.id } });
            } else {
              // Reducir el monto de la asignación
              await tx.paymentAllocation.update({
                where: { id: alloc.id },
                data: { amount: new Prisma.Decimal(newAllocAmount) },
              });
            }
            excess -= reduction;
          }
        }

        await tx.accountsReceivable.update({
          where: { id: dispatch.receivableId },
          data: {
            amount: new Prisma.Decimal(effectiveTotalAmount),
            paid: new Prisma.Decimal(cappedPaid),
            balance: new Prisma.Decimal(newBalance),
            status: newStatus,
            ...(input.contactId !== undefined && { contactId: input.contactId }),
          },
        });
      }

      return undefined;
      },
    );

    const updated = await this.repo.findById(organizationId, dispatch.id);
    return { ...withDisplayCode(updated!), correlationId };
  }

  // ── Eliminar un despacho DRAFT ──

  async delete(organizationId: string, id: string): Promise<void> {
    const dispatch = await this.getById(organizationId, id);
    validateDraftOnly(dispatch.status as DocumentStatus);
    await this.repo.delete(organizationId, id);
  }

  // ── Contabilizar un despacho (DRAFT → POSTED) ──

  async post(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<WithCorrelation<DispatchWithDetails>> {
    const dispatch = await this.getById(organizationId, id);

    // Validar la transición del ciclo de vida
    validateTransition(
      dispatch.status as DocumentStatus,
      "POSTED",
    );

    // Validar que el período fiscal esté ABIERTO
    const period = await this.periodsService.getById(organizationId, dispatch.periodId);
    await validatePeriodOpen(period);

    // Validar que haya al menos 1 línea de detalle
    if (!dispatch.details || dispatch.details.length === 0) {
      throw new ValidationError(
        "El despacho debe tener al menos una línea de detalle para ser contabilizado",
        DISPATCH_NO_DETAILS,
      );
    }

    // Calcular totalAmount: sumar los lineAmounts brutos y aplicar roundTotal
    const exactTotal = dispatch.details.reduce(
      (sum, d) => sum + Number(d.lineAmount),
      0,
    );
    const settings = (await this.orgSettingsService.getOrCreate(organizationId)).toSnapshot();
    const threshold = Number(settings.roundingThreshold);
    const totalAmount = roundTotal(exactTotal, threshold);

    // Determinar la cuenta de ingresos según el tipo de despacho
    const incomeAccountCode =
      dispatch.dispatchType === "NOTA_DESPACHO" ? "4.1.2" : "4.1.1";

    // Obtener el siguiente número de secuencia y ejecutar todo dentro de una sola transacción
    const { correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId },
      async (tx) => {
      // 1. Asignar número de secuencia dentro de la transacción
      const sequenceNumber = await this.repo.getNextSequenceNumber(
        tx,
        organizationId,
        dispatch.dispatchType as DispatchType,
      );

      const displayCode = getDisplayCode(dispatch.dispatchType as DispatchType, sequenceNumber);

      // 2. Actualizar estado del despacho, totalAmount y sequenceNumber
      await this.repo.updateStatusTx(
        tx,
        organizationId,
        id,
        "POSTED",
        totalAmount,
        sequenceNumber,
      );

      // 3. Construir y generar el asiento contable
      // (configuración ya obtenida arriba — se reutiliza aquí)
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

      // 4. Aplicar cambios en saldos de cuentas
      await this.balancesService.applyPost(tx, entry);

      // 5. Calcular dueDate a partir de paymentTermsDays del contacto
      const contact = dispatch.contact as { paymentTermsDays?: number };
      const paymentTermsDays = contact.paymentTermsDays ?? 30;
      const dueDate = new Date(
        dispatch.date.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
      );

      // 6. Crear AccountsReceivable
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

      // 7. Vincular journalEntryId y receivableId de vuelta al despacho
      await this.repo.linkJournalAndReceivable(
        tx,
        organizationId,
        id,
        entry.id,
        receivable.id,
      );

      return undefined;
      },
    );

    // Volver a buscar con todos los vínculos cargados
    const updated = await this.repo.findById(organizationId, id);
    return { ...withDisplayCode(updated!), correlationId };
  }

  // ── Anular un despacho (POSTED → VOIDED) ──

  async void(
    organizationId: string,
    id: string,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<WithCorrelation<DispatchWithDetails>> {
    const dispatch = await this.getById(organizationId, id);
    const status = dispatch.status as DocumentStatus;

    // Validar la transición del ciclo de vida
    validateTransition(status, "VOIDED");

    // Si está LOCKED, requerir rol y justificación
    if (status === "LOCKED") {
      const period = await this.periodsService.getById(
        organizationId,
        dispatch.periodId,
      );
      validateLockedEdit(
        status,
        role!,
        period.status as "OPEN" | "CLOSED",
        justification,
      );
    }

    const { correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId, justification },
      async (tx) => {
        await this.voidCascadeTx(tx, organizationId, dispatch, userId);
        return undefined;
      },
    );

    const updated = await this.repo.findById(organizationId, id);
    return { ...withDisplayCode(updated!), correlationId };
  }

  // ── Eliminación definitiva de un despacho DRAFT ──

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

  // ── Recrear: anular un despacho POSTED y clonarlo a un nuevo DRAFT ──

  /**
   * @deprecated Preferir edición en el lugar mediante update() para despachos POSTED.
   * Este método anula y recrea, lo que cambia la identidad del documento y
   * rompe la continuidad del rastro contable.
   * Mantenido por compatibilidad y casos excepcionales.
   * @see update() para la ruta de corrección preferida
   */
  async recreate(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<WithCorrelation<{ voidedId: string; newDraftId: string }>> {
    const dispatch = await this.getById(organizationId, id);

    if (dispatch.status !== "POSTED") {
      throw new ValidationError(
        "Solo se pueden recrear despachos en estado CONTABILIZADO",
        INVALID_STATUS_TRANSITION,
      );
    }

    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId },
      async (tx) => {
        // 1. Cascade de anulación: estado, asiento contable, CxC, saldos
        await this.voidCascadeTx(tx, organizationId, dispatch, userId);

        // 2. Clonar a nuevo DRAFT
        const newDraft = await this.repo.cloneToDraft(tx, organizationId, dispatch);

        return { voidedId: dispatch.id, newDraftId: newDraft.id };
      },
    );

    return { ...result, correlationId };
  }

  // ── Interno: cascade de anulación dentro de una transacción ──

  private async voidCascadeTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    dispatch: DispatchWithDetails,
    userId: string,
  ): Promise<void> {
    // 0. Desvincular asignaciones de pago activas antes de anular
    if (dispatch.receivableId) {
      const activeAllocations = await tx.paymentAllocation.findMany({
        where: {
          receivableId: dispatch.receivableId,
          amount: { gt: 0 },
          payment: { status: { not: "VOIDED" } },
        },
      });

      if (activeAllocations.length > 0) {
        // Revertir efectos de las asignaciones en la CxC antes de anular
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

        // Eliminar definitivamente los registros de asignación
        await tx.paymentAllocation.deleteMany({
          where: {
            receivableId: dispatch.receivableId,
            payment: { status: { not: "VOIDED" } },
          },
        });
      }
    }

    // 1. Actualizar el estado del despacho a VOIDED
    await this.repo.updateStatusTx(tx, organizationId, dispatch.id, "VOIDED");

    // 2. Anular el JournalEntry vinculado
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

        // 3. Revertir saldos de cuentas
        await this.balancesService.applyVoid(tx, journalEntry as never);
      }
    }

    // 4. Anular el AccountsReceivable vinculado
    if (dispatch.receivableId) {
      await this.receivablesRepo.voidTx(tx, organizationId, dispatch.receivableId);
    }
  }
}
