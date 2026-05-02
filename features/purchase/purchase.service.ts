import "server-only";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  POST_NOT_ALLOWED_FOR_ROLE,
  PURCHASE_NO_DETAILS,
  PURCHASE_INVALID_CONTACT_TYPE,
  PURCHASE_NOT_DRAFT,
  PURCHASE_CONTACT_CHANGE_BLOCKED,
  PURCHASE_EXPENSE_ACCOUNT_REQUIRED,
} from "@/features/shared/errors";
import { canPost } from "@/features/permissions/server";
import { setAuditContext } from "@/features/shared/audit-context";
import { withAuditTx, assertAuditContextSet, type WithCorrelation } from "@/features/shared/audit-tx";
import { Prisma } from "@/generated/prisma/client";
import { PurchaseRepository } from "./purchase.repository";
import type { ComputedPurchaseDetail, PfSummary } from "./purchase.repository";
import { OrgSettingsService } from "@/features/org-settings/server";
import {
  AutoEntryGenerator,
  JournalRepository,
  AccountsRepository,
  validateTransition,
  validateEditable,
  validateLockedEdit,
  validatePeriodOpen,
  computePayableStatus,
  type DocumentStatus,
  type TrimPreviewItem,
} from "@/features/accounting/server";
import { VoucherTypesRepository } from "@/features/voucher-types/server";
import { ContactsService } from "@/features/contacts/server";
import { PayablesRepository } from "@/features/payables/server";
import { AccountBalancesService } from "@/features/account-balances/server";
import { FiscalPeriodsService } from "@/features/fiscal-periods/server";
import type { PurchaseType } from "@/generated/prisma/client";
import type {
  PurchaseWithDetails,
  CreatePurchaseInput,
  UpdatePurchaseInput,
  PurchaseFilters,
  CreatePurchaseDetailInput,
} from "./purchase.types";
import {
  getDisplayCode,
  buildPurchaseEntryLines,
  type PurchaseOrgSettings,
  type IvaBookForEntry,
} from "./purchase.utils";
import { calcTotales } from "@/features/accounting/iva-books";

// ── Auxiliar: computar plan de recorte LIFO (sin DB, sin efectos) ─────────────

/**
 * Dado un array de asignaciones ordenado LIFO (id desc) y el exceso a absorber,
 * retorna qué asignaciones se recortarían y a qué monto.
 * Sólo incluye en el resultado las asignaciones que serían modificadas.
 */
function computeTrimPlan(
  allocations: Array<{
    id: string;
    amount: { toString(): string } | number;
    payment: { date: Date };
  }>,
  excess: number,
): TrimPreviewItem[] {
  const plan: TrimPreviewItem[] = [];
  let remaining = excess;

  for (const alloc of allocations) {
    if (remaining <= 0) break;
    const allocAmount = Number(alloc.amount);
    const reduction = Math.min(allocAmount, remaining);
    const newAllocAmount = allocAmount - reduction;

    plan.push({
      allocationId: alloc.id,
      paymentDate: alloc.payment.date.toISOString().split("T")[0],
      originalAmount: allocAmount.toFixed(2),
      trimmedTo: newAllocAmount.toFixed(2),
    });

    remaining -= reduction;
  }

  return plan;
}

// ── Auxiliar: calcular todos los campos derivados por línea de detalle POLLO_FAENADO ──

function computePfDetails(
  details: CreatePurchaseDetailInput[],
  shrinkagePct: number,
): ComputedPurchaseDetail[] {
  return details.map((d, i) => {
    const boxes = d.boxes ?? 0;
    const tare = boxes * 2;
    const grossWeight = d.grossWeight ?? 0;
    const netWeight = grossWeight - tare;
    const shrinkage = netWeight * (shrinkagePct / 100);
    const shortage = d.shortage ?? 0;
    const realNetWeight = netWeight - shrinkage - shortage;
    const unitPrice = d.unitPrice ?? 0;
    const lineAmount = Math.round(realNetWeight * unitPrice * 100) / 100;

    return {
      description: d.description,
      lineAmount,
      order: d.order ?? i,
      productTypeId: d.productTypeId,
      detailNote: d.detailNote,
      boxes,
      grossWeight,
      tare,
      netWeight,
      unitPrice,
      shrinkage,
      shortage,
      realNetWeight,
    };
  });
}

// ── Auxiliar: calcular el resumen de cabecera POLLO_FAENADO a partir de los detalles calculados ──

function computePfSummary(
  computedDetails: ComputedPurchaseDetail[],
): PfSummary {
  const totalGrossKg = computedDetails.reduce(
    (s, d) => s + (d.grossWeight ?? 0),
    0,
  );
  const totalNetKg = computedDetails.reduce(
    (s, d) => s + (d.netWeight ?? 0),
    0,
  );
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
  return { totalGrossKg, totalNetKg, totalShrinkKg, totalShortageKg, totalRealNetKg };
}

// ── Auxiliar: calcular los montos de línea de detalle FLETE ──

function computeFleteDetails(
  details: CreatePurchaseDetailInput[],
): ComputedPurchaseDetail[] {
  return details.map((d, i) => {
    const chickenQty = d.chickenQty ?? 0;
    const pricePerChicken = d.pricePerChicken ?? 0;
    const lineAmount = Math.round(chickenQty * pricePerChicken * 100) / 100;
    return {
      description: d.description,
      lineAmount,
      order: d.order ?? i,
      fecha: d.fecha,
      docRef: d.docRef,
      chickenQty,
      pricePerChicken,
    };
  });
}

// ── Auxiliar: calcular los montos de línea de detalle COMPRA_GENERAL / SERVICIO ──

