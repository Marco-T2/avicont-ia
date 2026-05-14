import "server-only";
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  POST_NOT_ALLOWED_FOR_ROLE,
  MINIMUM_TWO_LINES_REQUIRED,
  JOURNAL_LINE_BOTH_SIDES,
  JOURNAL_LINE_ZERO_AMOUNT,
  ACCOUNT_NOT_POSTABLE,
  JOURNAL_NOT_BALANCED,
  INVALID_STATUS_TRANSITION,
  ENTRY_VOIDED_IMMUTABLE,
  FISCAL_PERIOD_CLOSED,
  CONTACT_REQUIRED_FOR_ACCOUNT,
  REFERENCE_NUMBER_DUPLICATE,
  ENTRY_SYSTEM_GENERATED_IMMUTABLE,
  AUTO_ENTRY_VOID_FORBIDDEN,
} from "@/features/shared/errors";
import { canPost } from "@/features/permissions/server";
import {
  validateLockedEdit,
  validatePeriodOpen,
  type DocumentStatus,
} from "@/modules/accounting/domain/document-lifecycle";
import { canTransition } from "@/modules/accounting/domain/value-objects/journal-entry-status";
import { setAuditContext } from "@/features/shared/audit-context";
import { withAuditTx, type WithCorrelation } from "@/features/shared/audit-tx";
import type { AccountsCrudPort } from "@/modules/accounting/domain/ports/accounts-crud.port";
import { PrismaAccountsRepo } from "@/modules/accounting/infrastructure/prisma-accounts.repo";
import { JournalRepository } from "./journal.repository";
import { AccountBalancesService } from "@/features/account-balances/server";
import { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { VoucherTypesService, makeVoucherTypesService } from "@/modules/voucher-types/presentation/server";
import { makeContactsService } from "@/modules/contacts/presentation/server";
import { OrgProfileService, makeOrgProfileService } from "@/modules/org-profile/presentation/server";
import { makeDocumentSignatureConfigService, type DocumentSignatureConfigService } from "@/modules/document-signature-config/presentation/server";
import { buildVoucherPdfInput } from "./exporters/voucher-pdf.composer";
import { exportVoucherPdf as renderVoucherPdf } from "./exporters/voucher-pdf.exporter";
import { fetchLogoAsDataUrl } from "./exporters/logo-fetcher";
import type { ExportVoucherOpts } from "./exporters/voucher-pdf.types";
import type { JournalEntryStatus, Account } from "@/generated/prisma/client";
import type {
  CreateJournalEntryInput,
  UpdateJournalEntryInput,
  JournalEntryWithLines,
  JournalFilters,
  JournalLineInput,
  CorrelationAuditFilters,
  CorrelationAuditResult,
  CorrelationGap,
} from "./journal.types";

// `VALID_TRANSITIONS` se consolidó en POC #7 OLEADA 6 C0: la tabla canónica
// vive en `modules/accounting/domain/value-objects/journal-entry-status.ts`
// (`ALLOWED` / `canTransition`). Este servicio usa `canTransition` directo.

export class JournalService {
  private readonly repo: JournalRepository;
  private readonly accountsRepo: AccountsCrudPort;
  private readonly balancesService: AccountBalancesService;
  private readonly periodsService: ReturnType<typeof makeFiscalPeriodsService>;
  private readonly voucherTypesService: VoucherTypesService;
  private readonly contactsService: ReturnType<typeof makeContactsService>;
  private readonly orgProfileService: OrgProfileService;
  private readonly sigConfigService: DocumentSignatureConfigService;

  constructor(
    repo?: JournalRepository,
    accountsRepo?: AccountsCrudPort,
    balancesService?: AccountBalancesService,
    periodsService?: ReturnType<typeof makeFiscalPeriodsService>,
    voucherTypesService?: VoucherTypesService,
    contactsService?: ReturnType<typeof makeContactsService>,
    orgProfileService?: OrgProfileService,
    sigConfigService?: DocumentSignatureConfigService,
  ) {
    this.repo = repo ?? new JournalRepository();
    this.accountsRepo = accountsRepo ?? new PrismaAccountsRepo();
    this.balancesService = balancesService ?? new AccountBalancesService();
    this.periodsService = periodsService ?? makeFiscalPeriodsService();
    this.voucherTypesService = voucherTypesService ?? makeVoucherTypesService();
    this.contactsService = contactsService ?? makeContactsService();
    this.orgProfileService = orgProfileService ?? makeOrgProfileService();
    this.sigConfigService = sigConfigService ?? makeDocumentSignatureConfigService();
  }

  // ── Listar asientos contables ──

  async list(
    organizationId: string,
    filters?: JournalFilters,
  ): Promise<JournalEntryWithLines[]> {
    return this.repo.findAll(organizationId, filters);
  }

  // ── Obtener un asiento contable por ID ──

  async getById(organizationId: string, id: string): Promise<JournalEntryWithLines> {
    const entry = await this.repo.findById(organizationId, id);
    if (!entry) throw new NotFoundError("Asiento contable");
    return entry;
  }

  // ── Crear un asiento contable en DRAFT ──

  async createEntry(
    organizationId: string,
    input: CreateJournalEntryInput,
  ): Promise<JournalEntryWithLines> {
    const { lines, ...entryData } = input;

    // Validar que el período fiscal esté OPEN
    const period = await this.periodsService.getById(organizationId, entryData.periodId);
    if (!period.isOpen()) {
      throw new ValidationError(
        "No se pueden crear asientos en un período cerrado",
        FISCAL_PERIOD_CLOSED,
      );
    }

    // Validar que el tipo de comprobante pertenezca a esta organización (getById lanza 404 si no se encuentra)
    await this.voucherTypesService.getById(organizationId, entryData.voucherTypeId);

    // Validar al menos 2 líneas
    if (lines.length < 2) {
      throw new ValidationError(
        "Un asiento contable debe tener al menos 2 líneas",
        MINIMUM_TWO_LINES_REQUIRED,
      );
    }

    // Validar cada línea
    for (const line of lines) {
      if (line.debit > 0 && line.credit > 0) {
        throw new ValidationError(
          "Una línea no puede tener débito y crédito simultáneamente",
          JOURNAL_LINE_BOTH_SIDES,
        );
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new ValidationError(
          "Al menos el débito o el crédito debe ser mayor a 0",
          JOURNAL_LINE_ZERO_AMOUNT,
        );
      }
    }

    // Validar que todas las cuentas existan, estén activas y sean de detalle
    // Cachear las cuentas para evitar consultas redundantes en la validación de contactos
    const accountCache = new Map<string, Account>();
    for (const line of lines) {
      const account = await this.accountsRepo.findById(organizationId, line.accountId);
      if (!account) {
        throw new NotFoundError(`Cuenta ${line.accountId}`);
      }
      if (!account.isActive) {
        throw new ValidationError(`La cuenta "${account.name}" está desactivada`);
      }
      if (!account.isDetail) {
        throw new ValidationError(
          `La cuenta "${account.name}" no es de detalle (no acepta movimientos)`,
          ACCOUNT_NOT_POSTABLE,
        );
      }
      accountCache.set(line.accountId, account);
    }

    // Validar requiresContact: si una cuenta requiere contacto, la línea debe tenerlo
    await this.validateContactsForLines(organizationId, lines, accountCache);

    // Number is allocated atomically inside repo.create with retry-on-contention.
    try {
      return await this.repo.create(organizationId, entryData, lines);
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ValidationError(
          `El número de referencia ${entryData.referenceNumber} ya existe para este tipo de comprobante`,
          REFERENCE_NUMBER_DUPLICATE,
        );
      }
      throw error;
    }
  }

  // ── Crear y contabilizar un asiento en una sola transacción atómica ──

  async createAndPost(
    organizationId: string,
    input: CreateJournalEntryInput,
    context: { userId: string; role: string },
  ): Promise<WithCorrelation<JournalEntryWithLines>> {
    // 0. RBAC: canPost (PR3.3 / P.6 / D.7) — matrix-backed async check
    if (!(await canPost(context.role, "journal", organizationId))) {
      throw new ForbiddenError(
        "Tu rol no tiene permiso para contabilizar asientos",
        POST_NOT_ALLOWED_FOR_ROLE,
      );
    }
    const { userId } = context;

    const { lines, ...entryData } = input;

    // Validar que el período fiscal esté OPEN
    const period = await this.periodsService.getById(organizationId, entryData.periodId);
    if (!period.isOpen()) {
      throw new ValidationError(
        "No se pueden crear asientos en un período cerrado",
        FISCAL_PERIOD_CLOSED,
      );
    }

    // Validar que el tipo de comprobante pertenezca a esta organización
    await this.voucherTypesService.getById(organizationId, entryData.voucherTypeId);

    // Validar al menos 2 líneas
    if (lines.length < 2) {
      throw new ValidationError(
        "Un asiento contable debe tener al menos 2 líneas",
        MINIMUM_TWO_LINES_REQUIRED,
      );
    }

    // Validar cada línea
    for (const line of lines) {
      if (line.debit > 0 && line.credit > 0) {
        throw new ValidationError(
          "Una línea no puede tener débito y crédito simultáneamente",
          JOURNAL_LINE_BOTH_SIDES,
        );
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new ValidationError(
          "Al menos el débito o el crédito debe ser mayor a 0",
          JOURNAL_LINE_ZERO_AMOUNT,
        );
      }
    }

    // Validar que todas las cuentas existan, estén activas y sean de detalle
    const accountCache = new Map<string, Account>();
    for (const line of lines) {
      const account = await this.accountsRepo.findById(organizationId, line.accountId);
      if (!account) {
        throw new NotFoundError(`Cuenta ${line.accountId}`);
      }
      if (!account.isActive) {
        throw new ValidationError(`La cuenta "${account.name}" está desactivada`);
      }
      if (!account.isDetail) {
        throw new ValidationError(
          `La cuenta "${account.name}" no es de detalle (no acepta movimientos)`,
          ACCOUNT_NOT_POSTABLE,
        );
      }
      accountCache.set(line.accountId, account);
    }

    // Validar requiresContact
    await this.validateContactsForLines(organizationId, lines, accountCache);

    // Validar la partida doble (balance)
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

    if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
      throw new ValidationError(
        "Los débitos y créditos no balancean",
        JOURNAL_NOT_BALANCED,
      );
    }

    // Transacción atómica única: crear DRAFT (número asignado con retry) y contabilizar
    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId },
      async (tx) => {
        const created = await this.repo.createWithRetryTx(
          tx,
          organizationId,
          entryData,
          lines,
          "DRAFT",
        );

        // Transicionar a POSTED
        const posted = await this.repo.updateStatusTx(
          tx,
          organizationId,
          created.id,
          "POSTED",
          userId,
        );

        // Aplicar los saldos de cuentas
        await this.balancesService.applyPost(tx, posted);

        return posted;
      },
    );
    return { ...result, correlationId };
  }

  // ── Actualizar un asiento DRAFT (o LOCKED con justificación) ──

  async updateEntry(
    organizationId: string,
    id: string,
    input: UpdateJournalEntryInput,
    role?: string,
    justification?: string,
  ): Promise<WithCorrelation<JournalEntryWithLines>> {
    const entry = await this.repo.findById(organizationId, id);
    if (!entry) throw new NotFoundError("Asiento contable");

    const status = entry.status as DocumentStatus;
    const { lines, updatedById, ...data } = input;

    if (status === "VOIDED") {
      throw new ValidationError(
        "Un asiento anulado no puede ser modificado",
        ENTRY_VOIDED_IMMUTABLE,
      );
    }

    if (status === "LOCKED") {
      const period = await this.periodsService.getById(organizationId, entry.periodId);
      validateLockedEdit(
        status,
        role!,
        period.status.value,
        justification,
      );
    } else if (status === "POSTED") {
      if (entry.sourceType) {
        const sourceTypeLabel = entry.sourceType === "dispatch" ? "despacho" : "cobro/pago";
        throw new ValidationError(
          `Este asiento fue generado automáticamente por un ${sourceTypeLabel}. Edite el documento origen para modificar el asiento.`,
          ENTRY_SYSTEM_GENERATED_IMMUTABLE,
        );
      }
      // Asiento manual — validar que el período esté OPEN y recalcular
      const period = await this.periodsService.getById(organizationId, entry.periodId);
      await validatePeriodOpen(period);

      // Validar la partida doble en las nuevas líneas
      if (lines !== undefined) {
        const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
        const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);
        if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
          throw new ValidationError("Los débitos y créditos no balancean", JOURNAL_NOT_BALANCED);
        }
      }
      return this.updatePostedManualEntryTx(organizationId, entry, input);
    }

    if (lines !== undefined) {
      if (lines.length < 2) {
        throw new ValidationError(
          "Un asiento contable debe tener al menos 2 líneas",
          MINIMUM_TWO_LINES_REQUIRED,
        );
      }

      for (const line of lines) {
        if (line.debit > 0 && line.credit > 0) {
          throw new ValidationError(
            "Una línea no puede tener débito y crédito simultáneamente",
            JOURNAL_LINE_BOTH_SIDES,
          );
        }
        if (line.debit === 0 && line.credit === 0) {
          throw new ValidationError(
            "Al menos el débito o el crédito debe ser mayor a 0",
            JOURNAL_LINE_ZERO_AMOUNT,
          );
        }
      }

      const accountCache = new Map<string, Account>();
      for (const line of lines) {
        const account = await this.accountsRepo.findById(organizationId, line.accountId);
        if (!account) throw new NotFoundError(`Cuenta ${line.accountId}`);
        if (!account.isActive) {
          throw new ValidationError(`La cuenta "${account.name}" está desactivada`);
        }
        if (!account.isDetail) {
          throw new ValidationError(
            `La cuenta "${account.name}" no es de detalle (no acepta movimientos)`,
            ACCOUNT_NOT_POSTABLE,
          );
        }
        accountCache.set(line.accountId, account);
      }

      // Validar requiresContact: si una cuenta requiere contacto, la línea debe tenerlo
      await this.validateContactsForLines(organizationId, lines, accountCache);
    }

    try {
      // Para ediciones en LOCKED, envolver en transacción con contexto de auditoría
      if (status === "LOCKED") {
        const { result, correlationId } = await withAuditTx(
          this.repo,
          { userId: updatedById, organizationId, justification },
          async (tx) => this.repo.updateTx(tx, organizationId, id, data, lines, updatedById),
        );
        return { ...result, correlationId };
      }

      // DRAFT branch — Phase 1 setAuditContext coverage (D1.b Option A) +
      // Phase 2 correlationId emission via withAuditTx.
      const { result, correlationId } = await withAuditTx(
        this.repo,
        { userId: updatedById, organizationId },
        async (tx) => this.repo.updateTx(tx, organizationId, id, data, lines, updatedById),
      );
      return { ...result, correlationId };
    } catch (error) {
      if (
        error instanceof Error &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        throw new ValidationError(
          `El número de referencia ${data.referenceNumber} ya existe para este tipo de comprobante`,
          REFERENCE_NUMBER_DUPLICATE,
        );
      }
      throw error;
    }
  }

  // ── Actualizar un asiento POSTED manual con recálculo atómico de saldos ──

  private async updatePostedManualEntryTx(
    organizationId: string,
    entry: JournalEntryWithLines,
    input: UpdateJournalEntryInput,
  ): Promise<WithCorrelation<JournalEntryWithLines>> {
    const { lines, updatedById, ...data } = input;

    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId: updatedById ?? "unknown", organizationId },
      async (tx) => {
        // Paso 1: Revertir los efectos del saldo anterior
        await this.balancesService.applyVoid(tx, entry);

        // Paso 2: Actualizar encabezado + líneas del asiento (eliminar y recrear líneas vía repo.updateTx)
        const updated = await this.repo.updateTx(tx, organizationId, entry.id, data, lines, updatedById ?? "unknown");

        // Paso 3: Aplicar los nuevos efectos de saldo
        await this.balancesService.applyPost(tx, updated);

        return updated;
      },
    );
    return { ...result, correlationId };
  }

  // ── Validar requiresContact en las líneas del asiento ──

  private async validateContactsForLines(
    organizationId: string,
    lines: JournalLineInput[],
    accountCache: Map<string, Account>,
  ): Promise<void> {
    for (const line of lines) {
      const account = accountCache.get(line.accountId);
      if (!account) continue;

      if (account.requiresContact) {
        if (!line.contactId) {
          throw new ValidationError(
            `La cuenta "${account.name}" requiere un contacto en la línea`,
            CONTACT_REQUIRED_FOR_ACCOUNT,
          );
        }
        // Verificar que el contacto esté activo (lanza ValidationError con CONTACT_NOT_FOUND si no lo está)
        await this.contactsService.getActiveById(organizationId, line.contactId);
      }
    }
  }

  // ── Obtener el último número de referencia para un tipo de comprobante ──

  async getLastReferenceNumber(
    organizationId: string,
    voucherTypeId: string,
  ): Promise<number | null> {
    await this.voucherTypesService.getById(organizationId, voucherTypeId);
    return this.repo.getLastReferenceNumber(organizationId, voucherTypeId);
  }

  async getNextNumber(
    organizationId: string,
    voucherTypeId: string,
    periodId: string,
  ): Promise<number> {
    await this.voucherTypesService.getById(organizationId, voucherTypeId);
    return this.repo.getNextNumber(organizationId, voucherTypeId, periodId);
  }

  // ── Auditoría de correlatividad ──

  async getCorrelationAudit(
    organizationId: string,
    filters: CorrelationAuditFilters,
  ): Promise<CorrelationAuditResult> {
    await this.voucherTypesService.getById(organizationId, filters.voucherTypeId);

    const { withReference, withoutReferenceCount } =
      await this.repo.findForCorrelationAudit(
        organizationId,
        filters.voucherTypeId,
        { dateFrom: filters.dateFrom, dateTo: filters.dateTo },
      );

    const gaps: CorrelationGap[] = [];
    for (let i = 1; i < withReference.length; i++) {
      const prev = withReference[i - 1].referenceNumber;
      const curr = withReference[i].referenceNumber;
      if (curr !== prev + 1) {
        gaps.push({
          from: prev + 1,
          to: curr - 1,
          count: curr - prev - 1,
        });
      }
    }

    return {
      entries: withReference,
      gaps,
      totalEntries: withReference.length + withoutReferenceCount,
      entriesWithoutReference: withoutReferenceCount,
      hasGaps: gaps.length > 0,
    };
  }

  // ── Transicionar estado ──

  async transitionStatus(
    organizationId: string,
    id: string,
    targetStatus: JournalEntryStatus,
    userId: string,
    role?: string,
    justification?: string,
  ): Promise<WithCorrelation<JournalEntryWithLines>> {
    const entry = await this.repo.findById(organizationId, id);
    if (!entry) throw new NotFoundError("Asiento contable");

    // REQ-E.1: auto-generated entries cannot be voided via the public API.
    // Internal cascades (SaleService, PurchaseService, etc.) use tx.journalEntry.update
    // directly and never call transitionStatus — so this guard is safe (D.1, D.7).
    if (targetStatus === "VOIDED" && entry.sourceType !== null) {
      throw new ValidationError(
        "Este asiento fue generado automáticamente. Para anularlo, anulá el documento de origen (Venta, Compra, Despacho o Pago).",
        AUTO_ENTRY_VOID_FORBIDDEN,
      );
    }

    if (entry.status === "VOIDED") {
      throw new ValidationError(
        "Un asiento anulado no puede ser modificado",
        ENTRY_VOIDED_IMMUTABLE,
      );
    }

    if (!canTransition(entry.status, targetStatus)) {
      throw new ValidationError(
        `No se puede pasar de ${entry.status} a ${targetStatus}`,
        INVALID_STATUS_TRANSITION,
      );
    }

    // Si se transiciona desde LOCKED, requerir rol + justificación
    if (entry.status === "LOCKED" && targetStatus === "VOIDED") {
      const period = await this.periodsService.getById(organizationId, entry.periodId);
      validateLockedEdit(
        entry.status as DocumentStatus,
        role!,
        period.status.value,
        justification,
      );
    }

    // Al contabilizar (POST): validar que el período siga OPEN y la partida doble
    if (targetStatus === "POSTED") {
      const period = await this.periodsService.getById(organizationId, entry.periodId);
      if (!period.isOpen()) {
        throw new ValidationError(
          "No se puede contabilizar un asiento en un período cerrado",
          FISCAL_PERIOD_CLOSED,
        );
      }

      const totalDebit = entry.lines.reduce((sum, l) => sum + Number(l.debit), 0);
      const totalCredit = entry.lines.reduce((sum, l) => sum + Number(l.credit), 0);

      if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
        throw new ValidationError(
          "Los débitos y créditos no balancean",
          JOURNAL_NOT_BALANCED,
        );
      }
    }

    const { result, correlationId } = await withAuditTx(
      this.repo,
      { userId, organizationId, justification },
      async (tx) => {
        const updated = await this.repo.updateStatusTx(
          tx,
          organizationId,
          id,
          targetStatus,
          userId,
        );

        if (targetStatus === "POSTED") {
          await this.balancesService.applyPost(tx, updated);
        } else if (targetStatus === "VOIDED") {
          await this.balancesService.applyVoid(tx, updated);
        }

        return updated;
      },
    );
    return { ...result, correlationId };
  }

  // ── Exportar a PDF ──

  async exportVoucherPdf(
    organizationId: string,
    entryId: string,
    opts: ExportVoucherOpts,
  ): Promise<Buffer> {
    const entry = await this.getById(organizationId, entryId);
    const profile = await this.orgProfileService.getOrCreate(organizationId);
    const sigConfig = await this.sigConfigService.getOrDefault(organizationId, "COMPROBANTE");
    const logoDataUrl = await fetchLogoAsDataUrl(profile.logoUrl);
    const period = await this.periodsService.getById(organizationId, entry.periodId);

    const input = buildVoucherPdfInput(entry, profile, sigConfig, logoDataUrl, {
      exchangeRate: opts.exchangeRate,
      ufvRate: opts.ufvRate,
      gestion: period.name,
      locality: profile.ciudad ?? "",
    });

    return renderVoucherPdf(input);
  }
}
