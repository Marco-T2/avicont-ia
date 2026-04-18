import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  POST_NOT_ALLOWED_FOR_ROLE,
  SALE_NO_DETAILS,
  SALE_INVALID_CONTACT_TYPE,
  SALE_NOT_DRAFT,
  SALE_CONTACT_CHANGE_BLOCKED,
  SALE_INCOME_ACCOUNT_REQUIRED,
} from "@/features/shared/errors";
import { canPost } from "@/features/shared/permissions.server";
import {
  validateTransition,
  validateEditable,
  validateLockedEdit,
  validatePeriodOpen,
  type DocumentStatus,
  type TrimPreviewItem,
} from "@/features/shared/document-lifecycle.service";
export type { TrimPreviewItem };
import { computeReceivableStatus } from "@/features/shared/accounting-helpers";
import { JournalRepository } from "@/features/accounting/journal.repository";
import { setAuditContext } from "@/features/shared/audit-context";
import { Prisma } from "@/generated/prisma/client";
import { SaleRepository } from "./sale.repository";
import type { ComputedSaleDetail } from "./sale.repository";
import { OrgSettingsService } from "@/features/org-settings";
import { AutoEntryGenerator } from "@/features/shared/auto-entry-generator";
import { AccountsRepository } from "@/features/accounting/accounts.repository";
import { VoucherTypesRepository } from "@/features/voucher-types/voucher-types.repository";
import { ContactsService } from "@/features/contacts";
import { ReceivablesRepository } from "@/features/receivables/receivables.repository";
import { AccountBalancesService } from "@/features/account-balances";
import { FiscalPeriodsService } from "@/features/fiscal-periods";
import type {
  SaleWithDetails,
  CreateSaleInput,
  UpdateSaleInput,
  SaleFilters,
  CreateSaleDetailInput,
} from "./sale.types";
import {
  getDisplayCode,
  buildSaleEntryLines,
  type SaleOrgSettings,
  type IvaBookForEntry,
} from "./sale.utils";
import { calcTotales } from "@/features/accounting/iva-books/iva-calc.utils";

// ── Bridge interface: IvaBooksService (evitar importación circular) ──────────

/**
 * Contrato mínimo de IvaBooksService necesario para el cascade de editPosted.
 * Usar la interfaz en vez del tipo concreto para evitar acoplamiento circular
 * (IvaBooksService ya tiene un bridge hacia SaleService en el sentido inverso).
 */
export interface IvaBooksServiceForSaleCascade {
  recomputeFromSaleCascade(
    tx: Prisma.TransactionClient,
    orgId: string,
    saleId: string,
    newTotal: Prisma.Decimal,
  ): Promise<void>;
}

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

// ── Auxiliar: calcular detalles de venta ──

function computeDetails(
  details: CreateSaleDetailInput[],
): ComputedSaleDetail[] {
  return details.map((d, i) => {
    const quantity = d.quantity ?? 1;
    const unitPrice = d.unitPrice ?? 0;
    const lineAmount = d.lineAmount !== undefined
      ? d.lineAmount
      : Math.round(quantity * unitPrice * 100) / 100;
    return {
      description: d.description,
      lineAmount,
      order: d.order ?? i,
      quantity,
      unitPrice,
      incomeAccountId: d.incomeAccountId,
    };
  });
}

// ── Auxiliar: extraer IvaBookForEntry de un IvaSalesBookDTO activo ──

function extractIvaBookForEntry(sale: SaleWithDetails): IvaBookForEntry | undefined {
  const iva = sale.ivaSalesBook;
  if (!iva || iva.status !== "ACTIVE") return undefined;
  return {
    baseIvaSujetoCf: Number(iva.baseIvaSujetoCf),
    dfCfIva: Number(iva.dfCfIva),
    importeTotal: Number(iva.importeTotal),
    exentos: Number(iva.exentos ?? 0),
  };
}

// ── Auxiliar: agregar displayCode al resultado ──

function withDisplayCode(sale: SaleWithDetails): SaleWithDetails {
  return {
    ...sale,
    displayCode: getDisplayCode(sale.sequenceNumber),
  };
}