function computeGeneralDetails(
  details: CreatePurchaseDetailInput[],
): ComputedPurchaseDetail[] {
  return details.map((d, i) => {
    const quantity = d.quantity ?? 1;
    const unitPrice = d.unitPrice ?? 0;
    // lineAmount puede venir pre-suministrado o calcularse a partir de quantity × unitPrice
    const lineAmount = d.lineAmount !== undefined
      ? d.lineAmount
      : Math.round(quantity * unitPrice * 100) / 100;
    return {
      description: d.description,
      lineAmount,
      order: d.order ?? i,
      quantity,
      expenseAccountId: d.expenseAccountId,
    };
  });
}

// ── Auxiliar: calcular detalles según el tipo de compra ──

function computeDetails(
  purchaseType: PurchaseType,
  details: CreatePurchaseDetailInput[],
  shrinkagePct: number,
): ComputedPurchaseDetail[] {
  if (purchaseType === "POLLO_FAENADO") {
    return computePfDetails(details, shrinkagePct);
  }
  if (purchaseType === "FLETE") {
    return computeFleteDetails(details);
  }
  return computeGeneralDetails(details);
}

// ── Auxiliar: extraer IvaBookForEntry de un IvaPurchaseBookDTO activo ──

function extractIvaBookForEntry(purchase: PurchaseWithDetails): IvaBookForEntry | undefined {
  const iva = purchase.ivaPurchaseBook;
  if (!iva || iva.status !== "ACTIVE") return undefined;
  return {
    baseIvaSujetoCf: Number(iva.baseIvaSujetoCf),
    dfCfIva: Number(iva.dfCfIva),
    importeTotal: Number(iva.importeTotal),
    exentos: Number(iva.exentos ?? 0),
  };
}

// ── Auxiliar: agregar displayCode al resultado ──

function withDisplayCode(purchase: PurchaseWithDetails): PurchaseWithDetails {
  return {
    ...purchase,
    displayCode: getDisplayCode(
      purchase.purchaseType as PurchaseType,
      purchase.sequenceNumber,
    ),
  };
}

export class PurchaseService {
  private readonly repo: PurchaseRepository;
  private readonly orgSettingsService: OrgSettingsService;
  private readonly autoEntryGenerator: AutoEntryGenerator;
  private readonly contactsService: ContactsService;
  private readonly payablesRepo: PayablesRepository;
  private readonly balancesService: AccountBalancesService;
  private readonly periodsService: FiscalPeriodsService;
  private readonly accountsRepo: AccountsRepository;
  private readonly journalRepo: JournalRepository;

  constructor(
    repo?: PurchaseRepository,
    orgSettingsService?: OrgSettingsService,
    autoEntryGenerator?: AutoEntryGenerator,
    contactsService?: ContactsService,
    payablesRepo?: PayablesRepository,
    balancesService?: AccountBalancesService,
    periodsService?: FiscalPeriodsService,
    accountsRepo?: AccountsRepository,
    journalRepo?: JournalRepository,
  ) {
    this.repo = repo ?? new PurchaseRepository();
    this.orgSettingsService = orgSettingsService ?? new OrgSettingsService();
    this.contactsService = contactsService ?? new ContactsService();
    this.payablesRepo = payablesRepo ?? new PayablesRepository();
    this.balancesService = balancesService ?? new AccountBalancesService();
    this.periodsService = periodsService ?? new FiscalPeriodsService();
    this.accountsRepo = accountsRepo ?? new AccountsRepository();
    this.journalRepo = journalRepo ?? new JournalRepository();

    const voucherTypesRepo = new VoucherTypesRepository();
    this.autoEntryGenerator =
      autoEntryGenerator ?? new AutoEntryGenerator(this.accountsRepo, voucherTypesRepo);
  }

  // ── Listar compras ──

  async list(
    organizationId: string,
    filters?: PurchaseFilters,
  ): Promise<PurchaseWithDetails[]> {
    const rows = await this.repo.findAll(organizationId, filters);
    return rows.map(withDisplayCode);
  }

  // ── Obtener una compra individual ──

  async getById(
    organizationId: string,
    id: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PurchaseWithDetails> {
    const row = await this.repo.findById(organizationId, id, tx);
    if (!row) throw new NotFoundError("Compra");
    return withDisplayCode(row);
  }

  // ── Crear una compra en DRAFT ──

  async createDraft(
    organizationId: string,
    input: CreatePurchaseInput,
    userId: string,
  ): Promise<PurchaseWithDetails> {
    // 1. Validar que el contacto sea PROVEEDOR
    const contact = await this.contactsService.getActiveById(organizationId, input.contactId);
    if (contact.type !== "PROVEEDOR") {
      throw new ValidationError(
        "El contacto debe ser de tipo PROVEEDOR para crear una compra",
        PURCHASE_INVALID_CONTACT_TYPE,
      );
    }

    // 2. Validar que COMPRA_GENERAL/SERVICIO tengan expenseAccountId en cada detalle
    if (
      input.purchaseType === "COMPRA_GENERAL" ||
      input.purchaseType === "SERVICIO"
    ) {
      for (const d of input.details) {
        if (!d.expenseAccountId) {
          throw new ValidationError(
            "Cada línea de detalle debe tener una cuenta de gasto asociada",
            PURCHASE_EXPENSE_ACCOUNT_REQUIRED,
          );
        }
      }
    }

    // 3. Calcular detalles
    const shrinkagePct =
      input.purchaseType === "POLLO_FAENADO" ? (input.shrinkagePct ?? 0) : 0;
    const computedDetails = computeDetails(
      input.purchaseType,
      input.details,
      shrinkagePct,
    );

    // 4. Calcular el resumen de cabecera PF si corresponde
    let pfSummary: PfSummary | undefined;
    if (input.purchaseType === "POLLO_FAENADO") {
      pfSummary = computePfSummary(computedDetails);
    }

    const row = await this.repo.create(
      organizationId,
      input,
      userId,
      computedDetails,
      pfSummary,
    );

    return withDisplayCode(row);
  }

  // ── Contabilizar una compra (DRAFT → POSTED) ──

  async post(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<WithCorrelation<PurchaseWithDetails>> {
    const purchase = await this.getById(organizationId, id);

    // Validar la transición del ciclo de vida
    validateTransition(purchase.status as DocumentStatus, "POSTED");

    // Validar que el período fiscal esté ABIERTO
    const period = await this.periodsService.getById(organizationId, purchase.periodId);
    await validatePeriodOpen(period);

    // Validar que haya al menos 1 línea de detalle
    if (!purchase.details || purchase.details.length === 0) {
      throw new ValidationError(
        "La compra debe tener al menos una línea de detalle para ser contabilizada",
        PURCHASE_NO_DETAILS,
      );
    }

    // Calcular el totalAmount
    const totalAmount = purchase.details.reduce(
      (sum, d) => sum + Number(d.lineAmount),
      0,
    );

    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    // Para COMPRA_GENERAL/SERVICIO, resolver los códigos de cuenta de gasto a partir de los IDs
    const detailsForEntry = await this.resolveDetailAccountCodes(
      organizationId,
      purchase.purchaseType as PurchaseType,
      purchase.details as unknown as Array<{ lineAmount: number; expenseAccountId?: string | null; description: string }>,
    );

    // Task 4.7: pasar ivaBook cuando hay un IvaPurchaseBook ACTIVE vinculado
    const ivaBookForEntry = extractIvaBookForEntry(purchase);

    const entryLines = buildPurchaseEntryLines(
      purchase.purchaseType as PurchaseType,
      totalAmount,
      detailsForEntry,
      settings as unknown as PurchaseOrgSettings,
      purchase.contactId,
      ivaBookForEntry,
    );

    const contact = purchase.contact;
    const paymentTermsDays = contact.paymentTermsDays ?? 30;

    let purchaseId = "";

    const { correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId },
      async (tx) => {
      const sequenceNumber = await this.repo.getNextSequenceNumber(
        tx,
        organizationId,
        purchase.purchaseType as PurchaseType,
      );

      const displayCode = getDisplayCode(
        purchase.purchaseType as PurchaseType,
        sequenceNumber,
      );
      purchaseId = purchase.id;

      // Actualizar el estado, totalAmount y sequenceNumber de la compra
      await this.repo.updateStatusTx(
        tx,
        organizationId,
        id,
        "POSTED",
        totalAmount,
        sequenceNumber,
      );

      const journalDescription = purchase.notes
        ? `${displayCode} - ${purchase.description} | ${purchase.notes}`
        : `${displayCode} - ${purchase.description}`;

      // Construir y generar el asiento contable
      const entry = await this.autoEntryGenerator.generate(tx, {
        organizationId,
        voucherTypeCode: "CE",
        contactId: purchase.contactId,
        date: purchase.date,
        periodId: purchase.periodId,
        description: journalDescription,
        sourceType: "purchase",
        sourceId: purchase.id,
        createdById: userId,
        lines: entryLines.map((l) => ({
          accountCode: l.accountCode,
          side: l.debit > 0 ? ("DEBIT" as const) : ("CREDIT" as const),
          amount: l.debit > 0 ? l.debit : l.credit,
          contactId: l.contactId,
          description: l.description,
        })),
      });

      await this.balancesService.applyPost(tx, entry);

      const dueDate = new Date(
        purchase.date.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
      );

      const payable = await this.payablesRepo.createTx(tx, {
        organizationId,
        contactId: purchase.contactId,
        description: journalDescription,
        amount: totalAmount,
        dueDate,
        sourceType: "purchase",
        sourceId: purchase.id,
        journalEntryId: entry.id,
      });

      await this.repo.linkJournalAndPayable(tx, organizationId, purchase.id, entry.id, payable.id);
      return undefined;
      },
    );

    const result = await this.repo.findById(organizationId, purchaseId);
    return { ...withDisplayCode(result!), correlationId };
  }

  // ── Crear y contabilizar una compra en una sola transacción atómica ──

  async createAndPost(
    organizationId: string,
    input: CreatePurchaseInput,
    context: { userId: string; role: string },
  ): Promise<WithCorrelation<PurchaseWithDetails>> {
    // 0. RBAC: canPost (PR3.2 / P.6 / D.7) — matrix-backed async check
    if (!(await canPost(context.role, "purchases", organizationId))) {
      throw new ForbiddenError(
        "Tu rol no tiene permiso para contabilizar compras",
        POST_NOT_ALLOWED_FOR_ROLE,
      );
    }
    const { userId } = context;

    // 1. Validar que el contacto sea PROVEEDOR
    const contact = await this.contactsService.getActiveById(organizationId, input.contactId);
    if (contact.type !== "PROVEEDOR") {
      throw new ValidationError(
        "El contacto debe ser de tipo PROVEEDOR para crear una compra",
        PURCHASE_INVALID_CONTACT_TYPE,
      );
    }

    // 2. Validar que COMPRA_GENERAL/SERVICIO tengan expenseAccountId en cada detalle
    if (
      input.purchaseType === "COMPRA_GENERAL" ||
      input.purchaseType === "SERVICIO"
    ) {
      for (const d of input.details) {
        if (!d.expenseAccountId) {
          throw new ValidationError(
            "Cada línea de detalle debe tener una cuenta de gasto asociada",
            PURCHASE_EXPENSE_ACCOUNT_REQUIRED,
          );
        }
      }
    }

    // 3. Validar que el período fiscal esté ABIERTO
    const period = await this.periodsService.getById(organizationId, input.periodId);
    await validatePeriodOpen(period);

    // 4. Calcular detalles
    const shrinkagePct =
      input.purchaseType === "POLLO_FAENADO" ? (input.shrinkagePct ?? 0) : 0;
    const computedDetails = computeDetails(
      input.purchaseType,
      input.details,
      shrinkagePct,
    );

    if (computedDetails.length === 0) {
      throw new ValidationError(
        "La compra debe tener al menos una línea de detalle para ser contabilizada",
        PURCHASE_NO_DETAILS,
      );
    }

    // 5. Calcular el resumen PF
    let pfSummary: PfSummary | undefined;
    if (input.purchaseType === "POLLO_FAENADO") {
      pfSummary = computePfSummary(computedDetails);
    }

    // 6. Calcular el totalAmount
    const totalAmount = computedDetails.reduce((sum, d) => sum + d.lineAmount, 0);

    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    // 7. Para COMPRA_GENERAL/SERVICIO, resolver los códigos de cuentas de gasto
    const detailsForEntry = await this.resolveComputedDetailAccountCodes(
      organizationId,
      input.purchaseType,
      computedDetails,
    );

    const entryLines = buildPurchaseEntryLines(
      input.purchaseType,
      totalAmount,
      detailsForEntry,
      settings as unknown as PurchaseOrgSettings,
      input.contactId,
    );

    const paymentTermsDays =
      (contact as { paymentTermsDays?: number }).paymentTermsDays ?? 30;

    let purchaseId = "";

    const { correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId },
      async (tx) => {
      const sequenceNumber = await this.repo.getNextSequenceNumber(
        tx,
        organizationId,
        input.purchaseType,
      );

      const purchase = await this.repo.createPostedTx(
        tx,
        organizationId,
        input,
        userId,
        sequenceNumber,
        computedDetails,
        totalAmount,
        pfSummary,
      );
      purchaseId = purchase.id;

      const displayCode = getDisplayCode(input.purchaseType, sequenceNumber);

      const journalDescription = input.notes
        ? `${displayCode} - ${input.description} | ${input.notes}`
        : `${displayCode} - ${input.description}`;

      const entry = await this.autoEntryGenerator.generate(tx, {
        organizationId,
        voucherTypeCode: "CE",
        contactId: input.contactId,
        date: new Date(input.date),
        periodId: input.periodId,
        description: journalDescription,
        sourceType: "purchase",
        sourceId: purchase.id,
        createdById: userId,
        lines: entryLines.map((l) => ({
          accountCode: l.accountCode,
          side: l.debit > 0 ? ("DEBIT" as const) : ("CREDIT" as const),
          amount: l.debit > 0 ? l.debit : l.credit,
          contactId: l.contactId,
          description: l.description,
        })),
      });

      await this.balancesService.applyPost(tx, entry);

      const dueDate = new Date(
        new Date(input.date).getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
      );

      const payable = await this.payablesRepo.createTx(tx, {
        organizationId,
        contactId: input.contactId,
        description: journalDescription,
        amount: totalAmount,
        dueDate,
        sourceType: "purchase",
        sourceId: purchase.id,
        journalEntryId: entry.id,
      });

      await this.repo.linkJournalAndPayable(tx, organizationId, purchase.id, entry.id, payable.id);
      return undefined;
      },
    );

    const result = await this.repo.findById(organizationId, purchaseId);
    return { ...withDisplayCode(result!), correlationId };
  }