export class SaleService {
  private readonly repo: SaleRepository;
  private readonly orgSettingsService: OrgSettingsService;
  private readonly autoEntryGenerator: AutoEntryGenerator;
  private readonly contactsService: ContactsService;
  private readonly receivablesRepo: ReceivablesRepository;
  private readonly balancesService: AccountBalancesService;
  private readonly periodsService: FiscalPeriodsService;
  private readonly accountsRepo: AccountsRepository;
  private readonly journalRepo: JournalRepository;
  private readonly ivaBooksService?: IvaBooksServiceForSaleCascade;

  constructor(
    repo?: SaleRepository,
    orgSettingsService?: OrgSettingsService,
    autoEntryGenerator?: AutoEntryGenerator,
    contactsService?: ContactsService,
    receivablesRepo?: ReceivablesRepository,
    balancesService?: AccountBalancesService,
    periodsService?: FiscalPeriodsService,
    accountsRepo?: AccountsRepository,
    journalRepo?: JournalRepository,
    ivaBooksService?: IvaBooksServiceForSaleCascade,
  ) {
    this.repo = repo ?? new SaleRepository();
    this.orgSettingsService = orgSettingsService ?? new OrgSettingsService();
    this.contactsService = contactsService ?? new ContactsService();
    this.receivablesRepo = receivablesRepo ?? new ReceivablesRepository();
    this.balancesService = balancesService ?? new AccountBalancesService();
    this.periodsService = periodsService ?? new FiscalPeriodsService();
    this.accountsRepo = accountsRepo ?? new AccountsRepository();
    this.journalRepo = journalRepo ?? new JournalRepository();
    this.ivaBooksService = ivaBooksService;

    const voucherTypesRepo = new VoucherTypesRepository();
    this.autoEntryGenerator =
      autoEntryGenerator ?? new AutoEntryGenerator(this.accountsRepo, voucherTypesRepo);
  }

  // ── Listar ventas ──

  async list(
    organizationId: string,
    filters?: SaleFilters,
  ): Promise<SaleWithDetails[]> {
    const rows = await this.repo.findAll(organizationId, filters);
    return rows.map(withDisplayCode);
  }

  // ── Obtener una venta individual ──

  async getById(organizationId: string, id: string): Promise<SaleWithDetails> {
    const row = await this.repo.findById(organizationId, id);
    if (!row) throw new NotFoundError("Venta");
    return withDisplayCode(row);
  }

  // ── Crear una venta en DRAFT ──

  async createDraft(
    organizationId: string,
    input: CreateSaleInput,
    userId: string,
  ): Promise<SaleWithDetails> {
    // 1. Validar que el contacto sea CLIENTE
    const contact = await this.contactsService.getActiveById(organizationId, input.contactId);
    if (contact.type !== "CLIENTE") {
      throw new ValidationError(
        "El contacto debe ser de tipo CLIENTE para crear una venta",
        SALE_INVALID_CONTACT_TYPE,
      );
    }

    // 2. Validar que cada detalle tenga incomeAccountId
    for (const d of input.details) {
      if (!d.incomeAccountId) {
        throw new ValidationError(
          "Cada línea de detalle debe tener una cuenta de ingreso asociada",
          SALE_INCOME_ACCOUNT_REQUIRED,
        );
      }
    }

    // 3. Calcular detalles
    const computedDetails = computeDetails(input.details);

    const row = await this.repo.create(
      organizationId,
      input,
      userId,
      computedDetails,
    );

    return withDisplayCode(row);
  }

  // ── Contabilizar una venta (DRAFT → POSTED) ──