  // ── Actualizar una compra (DRAFT directamente, POSTED mediante editPosted) ──

  async update(
    organizationId: string,
    id: string,
    input: UpdatePurchaseInput,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<WithCorrelation<PurchaseWithDetails>> {
    const purchase = await this.getById(organizationId, id);
    const status = purchase.status as DocumentStatus;

    if (status === "LOCKED") {
      const period = await this.periodsService.getById(organizationId, purchase.periodId);
      validateLockedEdit(
        status,
        role!,
        period.status as "OPEN" | "CLOSED",
        justification,
      );
    } else {
      validateEditable(status);
    }

    // Validar el nuevo tipo de contacto si se está cambiando
    if (input.contactId !== undefined) {
      const contact = await this.contactsService.getActiveById(
        organizationId,
        input.contactId,
      );
      if (contact.type !== "PROVEEDOR") {
        throw new ValidationError(
          "El contacto debe ser de tipo PROVEEDOR",
          PURCHASE_INVALID_CONTACT_TYPE,
        );
      }
    }

    // Recalcular detalles si cambiaron
    let computedDetails: ComputedPurchaseDetail[] | undefined;
    let pfSummary: PfSummary | undefined;

    if (input.details !== undefined) {
      const shrinkagePct =
        purchase.purchaseType === "POLLO_FAENADO"
          ? (input.shrinkagePct ??
              (purchase.shrinkagePct !== null ? Number(purchase.shrinkagePct) : 0))
          : 0;

      computedDetails = computeDetails(
        purchase.purchaseType as PurchaseType,
        input.details,
        shrinkagePct,
      );

      if (purchase.purchaseType === "POLLO_FAENADO") {
        pfSummary = computePfSummary(computedDetails);
      }
    }

    const { details: _details, ...dataWithoutDetails } = input;

    // Para compras POSTED, ejecutar el flujo atómico de revertir-modificar-reaplicar
    if (status === "POSTED") {
      const period = await this.periodsService.getById(organizationId, purchase.periodId);
      await validatePeriodOpen(period);
      return this.editPosted(organizationId, purchase, input, computedDetails, pfSummary, userId);
    }

    // Para ediciones en LOCKED, envolver en transacción con contexto de auditoría
    if (status === "LOCKED") {
      const { result: row, correlationId } = await withAuditTx(
        this.repo,
        { userId: purchase.createdById ?? "unknown", organizationId, justification },
        async (tx) => this.repo.updateTx(
          tx,
          organizationId,
          id,
          dataWithoutDetails,
          computedDetails,
          pfSummary,
        ),
      );
      return { ...withDisplayCode(row), correlationId };
    }

    // DRAFT branch — wrapped in withAuditTx so audit_logs rows share the same
    // correlationId that is returned to the caller (REQ-CORR.2 / INV-2).
    const { result: row, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId },
      async (tx) => this.repo.updateTx(
        tx,
        organizationId,
        id,
        dataWithoutDetails,
        computedDetails,
        pfSummary,
      ),
    );
    return { ...withDisplayCode(row), correlationId };
  }

  // ── Preview de recorte de asignaciones (dryRun / pre-flight) ────────────────

  /**
   * Calcula qué asignaciones de pago serían recortadas (LIFO) si la compra
   * se editara a `newTotal`. No ejecuta ninguna escritura.
   *
   * REQ-11 — mirror de SaleService.getEditPreview (D3/D5)
   */
  async getEditPreview(
    purchaseId: string,
    organizationId: string,
    newTotal: number,
  ): Promise<{ trimPreview: TrimPreviewItem[] }> {
    const purchase = await this.getById(organizationId, purchaseId);
    if (!purchase.payableId) {
      return { trimPreview: [] };
    }

    const trimPreview = await this.repo.transaction(async (tx) => {
      const payable = await tx.accountsPayable.findFirst({
        where: { id: purchase.payableId! },
        select: { paid: true },
      });
      const rawPaid = payable ? Number(payable.paid) : 0;

      if (newTotal >= rawPaid) {
        return [];
      }

      const allocations = await tx.paymentAllocation.findMany({
        where: {
          payableId: purchase.payableId!,
          payment: { status: { not: "VOIDED" } },
        },
        orderBy: { id: "desc" },
        include: { payment: { select: { date: true } } },
      });

      return computeTrimPlan(allocations, rawPaid - newTotal);
    });

    return { trimPreview };
  }

  // ── Editar una compra POSTED (revertir-modificar-reaplicar de forma atómica) ──

  private async editPosted(
    organizationId: string,
    purchase: PurchaseWithDetails,
    input: UpdatePurchaseInput,
    computedDetails: ComputedPurchaseDetail[] | undefined,
    pfSummary: PfSummary | undefined,
    userId: string,
  ): Promise<WithCorrelation<PurchaseWithDetails>> {
    // 1. Validar que haya al menos 1 línea de detalle si los detalles están cambiando
    if (computedDetails !== undefined && computedDetails.length === 0) {
      throw new ValidationError(
        "La compra debe tener al menos una línea de detalle para ser contabilizada",
        PURCHASE_NO_DETAILS,
      );
    }

    // 2. Pre-calcular el nuevo total si los detalles cambiaron
    const settings = await this.orgSettingsService.getOrCreate(organizationId);
    let newTotalAmount: number | undefined;
    if (computedDetails !== undefined) {
      newTotalAmount = computedDetails.reduce((sum, d) => sum + d.lineAmount, 0);
    }

    // 3. Pre-validar cambio de contacto: bloquear si la CxP tiene asignaciones de pago activas
    if (input.contactId !== undefined && input.contactId !== purchase.contactId) {
      if (purchase.payableId) {
        const allocations = await this.repo.transaction(async (tx) => {
          return tx.paymentAllocation.findMany({
            where: {
              payableId: purchase.payableId!,
              amount: { gt: 0 },
              payment: { status: { not: "VOIDED" } },
            },
          });
        });
        if (allocations.length > 0) {
          throw new ValidationError(
            "No se puede cambiar el contacto de la compra porque tiene pagos activos asociados",
            PURCHASE_CONTACT_CHANGE_BLOCKED,
          );
        }
      }
    }

    const { details: _details, ...dataWithoutDetails } = input;

    // 4. Para COMPRA_GENERAL/SERVICIO, resolver los códigos de cuentas de gasto para las nuevas líneas
    const effectivePurchaseType = purchase.purchaseType as PurchaseType;
    let detailsForEntry: Array<{ lineAmount: number; expenseAccountCode?: string | null; description: string }>;

    if (computedDetails !== undefined) {
      detailsForEntry = await this.resolveComputedDetailAccountCodes(
        organizationId,
        effectivePurchaseType,
        computedDetails,
      );
    } else {
      detailsForEntry = await this.resolveDetailAccountCodes(
        organizationId,
        effectivePurchaseType,
        purchase.details as unknown as Array<{ lineAmount: number; expenseAccountId?: string | null; description: string }>,
      );
    }

    // 5. Resolver los objetos de cuenta necesarios para la actualización de líneas del asiento
    const effectiveTotalForEntry = newTotalAmount ?? Number(purchase.totalAmount);

    let ivaBookForEntry: IvaBookForEntry | undefined;
    if (purchase.ivaPurchaseBook && purchase.ivaPurchaseBook.status === "ACTIVE") {
      const iva = purchase.ivaPurchaseBook;
      const D = (v: number | string) => new Prisma.Decimal(String(v));
      const totals = calcTotales({
        importeTotal: D(effectiveTotalForEntry),
        importeIce: iva.importeIce as Prisma.Decimal,
        importeIehd: iva.importeIehd as Prisma.Decimal,
        importeIpj: iva.importeIpj as Prisma.Decimal,
        tasas: iva.tasas as Prisma.Decimal,
        otrosNoSujetos: iva.otrosNoSujetos as Prisma.Decimal,
        exentos: iva.exentos as Prisma.Decimal,
        tasaCero: iva.tasaCero as Prisma.Decimal,
        codigoDescuentoAdicional: iva.codigoDescuentoAdicional as Prisma.Decimal,
        importeGiftCard: iva.importeGiftCard as Prisma.Decimal,
      });
      ivaBookForEntry = {
        baseIvaSujetoCf: Number(totals.baseImponible),
        dfCfIva: Number(totals.ivaAmount),
        importeTotal: effectiveTotalForEntry,
        exentos: Number(iva.exentos ?? 0),
      };
    }

    const entryLines = buildPurchaseEntryLines(
      effectivePurchaseType,
      effectiveTotalForEntry,
      detailsForEntry,
      settings as unknown as PurchaseOrgSettings,
      input.contactId ?? purchase.contactId,
      ivaBookForEntry,
    );

    // 6. Pre-resolver los IDs de cuenta para todas las líneas de débito
    const resolvedLines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      contactId?: string;
      description?: string;
      order: number;
    }> = [];