  async post(
    organizationId: string,
    id: string,
    userId: string,
  ): Promise<SaleWithDetails> {
    const sale = await this.getById(organizationId, id);

    // Validar la transición del ciclo de vida
    validateTransition(sale.status as DocumentStatus, "POSTED");

    // Validar que el período fiscal esté ABIERTO
    const period = await this.periodsService.getById(organizationId, sale.periodId);
    await validatePeriodOpen(period);

    // Validar que haya al menos 1 línea de detalle
    if (!sale.details || sale.details.length === 0) {
      throw new ValidationError(
        "La venta debe tener al menos una línea de detalle para ser contabilizada",
        SALE_NO_DETAILS,
      );
    }

    // Calcular el totalAmount
    const totalAmount = sale.details.reduce(
      (sum, d) => sum + Number(d.lineAmount),
      0,
    );

    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    // Resolver los códigos de cuenta de ingreso a partir de los IDs
    const detailsForEntry = await this.resolveDetailAccountCodes(
      organizationId,
      sale.details as unknown as Array<{ lineAmount: number; incomeAccountId: string; description: string }>,
    );

    // Task 4.4: pasar ivaBook cuando hay un IvaSalesBook ACTIVE vinculado
    const ivaBookForEntry = extractIvaBookForEntry(sale);

    const entryLines = buildSaleEntryLines(
      totalAmount,
      detailsForEntry,
      settings as unknown as SaleOrgSettings,
      sale.contactId,
      ivaBookForEntry,
    );

    const contact = sale.contact;
    const paymentTermsDays = contact.paymentTermsDays ?? 30;

    let saleId = "";

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId);

      const sequenceNumber = await this.repo.getNextSequenceNumber(
        tx,
        organizationId,
      );

      saleId = sale.id;

      // Actualizar el estado, totalAmount y sequenceNumber de la venta
      await this.repo.updateStatusTx(
        tx,
        organizationId,
        id,
        "POSTED",
        totalAmount,
        sequenceNumber,
      );

      const displayCode = getDisplayCode(sequenceNumber);

      const journalDescription = sale.notes
        ? `${displayCode} - ${sale.description} | ${sale.notes}`
        : `${displayCode} - ${sale.description}`;