    for (let i = 0; i < entryLines.length; i++) {
      const l = entryLines[i];
      const account = await this.accountsRepo.findByCode(organizationId, l.accountCode);
      if (!account || !account.isActive || !account.isDetail) {
        throw new ValidationError(
          `Cuenta ${l.accountCode} no es posteable`,
          "ACCOUNT_NOT_POSTABLE",
        );
      }
      resolvedLines.push({
        accountId: account.id,
        debit: l.debit,
        credit: l.credit,
        contactId: l.contactId,
        description: l.description,
        order: i,
      });
    }

    // 7. Ejecutar la transacción atómica
    const { correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId },
      async (tx) => {
      // a. Revertir los saldos del asiento contable anterior
      if (purchase.journalEntryId) {
        const oldEntry = await tx.journalEntry.findFirst({
          where: { id: purchase.journalEntryId, organizationId },
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

      // b. Actualizar los campos de la compra + detalles
      await this.repo.updateTx(
        tx,
        organizationId,
        purchase.id,
        dataWithoutDetails,
        computedDetails,
        pfSummary,
      );

      // c. Actualizar el totalAmount si cambió
      if (newTotalAmount !== undefined) {
        await this.repo.updateStatusTx(
          tx,
          organizationId,
          purchase.id,
          "POSTED",
          newTotalAmount,
        );
      }

      // d. Actualizar las líneas del asiento contable
      const effectiveDate = input.date ? new Date(input.date) : purchase.date;
      const effectiveDescription = input.description ?? purchase.description;
      const effectiveNotes = input.notes ?? purchase.notes;
      const displayCode = getDisplayCode(
        effectivePurchaseType,
        purchase.sequenceNumber,
      );
      const journalDescription = effectiveNotes
        ? `${displayCode} - ${effectiveDescription} | ${effectiveNotes}`
        : `${displayCode} - ${effectiveDescription}`;

      const effectiveContactId = input.contactId ?? purchase.contactId;

      const updatedEntry = await this.journalRepo.updateTx(
        tx,
        organizationId,
        purchase.journalEntryId!,
        {
          date: effectiveDate,
          description: journalDescription,
          contactId: effectiveContactId,
        },
        resolvedLines,
        userId,
      );

      // e. Aplicar los nuevos saldos
      await this.balancesService.applyPost(tx, updatedEntry);

      // f. Actualizar CxP: monto, saldo, estado
      if (purchase.payableId) {
        const existingPayable = await tx.accountsPayable.findFirst({
          where: { id: purchase.payableId },
          select: { paid: true },
        });
        const rawPaid = existingPayable ? Number(existingPayable.paid) : 0;
        const effectiveTotal = newTotalAmount ?? Number(purchase.totalAmount);
        const cappedPaid = Math.min(rawPaid, effectiveTotal);
        const newBalance = effectiveTotal - cappedPaid;
        const newStatus = computePayableStatus(cappedPaid, newBalance);

        // Si el monto pagado supera el nuevo total, reducir las asignaciones de pago en orden LIFO
        if (rawPaid > effectiveTotal) {
          const allocations = await tx.paymentAllocation.findMany({
            where: {
              payableId: purchase.payableId,
              payment: { status: { not: "VOIDED" } },
            },
            orderBy: { id: "desc" }, // LIFO (último en entrar, primero en salir)
          });

          let excess = rawPaid - effectiveTotal;
          for (const alloc of allocations) {
            if (excess <= 0) break;
            const allocAmount = Number(alloc.amount);
            const reduction = Math.min(allocAmount, excess);
            const newAllocAmount = allocAmount - reduction;

            if (newAllocAmount <= 0) {
              await tx.paymentAllocation.delete({ where: { id: alloc.id } });
            } else {
              await tx.paymentAllocation.update({
                where: { id: alloc.id },
                data: { amount: new Prisma.Decimal(newAllocAmount) },
              });
            }
            excess -= reduction;
          }
        }

        await tx.accountsPayable.update({
          where: { id: purchase.payableId },
          data: {
            amount: new Prisma.Decimal(effectiveTotal),
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

    const updated = await this.repo.findById(organizationId, purchase.id);
    return { ...withDisplayCode(updated!), correlationId };
  }

  // ── Anular una compra (POSTED → VOIDED) ──

  async void(
    organizationId: string,
    id: string,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<WithCorrelation<PurchaseWithDetails>> {
    const purchase = await this.getById(organizationId, id);
    const status = purchase.status as DocumentStatus;

    validateTransition(status, "VOIDED");

    if (status === "LOCKED") {
      const period = await this.periodsService.getById(organizationId, purchase.periodId);
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
        await this.voidCascadeTx(tx, organizationId, purchase, userId);
        return undefined;
      },
    );

    const updated = await this.repo.findById(organizationId, id);
    return { ...withDisplayCode(updated!), correlationId };
  }

  // ── Eliminar físicamente una compra en DRAFT ──

  async delete(organizationId: string, id: string): Promise<void> {
    const purchase = await this.getById(organizationId, id);

    if (purchase.status !== "DRAFT") {
      throw new ValidationError(
        "Solo se pueden eliminar compras en estado BORRADOR",
        PURCHASE_NOT_DRAFT,
      );
    }

    await this.repo.hardDelete(organizationId, id);
  }

  // ── Regenerar asiento contable por cambio en IVA (SPEC-6 / D3) ──
  //
  // CONTRATO READ-ONLY sobre IvaPurchaseBook:
  //   Este método LEE el IvaPurchaseBook para construir las líneas del asiento,
  //   pero NUNCA escribe en él. Esta restricción previene el loop:
  //   IvaBooksService → regenerateJournalForIvaChange → IvaBooksService.
  //
  //   GREP ENFORCEMENT: no debe existir `tx.ivaPurchaseBook.update` en este método.
  //
  // SIGNATURE (D2.d): discriminated union. externalTx + correlationId are
  // paired — passing one without the other is a compile-time error.

  async regenerateJournalForIvaChange(
    opts:
      | {
          organizationId: string;
          purchaseId: string;
          userId: string;
          externalTx: Prisma.TransactionClient;
          correlationId: string;
        }
      | {
          organizationId: string;
          purchaseId: string;
          userId: string;
          externalTx?: undefined;
          correlationId?: undefined;
        },
  ): Promise<WithCorrelation<PurchaseWithDetails>> {
    const { organizationId, purchaseId, userId } = opts;
    const externalTx = opts.externalTx;
    // 1. Cargar la compra actualizada (incluye ivaPurchaseBook fresco).
    //    Si hay externalTx, la lectura DEBE ir por esa tx para ver datos
    //    recién escritos en el mismo callback (Audit F #4/#5 — IvaBooks
    //    escribió ivaPurchaseBook dentro de la misma tx antes de llamarnos).
    const purchase = await this.getById(organizationId, purchaseId, externalTx);

    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    // 2. Resolver cuentas de detalle para el builder
    const detailsForEntry = await this.resolveDetailAccountCodes(
      organizationId,
      purchase.purchaseType as PurchaseType,
      purchase.details as unknown as Array<{ lineAmount: number; expenseAccountId?: string | null; description: string }>,
    );

    const totalAmount = Number(purchase.totalAmount);

    // 3. Extraer ivaBook (READ-ONLY — ver contrato arriba)
    const ivaBookForEntry = extractIvaBookForEntry(purchase);

    const entryLines = buildPurchaseEntryLines(
      purchase.purchaseType as PurchaseType,
      totalAmount,
      detailsForEntry,
      settings as unknown as PurchaseOrgSettings,
      purchase.contactId,
      ivaBookForEntry,
    );

    // 4. Pre-resolver IDs de cuenta
    const resolvedLines: Array<{
      accountId: string;
      debit: number;
      credit: number;
      contactId?: string;
      description?: string;
      order: number;
    }> = [];

    for (let i = 0; i < entryLines.length; i++) {
      const l = entryLines[i];
      const account = await this.accountsRepo.findByCode(organizationId, l.accountCode);
      if (!account || !account.isActive || !account.isDetail) {
        throw new ValidationError(
          `Cuenta ${l.accountCode} no es posteable`,
          "ACCOUNT_NOT_POSTABLE",
        );
      }
      resolvedLines.push({
        accountId: account.id,
        debit: l.debit,
        credit: l.credit,
        contactId: l.contactId,
        description: l.description,
        order: i,
      });
    }

    // 5. Ejecutar el body atómico. Si hay externalTx, usarla directamente
    //    (Prisma NO soporta tx interactivas anidadas). Si no, abrir una propia.
    const body = async (tx: Prisma.TransactionClient) => {
      // Re-chequear que el período sigue ABIERTO dentro de la tx
      await tx.fiscalPeriod.findFirstOrThrow({
        where: { id: purchase.periodId, status: "OPEN" },
      });

      // a. Revertir saldos del asiento anterior
      if (purchase.journalEntryId) {
        const oldEntry = await tx.journalEntry.findFirst({
          where: { id: purchase.journalEntryId, organizationId },
          include: {
            lines: { include: { account: true, contact: true }, orderBy: { order: "asc" as const } },
            contact: true,
            voucherType: true,
          },
        });
        if (oldEntry) {
          await this.balancesService.applyVoid(tx, oldEntry as never);
        }
      }

      // b. Actualizar las líneas del asiento contable
      const displayCode = getDisplayCode(
        purchase.purchaseType as PurchaseType,
        purchase.sequenceNumber,
      );
      const journalDescription = purchase.notes
        ? `${displayCode} - ${purchase.description} | ${purchase.notes}`
        : `${displayCode} - ${purchase.description}`;

      const updatedEntry = await this.journalRepo.updateTx(
        tx,
        organizationId,
        purchase.journalEntryId!,
        {
          date: purchase.date,
          description: journalDescription,
          contactId: purchase.contactId,
        },
        resolvedLines,
        userId,
      );

      // c. Aplicar los nuevos saldos
      await this.balancesService.applyPost(tx, updatedEntry);
    };

    let resolvedCorrelationId: string;
    if (opts.externalTx) {
      // INV-1 runtime assertion (REQ-CORR.4 anti-scenario): the caller MUST
      // have installed setAuditContext on the outer tx before delegating to us.
      await assertAuditContextSet(opts.externalTx, "regenerateJournalForIvaChange (purchase)");
      resolvedCorrelationId = opts.correlationId;
      await body(opts.externalTx);
    } else {
      resolvedCorrelationId = crypto.randomUUID();
      const standaloneCid = resolvedCorrelationId;
      await this.repo.transaction(async (tx) => {
        await setAuditContext(tx, userId, organizationId, undefined, standaloneCid);
        await body(tx);
      });
    }

    const updated = await this.repo.findById(organizationId, purchaseId, opts.externalTx);
    return { ...withDisplayCode(updated!), correlationId: resolvedCorrelationId };
  }

  // ── Interno: anulación en cascada dentro de una transacción ──

  private async voidCascadeTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    purchase: PurchaseWithDetails,
    userId: string,
  ): Promise<void> {
    // 0. Desvincular las asignaciones de pago activas antes de anular
    if (purchase.payableId) {
      const activeAllocations = await tx.paymentAllocation.findMany({
        where: {
          payableId: purchase.payableId,
          amount: { gt: 0 },
          payment: { status: { not: "VOIDED" } },
        },
      });

      if (activeAllocations.length > 0) {
        const payable = await tx.accountsPayable.findUnique({
          where: { id: purchase.payableId },
        });
        if (payable && payable.status !== "VOIDED") {
          const totalToReverse = activeAllocations.reduce(
            (sum, a) => sum + Number(a.amount),
            0,
          );
          const revertedPaid = Math.max(0, Number(payable.paid) - totalToReverse);
          const revertedBalance = Number(payable.amount) - revertedPaid;
          const revertedStatus = computePayableStatus(
            revertedPaid,
            Math.max(0, revertedBalance),
          );
          await tx.accountsPayable.update({
            where: { id: purchase.payableId },
            data: {
              paid: new Prisma.Decimal(revertedPaid),
              balance: new Prisma.Decimal(Math.max(0, revertedBalance)),
              status: revertedStatus,
            },
          });
        }

        await tx.paymentAllocation.deleteMany({
          where: {
            payableId: purchase.payableId,
            payment: { status: { not: "VOIDED" } },
          },
        });
      }
    }

    // 1. Actualizar el estado de la compra a VOIDED
    await this.repo.updateStatusTx(tx, organizationId, purchase.id, "VOIDED");

    // SPEC-7 / D4: Anular el IvaPurchaseBook ANTES de la reversión del asiento.
    // El orden importa: ambas operaciones deben estar en la misma tx.
    // LOOP GUARD: no existe `tx.ivaPurchaseBook.update` en regenerateJournalForIvaChange.
    const ivaPurchaseBook = await tx.ivaPurchaseBook.findUnique({ where: { purchaseId: purchase.id } });
    if (ivaPurchaseBook && ivaPurchaseBook.status !== "VOIDED") {
      await tx.ivaPurchaseBook.update({
        where: { id: ivaPurchaseBook.id },
        data: { status: "VOIDED" },
      });
    }

    // 2. Anular el JournalEntry vinculado
    if (purchase.journalEntryId) {
      const journalEntry = await tx.journalEntry.findFirst({
        where: { id: purchase.journalEntryId, organizationId },
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

        // 3. Revertir los saldos de cuentas
        await this.balancesService.applyVoid(tx, journalEntry as never);
      }
    }

    // 4. Anular el AccountsPayable vinculado
    if (purchase.payableId) {
      await this.payablesRepo.voidTx(tx, organizationId, purchase.payableId);
    }
  }

  // ── Privado: resolver los códigos de cuenta de gasto para COMPRA_GENERAL/SERVICIO a partir de los registros de detalle ──

  private async resolveDetailAccountCodes(
    organizationId: string,
    purchaseType: PurchaseType,
    details: Array<{ lineAmount: number; expenseAccountId?: string | null; description: string }>,
  ): Promise<Array<{ lineAmount: number; expenseAccountCode: string | null; description: string }>> {
    if (purchaseType !== "COMPRA_GENERAL" && purchaseType !== "SERVICIO") {
      return details.map((d) => ({
        lineAmount: d.lineAmount,
        expenseAccountCode: null,
        description: d.description,
      }));
    }

    const result = [];
    for (const d of details) {
      let expenseAccountCode: string | null = null;
      if (d.expenseAccountId) {
        const account = await this.accountsRepo.findById(organizationId, d.expenseAccountId);
        expenseAccountCode = account?.code ?? null;
      }
      result.push({
        lineAmount: d.lineAmount,
        expenseAccountCode,
        description: d.description,
      });
    }
    return result;
  }

  // ── Privado: resolver los códigos de cuenta de gasto para detalles calculados (que tienen expenseAccountId) ──

  private async resolveComputedDetailAccountCodes(
    organizationId: string,
    purchaseType: PurchaseType,
    computedDetails: ComputedPurchaseDetail[],
  ): Promise<Array<{ lineAmount: number; expenseAccountCode: string | null; description: string }>> {
    if (purchaseType !== "COMPRA_GENERAL" && purchaseType !== "SERVICIO") {
      return computedDetails.map((d) => ({
        lineAmount: d.lineAmount,
        expenseAccountCode: null,
        description: d.description,
      }));
    }

    const result = [];
    for (const d of computedDetails) {
      let expenseAccountCode: string | null = null;
      if (d.expenseAccountId) {
        const account = await this.accountsRepo.findById(organizationId, d.expenseAccountId);
        expenseAccountCode = account?.code ?? null;
      }
      result.push({
        lineAmount: d.lineAmount,
        expenseAccountCode,
        description: d.description,
      });
    }
    return result;
  }
}