      // Construir y generar el asiento contable (CI — Comprobante de Ingreso)
      const entry = await this.autoEntryGenerator.generate(tx, {
        organizationId,
        voucherTypeCode: "CI",
        contactId: sale.contactId,
        date: sale.date,
        periodId: sale.periodId,
        description: journalDescription,
        sourceType: "sale",
        sourceId: sale.id,
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
        sale.date.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
      );

      const receivable = await this.receivablesRepo.createTx(tx, {
        organizationId,
        contactId: sale.contactId,
        description: journalDescription,
        amount: totalAmount,
        dueDate,
        sourceType: "sale",
        sourceId: sale.id,
        journalEntryId: entry.id,
      });

      await this.repo.linkJournalAndReceivable(tx, sale.id, entry.id, receivable.id);
    });

    const result = await this.repo.findById(organizationId, saleId);
    return withDisplayCode(result!);
  }

  // ── Crear y contabilizar una venta en una sola transacción atómica ──

  async createAndPost(
    organizationId: string,
    input: CreateSaleInput,
    context: { userId: string; role: string },
  ): Promise<SaleWithDetails> {
    // 0. RBAC: canPost (PR3.1 / P.6 / D.7) — matrix-backed async check
    if (!(await canPost(context.role, "sales", organizationId))) {
      throw new ForbiddenError(
        "Tu rol no tiene permiso para contabilizar ventas",
        POST_NOT_ALLOWED_FOR_ROLE,
      );
    }
    const { userId } = context;

    // 1. Validar que el contacto sea CLIENTE
    const contact = await this.contactsService.getActiveById(organizationId, input.contactId);
    if (contact.type !== "CLIENTE") {
      throw new ValidationError(
        "El contacto debe ser de tipo CLIENTE para crear una venta",
        SALE_INVALID_CONTACT_TYPE,
      );
    }

    // 2. Validar que cada detalle tenga incomeAccountId
    for (const d of input.details) {
      if (!d.incomeAccountId) {
        throw new ValidationError(
          "Cada línea de detalle debe tener una cuenta de ingreso asociada",
          SALE_INCOME_ACCOUNT_REQUIRED,
        );
      }
    }

    // 3. Validar que el período fiscal esté ABIERTO
    const period = await this.periodsService.getById(organizationId, input.periodId);
    await validatePeriodOpen(period);

    // 4. Calcular detalles
    const computedDetails = computeDetails(input.details);

    if (computedDetails.length === 0) {
      throw new ValidationError(
        "La venta debe tener al menos una línea de detalle para ser contabilizada",
        SALE_NO_DETAILS,
      );
    }

    // 5. Calcular el totalAmount
    const totalAmount = computedDetails.reduce((sum, d) => sum + d.lineAmount, 0);

    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    // 6. Resolver los códigos de cuentas de ingreso
    const detailsForEntry = await this.resolveComputedDetailAccountCodes(
      organizationId,
      computedDetails,
    );

    const entryLines = buildSaleEntryLines(
      totalAmount,
      detailsForEntry,
      settings as unknown as SaleOrgSettings,
      input.contactId,
    );

    const paymentTermsDays =
      (contact as { paymentTermsDays?: number }).paymentTermsDays ?? 30;

    let saleId = "";

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId);

      const sequenceNumber = await this.repo.getNextSequenceNumber(
        tx,
        organizationId,
      );

      const sale = await this.repo.createPostedTx(
        tx,
        organizationId,
        input,
        userId,
        sequenceNumber,
        computedDetails,
        totalAmount,
      );
      saleId = sale.id;

      const displayCode = getDisplayCode(sequenceNumber);

      const journalDescription = input.notes
        ? `${displayCode} - ${input.description} | ${input.notes}`
        : `${displayCode} - ${input.description}`;

      const entry = await this.autoEntryGenerator.generate(tx, {
        organizationId,
        voucherTypeCode: "CI",
        contactId: input.contactId,
        date: new Date(input.date),
        periodId: input.periodId,
        description: journalDescription,
        sourceType: "sale",
        sourceId: sale.id,
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

      const receivable = await this.receivablesRepo.createTx(tx, {
        organizationId,
        contactId: input.contactId,
        description: journalDescription,
        amount: totalAmount,
        dueDate,
        sourceType: "sale",
        sourceId: sale.id,
        journalEntryId: entry.id,
      });

      await this.repo.linkJournalAndReceivable(tx, sale.id, entry.id, receivable.id);
    });

    const result = await this.repo.findById(organizationId, saleId);
    return withDisplayCode(result!);
  }

  // ── Preview de recorte de asignaciones (dryRun / pre-flight) ────────────────

  /**
   * Calcula qué asignaciones de pago serían recortadas (LIFO) si la venta
   * se editara a `newTotal`. No ejecuta ninguna escritura.
   *
   * REQ-5 / D3
   */
  async getEditPreview(
    saleId: string,
    organizationId: string,
    newTotal: number,
  ): Promise<{ trimPreview: TrimPreviewItem[] }> {
    const sale = await this.getById(organizationId, saleId);
    if (!sale.receivableId) {
      return { trimPreview: [] };
    }

    // Use a read-only transaction to fetch allocations with payment date
    const trimPreview = await this.repo.transaction(async (tx) => {
      const receivable = await tx.accountsReceivable.findFirst({
        where: { id: sale.receivableId! },
        select: { paid: true },
      });
      const rawPaid = receivable ? Number(receivable.paid) : 0;

      if (newTotal >= rawPaid) {
        return [];
      }

      const allocations = await tx.paymentAllocation.findMany({
        where: {
          receivableId: sale.receivableId!,
          payment: { status: { not: "VOIDED" } },
        },
        orderBy: { id: "desc" },
        include: { payment: { select: { date: true } } },
      });

      return computeTrimPlan(allocations, rawPaid - newTotal);
    });

    return { trimPreview };
  }

  // ── Actualizar una venta (DRAFT directamente, POSTED mediante editPosted) ──

  async update(
    organizationId: string,
    id: string,
    input: UpdateSaleInput,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<SaleWithDetails> {
    const sale = await this.getById(organizationId, id);
    const status = sale.status as DocumentStatus;

    if (status === "LOCKED") {
      validateLockedEdit(status, role!, justification);
    } else {
      validateEditable(status);
    }

    // Validar el nuevo tipo de contacto si se está cambiando
    if (input.contactId !== undefined) {
      const contact = await this.contactsService.getActiveById(
        organizationId,
        input.contactId,
      );
      if (contact.type !== "CLIENTE") {
        throw new ValidationError(
          "El contacto debe ser de tipo CLIENTE",
          SALE_INVALID_CONTACT_TYPE,
        );
      }
    }

    // Recalcular detalles si cambiaron
    let computedDetails: ComputedSaleDetail[] | undefined;

    if (input.details !== undefined) {
      computedDetails = computeDetails(input.details);
    }

    const { details: _details, ...dataWithoutDetails } = input;

    // Para ventas POSTED, ejecutar el flujo atómico de revertir-modificar-reaplicar
    if (status === "POSTED") {
      const period = await this.periodsService.getById(organizationId, sale.periodId);
      await validatePeriodOpen(period);
      return this.editPosted(organizationId, sale, input, computedDetails, userId);
    }

    // Para ediciones en LOCKED, envolver en transacción con contexto de auditoría
    if (status === "LOCKED") {
      const row = await this.repo.transaction(async (tx) => {
        await setAuditContext(tx, sale.createdById ?? "unknown", justification);
        return tx.sale.update({
          where: { id, organizationId },
          data: {
            ...(dataWithoutDetails.date !== undefined && { date: new Date(dataWithoutDetails.date) }),
            ...(dataWithoutDetails.contactId !== undefined && { contactId: dataWithoutDetails.contactId }),
            ...(dataWithoutDetails.description !== undefined && { description: dataWithoutDetails.description }),
            ...(dataWithoutDetails.referenceNumber !== undefined && { referenceNumber: dataWithoutDetails.referenceNumber }),
            ...(dataWithoutDetails.notes !== undefined && { notes: dataWithoutDetails.notes }),
          },
          include: { contact: true, period: true, createdBy: true, details: { orderBy: { order: "asc" } } },
        });
      });
      return withDisplayCode(row as unknown as SaleWithDetails);
    }

    const row = await this.repo.update(
      organizationId,
      id,
      dataWithoutDetails,
      computedDetails,
    );
    return withDisplayCode(row);
  }

  // ── Editar una venta POSTED (revertir-modificar-reaplicar de forma atómica) ──

  private async editPosted(
    organizationId: string,
    sale: SaleWithDetails,
    input: UpdateSaleInput,
    computedDetails: ComputedSaleDetail[] | undefined,
    userId: string,
  ): Promise<SaleWithDetails> {
    if (computedDetails !== undefined && computedDetails.length === 0) {
      throw new ValidationError(
        "La venta debe tener al menos una línea de detalle para ser contabilizada",
        SALE_NO_DETAILS,
      );
    }

    const settings = await this.orgSettingsService.getOrCreate(organizationId);
    let newTotalAmount: number | undefined;
    if (computedDetails !== undefined) {
      newTotalAmount = computedDetails.reduce((sum, d) => sum + d.lineAmount, 0);
    }

    // Pre-validar cambio de contacto: bloquear si la CxC tiene asignaciones de pago activas
    if (input.contactId !== undefined && input.contactId !== sale.contactId) {
      if (sale.receivableId) {
        const allocations = await this.repo.transaction(async (tx) => {
          return tx.paymentAllocation.findMany({
            where: {
              receivableId: sale.receivableId!,
              amount: { gt: 0 },
              payment: { status: { not: "VOIDED" } },
            },
          });
        });
        if (allocations.length > 0) {
          throw new ValidationError(
            "No se puede cambiar el contacto de la venta porque tiene cobros activos asociados",
            SALE_CONTACT_CHANGE_BLOCKED,
          );
        }
      }
    }

    const { details: _details, ...dataWithoutDetails } = input;

    let detailsForEntry: Array<{ lineAmount: number; incomeAccountCode: string; description: string }>;

    if (computedDetails !== undefined) {
      detailsForEntry = await this.resolveComputedDetailAccountCodes(
        organizationId,
        computedDetails,
      );
    } else {
      detailsForEntry = await this.resolveDetailAccountCodes(
        organizationId,
        sale.details as unknown as Array<{ lineAmount: number; incomeAccountId: string; description: string }>,
      );
    }

    const effectiveTotalForEntry = newTotalAmount ?? Number(sale.totalAmount);

    // Construir ivaBookForEntry con valores IVA recalculados del nuevo total
    let ivaBookForEntry: IvaBookForEntry | undefined;
    if (sale.ivaSalesBook && sale.ivaSalesBook.status === "ACTIVE") {
      const iva = sale.ivaSalesBook;
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

    const entryLines = buildSaleEntryLines(
      effectiveTotalForEntry,
      detailsForEntry,
      settings as unknown as SaleOrgSettings,
      input.contactId ?? sale.contactId,
      ivaBookForEntry,
    );

    // Pre-resolver los IDs de cuenta para todas las líneas
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

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId);

      // a. Revertir los saldos del asiento contable anterior
      if (sale.journalEntryId) {
        const oldEntry = await tx.journalEntry.findFirst({
          where: { id: sale.journalEntryId, organizationId },
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

      // b. Actualizar los campos de la venta + detalles
      if (computedDetails !== undefined) {
        await tx.saleDetail.deleteMany({ where: { saleId: sale.id } });
        if (computedDetails.length > 0) {
          await tx.saleDetail.createMany({
            data: computedDetails.map((d): Prisma.SaleDetailCreateManyInput => ({
              saleId: sale.id,
              description: d.description,
              lineAmount: new Prisma.Decimal(d.lineAmount),
              order: d.order,
              quantity: d.quantity !== undefined ? new Prisma.Decimal(d.quantity) : null,
              unitPrice: d.unitPrice !== undefined ? new Prisma.Decimal(d.unitPrice) : null,
              incomeAccountId: d.incomeAccountId,
            })),
          });
        }
      }

      // Actualizar campos de cabecera
      await tx.sale.update({
        where: { id: sale.id, organizationId },
        data: {
          ...(dataWithoutDetails.date !== undefined && { date: new Date(dataWithoutDetails.date) }),
          ...(dataWithoutDetails.contactId !== undefined && { contactId: dataWithoutDetails.contactId }),
          ...(dataWithoutDetails.description !== undefined && { description: dataWithoutDetails.description }),
          ...(dataWithoutDetails.referenceNumber !== undefined && { referenceNumber: dataWithoutDetails.referenceNumber }),
          ...(dataWithoutDetails.notes !== undefined && { notes: dataWithoutDetails.notes }),
        },
      });

      // c. Actualizar el totalAmount si cambió
      if (newTotalAmount !== undefined) {
        await this.repo.updateStatusTx(
          tx,
          organizationId,
          sale.id,
          "POSTED",
          newTotalAmount,
        );
      }

      // d. Actualizar las líneas del asiento contable
      const effectiveDate = input.date ? new Date(input.date) : sale.date;
      const effectiveDescription = input.description ?? sale.description;
      const effectiveNotes = input.notes ?? sale.notes;
      const displayCode = getDisplayCode(sale.sequenceNumber);
      const journalDescription = effectiveNotes
        ? `${displayCode} - ${effectiveDescription} | ${effectiveNotes}`
        : `${displayCode} - ${effectiveDescription}`;

      const effectiveContactId = input.contactId ?? sale.contactId;

      const updatedEntry = await this.journalRepo.updateTx(
        tx,
        organizationId,
        sale.journalEntryId!,
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

      // f. Actualizar CxC: monto, saldo, estado
      if (sale.receivableId) {
        const existingReceivable = await tx.accountsReceivable.findFirst({
          where: { id: sale.receivableId },
          select: { paid: true },
        });
        const rawPaid = existingReceivable ? Number(existingReceivable.paid) : 0;
        const effectiveTotal = newTotalAmount ?? Number(sale.totalAmount);
        const cappedPaid = Math.min(rawPaid, effectiveTotal);
        const newBalance = effectiveTotal - cappedPaid;
        const newStatus = computeReceivableStatus(cappedPaid, newBalance);

        if (rawPaid > effectiveTotal) {
          const allocations = await tx.paymentAllocation.findMany({
            where: {
              receivableId: sale.receivableId,
              payment: { status: { not: "VOIDED" } },
            },
            orderBy: { id: "desc" },
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

        await tx.accountsReceivable.update({
          where: { id: sale.receivableId },
          data: {
            amount: new Prisma.Decimal(effectiveTotal),
            paid: new Prisma.Decimal(cappedPaid),
            balance: new Prisma.Decimal(newBalance),
            status: newStatus,
            ...(input.contactId !== undefined && { contactId: input.contactId }),
          },
        });
      }

      // g. Recomputar IvaSalesBook si existe uno vinculado (D1, D2).
      // Se llama al final de la tx para que todo lo anterior sea visible dentro
      // del mismo bloque atómico. NO llama a maybeRegenerateJournal (REQ-3 / D2).
      if (sale.ivaSalesBook && this.ivaBooksService) {
        const effectiveNewTotal = newTotalAmount ?? Number(sale.totalAmount);
        await this.ivaBooksService.recomputeFromSaleCascade(
          tx,
          organizationId,
          sale.id,
          new Prisma.Decimal(effectiveNewTotal),
        );
      }
    });

    const updated = await this.repo.findById(organizationId, sale.id);
    return withDisplayCode(updated!);
  }

  // ── Anular una venta (POSTED → VOIDED) ──

  async void(
    organizationId: string,
    id: string,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<SaleWithDetails> {
    const sale = await this.getById(organizationId, id);
    const status = sale.status as DocumentStatus;

    validateTransition(status, "VOIDED");

    if (status === "LOCKED") {
      validateLockedEdit(status, role!, justification);
    }

    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId, justification);
      await this.voidCascadeTx(tx, organizationId, sale, userId);
    });

    const updated = await this.repo.findById(organizationId, id);
    return withDisplayCode(updated!);
  }

  // ── Eliminar físicamente una venta en DRAFT ──

  async delete(organizationId: string, id: string): Promise<void> {
    const sale = await this.getById(organizationId, id);

    if (sale.status !== "DRAFT") {
      throw new ValidationError(
        "Solo se pueden eliminar ventas en estado BORRADOR",
        SALE_NOT_DRAFT,
      );
    }

    await this.repo.hardDelete(organizationId, id);
  }

  // ── Regenerar asiento contable por cambio en IVA (SPEC-6 / D3) ──
  //
  // CONTRATO READ-ONLY sobre IvaSalesBook:
  //   Este método LEE el IvaSalesBook para construir las líneas del asiento,
  //   pero NUNCA escribe en él. Esta restricción previene el loop:
  //   IvaBooksService → regenerateJournalForIvaChange → IvaBooksService.
  //
  //   GREP ENFORCEMENT: no debe existir `tx.ivaSalesBook.update` en este método.

  async regenerateJournalForIvaChange(
    organizationId: string,
    saleId: string,
    userId: string,
  ): Promise<SaleWithDetails> {
    // 1. Cargar la venta actualizada (incluye ivaSalesBook fresco)
    const sale = await this.getById(organizationId, saleId);

    const settings = await this.orgSettingsService.getOrCreate(organizationId);

    // 2. Resolver cuentas de detalle para el builder
    const detailsForEntry = await this.resolveDetailAccountCodes(
      organizationId,
      sale.details as unknown as Array<{ lineAmount: number; incomeAccountId: string; description: string }>,
    );

    const totalAmount = Number(sale.totalAmount);

    // 3. Extraer ivaBook (READ-ONLY — ver contrato arriba)
    const ivaBookForEntry = extractIvaBookForEntry(sale);

    const entryLines = buildSaleEntryLines(
      totalAmount,
      detailsForEntry,
      settings as unknown as SaleOrgSettings,
      sale.contactId,
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

    // 5. Ejecutar transacción atómica con re-chequeo de período (D3 / D5 race guard)
    await this.repo.transaction(async (tx) => {
      await setAuditContext(tx, userId);

      // Re-chequear que el período sigue ABIERTO dentro de la tx (cierra race condition)
      await tx.fiscalPeriod.findFirstOrThrow({
        where: { id: sale.periodId, status: "OPEN" },
      });

      // a. Revertir saldos del asiento anterior
      if (sale.journalEntryId) {
        const oldEntry = await tx.journalEntry.findFirst({
          where: { id: sale.journalEntryId, organizationId },
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
      const displayCode = getDisplayCode(sale.sequenceNumber);
      const journalDescription = sale.notes
        ? `${displayCode} - ${sale.description} | ${sale.notes}`
        : `${displayCode} - ${sale.description}`;

      const updatedEntry = await this.journalRepo.updateTx(
        tx,
        organizationId,
        sale.journalEntryId!,
        {
          date: sale.date,
          description: journalDescription,
          contactId: sale.contactId,
        },
        resolvedLines,
        userId,
      );

      // c. Aplicar los nuevos saldos
      await this.balancesService.applyPost(tx, updatedEntry);
    });

    const updated = await this.repo.findById(organizationId, saleId);
    return withDisplayCode(updated!);
  }

  // ── Interno: anulación en cascada dentro de una transacción ──

  private async voidCascadeTx(
    tx: Prisma.TransactionClient,
    organizationId: string,
    sale: SaleWithDetails,
    userId: string,
  ): Promise<void> {
    // 0. Desvincular las asignaciones de cobro activas antes de anular
    if (sale.receivableId) {
      const activeAllocations = await tx.paymentAllocation.findMany({
        where: {
          receivableId: sale.receivableId,
          amount: { gt: 0 },
          payment: { status: { not: "VOIDED" } },
        },
      });

      if (activeAllocations.length > 0) {
        const receivable = await tx.accountsReceivable.findUnique({
          where: { id: sale.receivableId },
        });
        if (receivable && receivable.status !== "VOIDED") {
          const totalToReverse = activeAllocations.reduce(
            (sum, a) => sum + Number(a.amount),
            0,
          );
          const revertedPaid = Math.max(0, Number(receivable.paid) - totalToReverse);
          const revertedBalance = Number(receivable.amount) - revertedPaid;
          const revertedStatus = computeReceivableStatus(
            revertedPaid,
            Math.max(0, revertedBalance),
          );
          await tx.accountsReceivable.update({
            where: { id: sale.receivableId },
            data: {
              paid: new Prisma.Decimal(revertedPaid),
              balance: new Prisma.Decimal(Math.max(0, revertedBalance)),
              status: revertedStatus,
            },
          });
        }

        await tx.paymentAllocation.deleteMany({
          where: {
            receivableId: sale.receivableId,
            payment: { status: { not: "VOIDED" } },
          },
        });
      }
    }

    // 1. Actualizar el estado de la venta a VOIDED
    await this.repo.updateStatusTx(tx, organizationId, sale.id, "VOIDED");

    // SPEC-7 / D4: Anular el IvaSalesBook ANTES de la reversión del asiento.
    // El orden importa: si el journal reversal falla, el IvaBook void también
    // debe hacer rollback (misma tx). read-only check via findUnique, write via update.
    const ivaBook = await tx.ivaSalesBook.findUnique({ where: { saleId: sale.id } });
    if (ivaBook && ivaBook.status !== "VOIDED") {
      await tx.ivaSalesBook.update({
        where: { id: ivaBook.id },
        data: { status: "VOIDED" },
      });
    }

    // 2. Anular el JournalEntry vinculado
    if (sale.journalEntryId) {
      const journalEntry = await tx.journalEntry.findFirst({
        where: { id: sale.journalEntryId, organizationId },
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

    // 4. Anular la CxC vinculada
    if (sale.receivableId) {
      await this.receivablesRepo.voidTx(tx, sale.receivableId);
    }
  }

  // ── Privado: resolver los códigos de cuenta de ingreso a partir de los IDs ──

  private async resolveDetailAccountCodes(
    organizationId: string,
    details: Array<{ lineAmount: number; incomeAccountId: string; description: string }>,
  ): Promise<Array<{ lineAmount: number; incomeAccountCode: string; description: string }>> {
    const result = [];
    for (const d of details) {
      const account = await this.accountsRepo.findById(organizationId, d.incomeAccountId);
      if (!account) {
        throw new ValidationError(
          `Cuenta de ingreso no encontrada: ${d.incomeAccountId}`,
          SALE_INCOME_ACCOUNT_REQUIRED,
        );
      }
      result.push({
        lineAmount: d.lineAmount,
        incomeAccountCode: account.code,
        description: d.description,
      });
    }
    return result;
  }

  private async resolveComputedDetailAccountCodes(
    organizationId: string,
    computedDetails: ComputedSaleDetail[],
  ): Promise<Array<{ lineAmount: number; incomeAccountCode: string; description: string }>> {
    const result = [];
    for (const d of computedDetails) {
      const account = await this.accountsRepo.findById(organizationId, d.incomeAccountId);
      if (!account) {
        throw new ValidationError(
          `Cuenta de ingreso no encontrada: ${d.incomeAccountId}`,
          SALE_INCOME_ACCOUNT_REQUIRED,
        );
      }
      result.push({
        lineAmount: d.lineAmount,
        incomeAccountCode: account.code,
        description: d.description,
      });
    }
    return result;
  }
}
