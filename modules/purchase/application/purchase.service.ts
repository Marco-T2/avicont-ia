import { ForbiddenError, NotFoundError } from "@/features/shared/errors";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";
import type { ContactRepository } from "@/modules/contacts/domain/contact.repository";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";
import type { AccountLookupPort } from "@/modules/org-settings/domain/ports/account-lookup.port";
import type { FiscalPeriodsReadPort } from "@/modules/accounting/domain/ports/fiscal-periods-read.port";
import { isDateWithinPeriod } from "@/modules/fiscal-periods/domain/date-period-check";
import type { JournalEntriesReadPort } from "@/modules/accounting/domain/ports/journal-entries-read.port";
import type { OrgSettingsReaderPort } from "@/modules/sale/domain/ports/org-settings-reader.port";
import {
  Purchase,
  type ApplyPurchaseEditInput,
  type CreatePurchaseDraftDetailInput,
  type CreatePurchaseDraftInput,
  type PurchaseType,
} from "../domain/purchase.entity";
import { PurchaseDetail } from "../domain/purchase-detail.entity";
import { PurchaseVoidedImmutable } from "../domain/errors/purchase-errors";
import type {
  PurchaseFilters,
  PurchaseRepository,
} from "../domain/ports/purchase.repository";
import type { PurchasePermissionsPort } from "../domain/ports/purchase-permissions.port";
import type { IvaBookReaderPort } from "../domain/ports/iva-book-reader.port";
import type { PayableRepository } from "@/modules/payables/domain/payable.repository";
import {
  computeTrimPlan,
  type TrimPreviewItem,
} from "../domain/compute-trim-plan";
import { computePfSummary } from "../domain/compute-pf-summary";
import {
  buildPurchaseEntryLines,
  type IvaBookForEntry,
  type PurchaseDetailForEntry,
} from "../domain/build-purchase-entry-lines";
import {
  PurchaseAccountNotFound,
  PurchaseContactChangeWithAllocations,
  PurchaseContactInactive,
  PurchaseContactNotProvider,
  PurchaseLockedEditMissingJustification,
  PurchaseDateOutsidePeriod,
  PurchasePeriodClosed,
  PurchasePostNotAllowedForRole,
} from "./errors/purchase-orchestration-errors";
import type { PurchaseUnitOfWork } from "./purchase-unit-of-work";

const TYPE_PREFIXES: Record<PurchaseType, string> = {
  FLETE: "FL",
  POLLO_FAENADO: "PF",
  COMPRA_GENERAL: "CG",
  SERVICIO: "SV",
};

/**
 * `PurchaseServiceDeps` — object DI patrón consolidado durante POC #11.0a
 * A2 Ciclo 5b sale-hex (Marco trigger 6+ deps opcionales). Sólo `repo` es
 * obligatorio en C1; el resto entra conforme los use cases landeen
 * (§11.1 STICK on-arrival).
 */
export interface PurchaseServiceDeps {
  repo: PurchaseRepository;
  payables?: PayableRepository;
  contacts?: ContactRepository;
  uow?: PurchaseUnitOfWork;
  purchasePermissions?: PurchasePermissionsPort;
  accountLookup?: AccountLookupPort;
  orgSettings?: OrgSettingsReaderPort;
  fiscalPeriods?: FiscalPeriodsReadPort;
  ivaBookReader?: IvaBookReaderPort;
  journalEntriesRead?: JournalEntriesReadPort;
}

export interface EditPreview {
  trimPreview: TrimPreviewItem[];
}

export type CreateDraftInput = Omit<
  CreatePurchaseDraftInput,
  "organizationId" | "createdById"
>;

export interface CreateDraftResult {
  purchase: Purchase;
  correlationId: string;
}

export interface PostPurchaseResult {
  purchase: Purchase;
  correlationId: string;
}

export interface UpdatePurchaseInput extends ApplyPurchaseEditInput {
  details?: CreatePurchaseDraftDetailInput[];
}

export interface UpdatePurchaseContext {
  userId: string;
  role?: string;
  justification?: string;
}

export interface UpdatePurchaseResult {
  purchase: Purchase;
  correlationId: string;
}

export class PurchaseService {
  constructor(private readonly deps: PurchaseServiceDeps) {}

  async list(
    organizationId: string,
    filters?: PurchaseFilters,
  ): Promise<Purchase[]> {
    return this.deps.repo.findAll(organizationId, filters);
  }

  async listPaginated(
    organizationId: string,
    filters?: PurchaseFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<Purchase>> {
    return this.deps.repo.findPaginated(organizationId, filters, pagination);
  }

  async getById(organizationId: string, id: string): Promise<Purchase> {
    const found = await this.deps.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Compra");
    return found;
  }

  /**
   * Simulates the LIFO trim plan for an `editPosted` operation that would
   * lower the purchase's total to `newTotal`. Read-only — no DB writes.
   * Mirrors legacy `purchase.service.ts:779-813` (fidelidad regla #1) y
   * espejo simétrico de sale-hex `getEditPreview`.
   */
  async getEditPreview(
    organizationId: string,
    purchaseId: string,
    newTotal: number,
  ): Promise<EditPreview> {
    if (!this.deps.payables) {
      throw new Error(
        "PurchaseService.getEditPreview requires PayableRepository — inject in constructor",
      );
    }

    const purchase = await this.getById(organizationId, purchaseId);
    if (!purchase.payableId) {
      return { trimPreview: [] };
    }

    const payable = await this.deps.payables.findById(
      organizationId,
      purchase.payableId,
    );
    const rawPaid = payable ? Number(payable.paid.value) : 0;

    if (newTotal >= rawPaid) {
      return { trimPreview: [] };
    }

    const allocations =
      await this.deps.payables.findAllocationsForPayable(
        organizationId,
        purchase.payableId,
      );

    return { trimPreview: computeTrimPlan(allocations, rawPaid - newTotal) };
  }

  /**
   * Creates a purchase in DRAFT status. Mirrors legacy
   * `purchase.service.ts:316-369` (fidelidad regla #1) — valida contact
   * existence, active status, y `PROVEEDOR` type antes de delegar a
   * `Purchase.createDraft` (que enforcea CG/SV expenseAccountId vía
   * `assertExpenseAccountsSetForType` post-D1.4b A1 C6). Para POLLO_FAENADO
   * el use case calcula `computePfSummary(input.details)` para hidratar
   * los totalKg fields header (decisión D3 β thin aggregate A1 — aggregate
   * desconoce composición, use case asume responsabilidad). Persiste dentro
   * de UoW para audit context trigger.
   */
  async createDraft(
    organizationId: string,
    input: CreateDraftInput,
    userId: string,
  ): Promise<CreateDraftResult> {
    if (!this.deps.contacts) {
      throw new Error(
        "PurchaseService.createDraft requires ContactRepository",
      );
    }
    if (!this.deps.uow) {
      throw new Error("PurchaseService.createDraft requires PurchaseUnitOfWork");
    }

    const contact = await this.deps.contacts.findById(
      organizationId,
      input.contactId,
    );
    if (!contact) throw new ContactNotFound();
    if (!contact.isActive) throw new PurchaseContactInactive(input.contactId);
    if (contact.type !== "PROVEEDOR") {
      throw new PurchaseContactNotProvider(contact.type);
    }

    // I12 — defense in depth: createDraft NO valida period status (preserva
    // el comportamiento legacy de DRAFT en CLOSED), pero SÍ exige date∈período.
    if (this.deps.fiscalPeriods) {
      const period = await this.deps.fiscalPeriods.getById(
        organizationId,
        input.periodId,
      );
      if (!isDateWithinPeriod(input.date, period)) {
        throw new PurchaseDateOutsidePeriod(input.date, period.name);
      }
    }

    const pfSummary =
      input.purchaseType === "POLLO_FAENADO"
        ? computePfSummary(input.details)
        : undefined;

    const purchase = Purchase.createDraft({
      ...input,
      organizationId,
      createdById: userId,
      ...(pfSummary
        ? {
            totalGrossKg: pfSummary.totalGrossKg,
            totalNetKg: pfSummary.totalNetKg,
            totalShrinkKg: pfSummary.totalShrinkKg,
            totalShortageKg: pfSummary.totalShortageKg,
            totalRealNetKg: pfSummary.totalRealNetKg,
          }
        : {}),
    });

    const { result, correlationId } = await this.deps.uow.run(
      { userId, organizationId },
      (scope) => scope.purchases.saveTx(purchase),
    );

    return { purchase: result, correlationId };
  }

  /**
   * Posts a purchase (DRAFT → POSTED). Mirrors legacy
   * `purchase.service.ts:373-501` (fidelidad regla #1) — espejo simétrico
   * a sale-hex `post`. Resuelve fiscal period + accounts + IVA book OUTSIDE
   * la UoW; abre la tx para asignar sequence, generar journal entry,
   * aplicar balances, crear payable, y linkear el aggregate.
   *
   * Asimetrías documentadas vs sale-hex:
   * - `voucherTypeCode: "CE"` (paridad legacy purchase.service.ts:460).
   * - `displayCode` con prefix por purchaseType (FL/PF/CG/SV).
   * - `accountLookup.findManyByIds` solo para CG/SV (FLETE/POLLO_FAENADO
   *   usan codes de OrgSettings, no IDs).
   * - `IvaBookReaderPort.getActiveBookForPurchase` (port propio purchase).
   * - `PayableRepository` (paralelo a sale-hex `ReceivableRepository`).
   */
  async post(
    organizationId: string,
    purchaseId: string,
    userId: string,
  ): Promise<PostPurchaseResult> {
    const required = {
      contacts: this.deps.contacts,
      payables: this.deps.payables,
      uow: this.deps.uow,
      accountLookup: this.deps.accountLookup,
      orgSettings: this.deps.orgSettings,
      fiscalPeriods: this.deps.fiscalPeriods,
      ivaBookReader: this.deps.ivaBookReader,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) throw new Error(`PurchaseService.post requires ${name}`);
    }

    const purchase = await this.getById(organizationId, purchaseId);

    const period = await this.deps.fiscalPeriods!.getById(
      organizationId,
      purchase.periodId,
    );
    if (period.status === "CLOSED") {
      throw new PurchasePeriodClosed(purchase.periodId);
    }
    // I12 — date∈período antes del POST.
    if (!isDateWithinPeriod(purchase.date, period)) {
      throw new PurchaseDateOutsidePeriod(purchase.date, period.name);
    }

    const posted = purchase.post();

    const expenseAccountIds =
      posted.purchaseType === "COMPRA_GENERAL" ||
      posted.purchaseType === "SERVICIO"
        ? posted.details
            .map((d) => d.expenseAccountId)
            .filter((id): id is string => !!id)
        : [];

    const accounts = await this.deps.accountLookup!.findManyByIds(
      organizationId,
      expenseAccountIds,
    );
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    for (const id of expenseAccountIds) {
      if (!accountById.has(id)) throw new PurchaseAccountNotFound(id);
    }

    const settings = await this.deps.orgSettings!.getOrCreate(organizationId);
    const settingsSnapshot = settings.toSnapshot();

    const ivaSnapshot = await this.deps.ivaBookReader!.getActiveBookForPurchase(
      organizationId,
      purchaseId,
    );
    const ivaBook: IvaBookForEntry | undefined = ivaSnapshot
      ? {
          baseIvaSujetoCf: ivaSnapshot.netAmount,
          dfCfIva: ivaSnapshot.ivaAmount,
          importeTotal: posted.totalAmount.value,
          exentos: ivaSnapshot.exentos,
        }
      : undefined;

    const detailsForEntry: PurchaseDetailForEntry[] = posted.details.map((d) => ({
      lineAmount: d.lineAmount.value,
      expenseAccountCode: d.expenseAccountId
        ? accountById.get(d.expenseAccountId)?.code ?? null
        : null,
      description: d.description,
    }));

    const entryLines = buildPurchaseEntryLines(
      posted.purchaseType,
      posted.totalAmount.value,
      detailsForEntry,
      {
        cxpAccountCode: settingsSnapshot.cxpAccountCode,
        fleteExpenseAccountCode: settingsSnapshot.fleteExpenseAccountCode,
        polloFaenadoCOGSAccountCode: settingsSnapshot.polloFaenadoCOGSAccountCode,
      },
      posted.contactId,
      ivaBook,
    );

    const contact = await this.deps.contacts!.findById(
      organizationId,
      posted.contactId,
    );
    if (!contact) throw new ContactNotFound();
    const paymentTermsDays = contact.paymentTermsDays;

    const { result, correlationId } = await this.deps.uow!.run(
      { userId, organizationId },
      async (scope) => {
        const seq = await scope.purchases.getNextSequenceNumberTx(organizationId, posted.purchaseType);
        const numbered = posted.assignSequenceNumber(seq);

        const displayCode = `${TYPE_PREFIXES[numbered.purchaseType]}-${String(seq).padStart(3, "0")}`;
        const journalDescription = numbered.notes
          ? `${displayCode} - ${numbered.description} | ${numbered.notes}`
          : `${displayCode} - ${numbered.description}`;

        const journal = await scope.journalEntryFactory.generateForPurchase({
          organizationId,
          contactId: numbered.contactId,
          date: numbered.date,
          periodId: numbered.periodId,
          description: journalDescription,
          sourceType: "purchase",
          sourceId: numbered.id,
          createdById: userId,
          lines: entryLines.map((l) => ({
            accountCode: l.accountCode,
            side: l.debit > 0 ? ("DEBIT" as const) : ("CREDIT" as const),
            amount: l.debit > 0 ? l.debit : l.credit,
            contactId: l.contactId,
            description: l.description,
          })),
        });

        await scope.accountBalances.applyPost(journal);

        const dueDate = new Date(
          numbered.date.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
        );
        const payable = await scope.payables.createTx(undefined, {
          organizationId,
          contactId: numbered.contactId,
          description: journalDescription,
          amount: numbered.totalAmount.value,
          dueDate,
          sourceType: "purchase",
          sourceId: numbered.id,
          journalEntryId: journal.id,
        });

        const linked = numbered.linkJournal(journal.id).linkPayable(payable.id);
        return scope.purchases.updateTx(linked, { replaceDetails: false });
      },
    );

    return { purchase: result, correlationId };
  }

  /**
   * Atomic create + post — DRAFT y POSTED en una sola tx. Mirrors legacy
   * `purchase.service.ts:505-668` (fidelidad regla #1) y espejo simétrico
   * sale-hex `createAndPost`. RBAC `canPost("purchases")` corre ANTES de
   * entrar a la UoW (paridad legacy: requests denegados nunca abren tx
   * Postgres). NO IVA snapshot lookup — sólo `post()` consulta el IVA book
   * (createAndPost es fast path para compras no-IVA).
   */
  async createAndPost(
    organizationId: string,
    input: CreateDraftInput,
    context: { userId: string; role: string },
  ): Promise<PostPurchaseResult> {
    const required = {
      contacts: this.deps.contacts,
      payables: this.deps.payables,
      uow: this.deps.uow,
      accountLookup: this.deps.accountLookup,
      orgSettings: this.deps.orgSettings,
      fiscalPeriods: this.deps.fiscalPeriods,
      purchasePermissions: this.deps.purchasePermissions,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) throw new Error(`PurchaseService.createAndPost requires ${name}`);
    }

    const allowed = await this.deps.purchasePermissions!.canPost(
      context.role,
      "purchases",
      organizationId,
    );
    if (!allowed) throw new PurchasePostNotAllowedForRole(context.role);

    const contact = await this.deps.contacts!.findById(
      organizationId,
      input.contactId,
    );
    if (!contact) throw new ContactNotFound();
    if (!contact.isActive) throw new PurchaseContactInactive(input.contactId);
    if (contact.type !== "PROVEEDOR") {
      throw new PurchaseContactNotProvider(contact.type);
    }

    const period = await this.deps.fiscalPeriods!.getById(
      organizationId,
      input.periodId,
    );
    if (period.status === "CLOSED") {
      throw new PurchasePeriodClosed(input.periodId);
    }
    // I12 — date∈período (createAndPost: el purchase nace con input.date + input.periodId).
    if (!isDateWithinPeriod(input.date, period)) {
      throw new PurchaseDateOutsidePeriod(input.date, period.name);
    }

    const pfSummary =
      input.purchaseType === "POLLO_FAENADO"
        ? computePfSummary(input.details)
        : undefined;

    const posted = Purchase.createDraft({
      ...input,
      organizationId,
      createdById: context.userId,
      ...(pfSummary
        ? {
            totalGrossKg: pfSummary.totalGrossKg,
            totalNetKg: pfSummary.totalNetKg,
            totalShrinkKg: pfSummary.totalShrinkKg,
            totalShortageKg: pfSummary.totalShortageKg,
            totalRealNetKg: pfSummary.totalRealNetKg,
          }
        : {}),
    }).post();

    const expenseAccountIds =
      posted.purchaseType === "COMPRA_GENERAL" ||
      posted.purchaseType === "SERVICIO"
        ? posted.details
            .map((d) => d.expenseAccountId)
            .filter((id): id is string => !!id)
        : [];

    const accounts = await this.deps.accountLookup!.findManyByIds(
      organizationId,
      expenseAccountIds,
    );
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    for (const id of expenseAccountIds) {
      if (!accountById.has(id)) throw new PurchaseAccountNotFound(id);
    }

    const settings = await this.deps.orgSettings!.getOrCreate(organizationId);
    const settingsSnapshot = settings.toSnapshot();

    const detailsForEntry: PurchaseDetailForEntry[] = posted.details.map((d) => ({
      lineAmount: d.lineAmount.value,
      expenseAccountCode: d.expenseAccountId
        ? accountById.get(d.expenseAccountId)?.code ?? null
        : null,
      description: d.description,
    }));

    const entryLines = buildPurchaseEntryLines(
      posted.purchaseType,
      posted.totalAmount.value,
      detailsForEntry,
      {
        cxpAccountCode: settingsSnapshot.cxpAccountCode,
        fleteExpenseAccountCode: settingsSnapshot.fleteExpenseAccountCode,
        polloFaenadoCOGSAccountCode: settingsSnapshot.polloFaenadoCOGSAccountCode,
      },
      posted.contactId,
    );

    const paymentTermsDays = contact.paymentTermsDays;

    const { result, correlationId } = await this.deps.uow!.run(
      { userId: context.userId, organizationId },
      async (scope) => {
        const seq = await scope.purchases.getNextSequenceNumberTx(organizationId, posted.purchaseType);
        const numbered = posted.assignSequenceNumber(seq);

        const displayCode = `${TYPE_PREFIXES[numbered.purchaseType]}-${String(seq).padStart(3, "0")}`;
        const journalDescription = numbered.notes
          ? `${displayCode} - ${numbered.description} | ${numbered.notes}`
          : `${displayCode} - ${numbered.description}`;

        const journal = await scope.journalEntryFactory.generateForPurchase({
          organizationId,
          contactId: numbered.contactId,
          date: numbered.date,
          periodId: numbered.periodId,
          description: journalDescription,
          sourceType: "purchase",
          sourceId: numbered.id,
          createdById: context.userId,
          lines: entryLines.map((l) => ({
            accountCode: l.accountCode,
            side: l.debit > 0 ? ("DEBIT" as const) : ("CREDIT" as const),
            amount: l.debit > 0 ? l.debit : l.credit,
            contactId: l.contactId,
            description: l.description,
          })),
        });

        await scope.accountBalances.applyPost(journal);

        const dueDate = new Date(
          numbered.date.getTime() + paymentTermsDays * 24 * 60 * 60 * 1000,
        );
        const payable = await scope.payables.createTx(undefined, {
          organizationId,
          contactId: numbered.contactId,
          description: journalDescription,
          amount: numbered.totalAmount.value,
          dueDate,
          sourceType: "purchase",
          sourceId: numbered.id,
          journalEntryId: journal.id,
        });

        const linked = numbered
          .linkJournal(journal.id)
          .linkPayable(payable.id);
        return scope.purchases.saveTx(linked);
      },
    );

    return { purchase: result, correlationId };
  }

  /**
   * Updates a purchase. Mirrors legacy `purchase.service.ts:669-769` (fidelidad
   * regla #1) — espejo simétrico a sale-hex `update`.
   *
   * - DRAFT: header + optional details replace.
   * - LOCKED: header + optional details replace (paridad legacy
   *   `purchase.service.ts:710-749` — pasa `computedDetails + pfSummary` al
   *   `repo.updateTx`). Gates role (`owner`/`admin`) + period status
   *   (CLOSED → 50 char min; OPEN → 10). Audit userId atribuye al creador
   *   original (`purchase.createdById`), NO al editor actual (paridad
   *   legacy `:741` `userId: purchase.createdById ?? "unknown"`).
   * - POSTED: atomic revert-modify-reapply cascade (private updatePosted).
   * - VOIDED: rejected via `PurchaseVoidedImmutable` (domain).
   */
  async update(
    organizationId: string,
    purchaseId: string,
    input: UpdatePurchaseInput,
    context: UpdatePurchaseContext,
  ): Promise<UpdatePurchaseResult> {
    if (!this.deps.contacts) {
      throw new Error("PurchaseService.update requires ContactRepository");
    }
    if (!this.deps.uow) {
      throw new Error("PurchaseService.update requires PurchaseUnitOfWork");
    }

    const purchase = await this.getById(organizationId, purchaseId);

    if (purchase.status === "VOIDED") throw new PurchaseVoidedImmutable();

    if (purchase.status === "POSTED") {
      return this.updatePosted(organizationId, purchase, input, context);
    }

    if (purchase.status === "LOCKED") {
      if (!this.deps.fiscalPeriods) {
        throw new Error(
          "PurchaseService.update LOCKED branch requires FiscalPeriodsReadPort",
        );
      }
      if (context.role !== "owner" && context.role !== "admin") {
        throw new ForbiddenError(
          "Solo administradores pueden modificar documentos bloqueados",
        );
      }
      const period = await this.deps.fiscalPeriods.getById(
        organizationId,
        purchase.periodId,
      );
      const requiredMin = period.status === "CLOSED" ? 50 : 10;
      if (
        !context.justification ||
        context.justification.trim().length < requiredMin
      ) {
        throw new PurchaseLockedEditMissingJustification(requiredMin);
      }
    }

    if (input.contactId !== undefined) {
      const contact = await this.deps.contacts.findById(
        organizationId,
        input.contactId,
      );
      if (!contact) throw new ContactNotFound();
      if (!contact.isActive) throw new PurchaseContactInactive(input.contactId);
      if (contact.type !== "PROVEEDOR") {
        throw new PurchaseContactNotProvider(contact.type);
      }
    }

    let edited = purchase.applyEdit({
      date: input.date,
      description: input.description,
      contactId: input.contactId,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
    });

    const replaceDetails =
      (purchase.status === "DRAFT" || purchase.status === "LOCKED") &&
      input.details !== undefined;

    if (replaceDetails) {
      const newDetails = input.details!.map((d, idx) =>
        PurchaseDetail.create({
          purchaseId: edited.id,
          description: d.description,
          lineAmount: d.lineAmount,
          order: d.order ?? idx,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          expenseAccountId: d.expenseAccountId,
          fecha: d.fecha,
          docRef: d.docRef,
          chickenQty: d.chickenQty,
          pricePerChicken: d.pricePerChicken,
          productTypeId: d.productTypeId,
          detailNote: d.detailNote,
          boxes: d.boxes,
          grossWeight: d.grossWeight,
          tare: d.tare,
          netWeight: d.netWeight,
          shrinkage: d.shrinkage,
          shortage: d.shortage,
          realNetWeight: d.realNetWeight,
        }),
      );
      edited = edited.replaceDetails(newDetails);
    }

    const auditContext =
      purchase.status === "LOCKED"
        ? {
            userId: purchase.createdById ?? "unknown",
            organizationId,
            justification: context.justification,
          }
        : { userId: context.userId, organizationId };

    const { result, correlationId } = await this.deps.uow.run(
      auditContext,
      (scope) => scope.purchases.updateTx(edited, { replaceDetails }),
    );

    return { purchase: result, correlationId };
  }

  /**
   * POSTED edit flow. Mirrors legacy `purchase.service.ts:817-1093` (fidelidad
   * regla #1) — espejo simétrico a sale-hex `updatePosted`. Atomic revert-
   * modify-reapply cascade: pre-validar contact change + load+regenerate
   * journal + applyVoid old + applyPost new + payable amount mutate + LIFO
   * trim allocations.
   */
  private async updatePosted(
    organizationId: string,
    purchase: Purchase,
    input: UpdatePurchaseInput,
    context: UpdatePurchaseContext,
  ): Promise<UpdatePurchaseResult> {
    const required = {
      uow: this.deps.uow,
      contacts: this.deps.contacts,
      accountLookup: this.deps.accountLookup,
      orgSettings: this.deps.orgSettings,
      fiscalPeriods: this.deps.fiscalPeriods,
      payables: this.deps.payables,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) {
        throw new Error(`PurchaseService.update POSTED branch requires ${name}`);
      }
    }

    const period = await this.deps.fiscalPeriods!.getById(
      organizationId,
      purchase.periodId,
    );
    if (period.status === "CLOSED") {
      throw new PurchasePeriodClosed(purchase.periodId);
    }
    // I12 — si la fecha cambia en update, la nueva debe caer en el período del purchase.
    if (input.date !== undefined && !isDateWithinPeriod(input.date, period)) {
      throw new PurchaseDateOutsidePeriod(input.date, period.name);
    }

    if (
      input.contactId !== undefined &&
      input.contactId !== purchase.contactId &&
      purchase.payableId
    ) {
      const allocations =
        await this.deps.payables!.findAllocationsForPayable(
          organizationId,
          purchase.payableId,
        );
      if (allocations.length > 0) {
        throw new PurchaseContactChangeWithAllocations();
      }
    }

    if (input.contactId !== undefined) {
      const contact = await this.deps.contacts!.findById(
        organizationId,
        input.contactId,
      );
      if (!contact) throw new ContactNotFound();
      if (!contact.isActive) throw new PurchaseContactInactive(input.contactId);
      if (contact.type !== "PROVEEDOR") {
        throw new PurchaseContactNotProvider(contact.type);
      }
    }

    let edited = purchase.applyEdit({
      date: input.date,
      description: input.description,
      contactId: input.contactId,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
    });
    const replaceDetails = input.details !== undefined;
    if (replaceDetails) {
      const newDetails = input.details!.map((d, idx) =>
        PurchaseDetail.create({
          purchaseId: edited.id,
          description: d.description,
          lineAmount: d.lineAmount,
          order: d.order ?? idx,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          expenseAccountId: d.expenseAccountId,
          fecha: d.fecha,
          docRef: d.docRef,
          chickenQty: d.chickenQty,
          pricePerChicken: d.pricePerChicken,
          productTypeId: d.productTypeId,
          detailNote: d.detailNote,
          boxes: d.boxes,
          grossWeight: d.grossWeight,
          tare: d.tare,
          netWeight: d.netWeight,
          shrinkage: d.shrinkage,
          shortage: d.shortage,
          realNetWeight: d.realNetWeight,
        }),
      );
      edited = edited.replaceDetails(newDetails);
    }

    const expenseAccountIds =
      edited.purchaseType === "COMPRA_GENERAL" ||
      edited.purchaseType === "SERVICIO"
        ? edited.details
            .map((d) => d.expenseAccountId)
            .filter((id): id is string => !!id)
        : [];

    const accounts = await this.deps.accountLookup!.findManyByIds(
      organizationId,
      expenseAccountIds,
    );
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    for (const id of expenseAccountIds) {
      if (!accountById.has(id)) throw new PurchaseAccountNotFound(id);
    }

    const settings = await this.deps.orgSettings!.getOrCreate(organizationId);
    const settingsSnapshot = settings.toSnapshot();

    const detailsForEntry: PurchaseDetailForEntry[] = edited.details.map((d) => ({
      lineAmount: d.lineAmount.value,
      expenseAccountCode: d.expenseAccountId
        ? accountById.get(d.expenseAccountId)?.code ?? null
        : null,
      description: d.description,
    }));

    const { result, correlationId } = await this.deps.uow!.run(
      { userId: context.userId, organizationId },
      async (scope) => {
        const newIvaBook = await scope.ivaBookRegenNotifier.recomputeFromPurchase(
          organizationId,
          edited.id,
          edited.totalAmount.value,
        );

        const entryLines = buildPurchaseEntryLines(
          edited.purchaseType,
          edited.totalAmount.value,
          detailsForEntry,
          {
            cxpAccountCode: settingsSnapshot.cxpAccountCode,
            fleteExpenseAccountCode: settingsSnapshot.fleteExpenseAccountCode,
            polloFaenadoCOGSAccountCode:
              settingsSnapshot.polloFaenadoCOGSAccountCode,
          },
          edited.contactId,
          newIvaBook ?? undefined,
        );

        const displayCode = `${TYPE_PREFIXES[edited.purchaseType]}-${String(edited.sequenceNumber).padStart(3, "0")}`;
        const journalDescription = edited.notes
          ? `${displayCode} - ${edited.description} | ${edited.notes}`
          : `${displayCode} - ${edited.description}`;

        const { old, new: newJournal } =
          await scope.journalEntryFactory.regenerateForPurchaseEdit(
            edited.journalEntryId!,
            {
              organizationId,
              contactId: edited.contactId,
              date: edited.date,
              periodId: edited.periodId,
              description: journalDescription,
              sourceType: "purchase",
              sourceId: edited.id,
              createdById: context.userId,
              lines: entryLines.map((l) => ({
                accountCode: l.accountCode,
                side: l.debit > 0 ? ("DEBIT" as const) : ("CREDIT" as const),
                amount: l.debit > 0 ? l.debit : l.credit,
                contactId: l.contactId,
                description: l.description,
              })),
            },
          );

        await scope.accountBalances.applyVoid(old);
        const persistedPurchase = await scope.purchases.updateTx(edited, {
          replaceDetails,
        });
        await scope.accountBalances.applyPost(newJournal);

        if (edited.payableId) {
          const payable = await scope.payables.findById(
            organizationId,
            edited.payableId,
          );
          if (payable && payable.status !== "VOIDED") {
            let updatedPayable = payable.recomputeForPurchaseEdit(
              edited.totalAmount,
            );
            if (payable.contactId !== edited.contactId) {
              updatedPayable = updatedPayable.changeContact(edited.contactId);
            }
            await scope.payables.update(updatedPayable);

            if (payable.paid.value > edited.totalAmount.value) {
              const allocations =
                await scope.payables.findAllocationsForPayable(
                  organizationId,
                  edited.payableId,
                );
              const excess = payable.paid.value - edited.totalAmount.value;
              const trimPlan = computeTrimPlan(allocations, excess);
              const trimItems = trimPlan.map((p) => ({
                allocationId: p.allocationId,
                newAmount: parseFloat(p.trimmedTo),
              }));
              await scope.payables.applyTrimPlanTx(
                undefined,
                organizationId,
                edited.payableId,
                trimItems,
              );
            }
          }
        }

        return persistedPurchase;
      },
    );

    return { purchase: result, correlationId };
  }

  /**
   * Voids a purchase (DRAFT/POSTED/LOCKED → VOIDED). Mirrors legacy
   * `purchase.service.ts:1095-1128 + voidCascadeTx 1280-1398` (fidelidad
   * regla #1) — espejo simétrico a sale-hex `void`. LOCKED gate replicates
   * `validateLockedEdit` (role + period + justification 10/50). Cascade:
   * revert payable allocations → trim allocations to zero → void payable →
   * persist purchase VOIDED → IVA book void → journal void + balances
   * applyVoid.
   */
  async void(
    organizationId: string,
    purchaseId: string,
    context: UpdatePurchaseContext,
  ): Promise<UpdatePurchaseResult> {
    const required = {
      uow: this.deps.uow,
      fiscalPeriods: this.deps.fiscalPeriods,
      journalEntriesRead: this.deps.journalEntriesRead,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) throw new Error(`PurchaseService.void requires ${name}`);
    }

    const purchase = await this.getById(organizationId, purchaseId);

    if (purchase.status === "LOCKED") {
      if (context.role !== "owner" && context.role !== "admin") {
        throw new ForbiddenError(
          "Solo administradores pueden modificar documentos bloqueados",
        );
      }
      const period = await this.deps.fiscalPeriods!.getById(
        organizationId,
        purchase.periodId,
      );
      const requiredMin = period.status === "CLOSED" ? 50 : 10;
      if (
        !context.justification ||
        context.justification.trim().length < requiredMin
      ) {
        throw new PurchaseLockedEditMissingJustification(requiredMin);
      }
    }

    const voided = purchase.void();

    const auditContext =
      purchase.status === "LOCKED"
        ? {
            userId: context.userId,
            organizationId,
            justification: context.justification,
          }
        : { userId: context.userId, organizationId };

    const { result, correlationId } = await this.deps.uow!.run(
      auditContext,
      async (scope) => {
        if (purchase.payableId) {
          const allocations =
            await scope.payables.findAllocationsForPayable(
              organizationId,
              purchase.payableId,
            );
          const active = allocations.filter((a) => a.amount > 0);

          if (active.length > 0) {
            const trimItems = active.map((a) => ({
              allocationId: a.id,
              newAmount: 0,
            }));
            await scope.payables.applyTrimPlanTx(
              undefined,
              organizationId,
              purchase.payableId,
              trimItems,
            );

            const payable = await scope.payables.findById(
              organizationId,
              purchase.payableId,
            );
            if (payable && payable.status !== "VOIDED") {
              const totalReverted = active.reduce(
                (sum, a) => sum + a.amount,
                0,
              );
              const reverted = payable.revertAllocations(
                MonetaryAmount.of(totalReverted),
              );
              const finalPayable = reverted.void();
              await scope.payables.update(finalPayable);
            }
          } else {
            const payable = await scope.payables.findById(
              organizationId,
              purchase.payableId,
            );
            if (payable && payable.status !== "VOIDED") {
              await scope.payables.update(payable.void());
            }
          }
        }

        const persistedPurchase = await scope.purchases.updateTx(voided, {
          replaceDetails: false,
        });

        await scope.ivaBookVoidCascade.markVoidedFromPurchase(
          organizationId,
          purchaseId,
        );

        if (purchase.journalEntryId) {
          const oldJournal = await this.deps.journalEntriesRead!.findById(
            organizationId,
            purchase.journalEntryId,
          );
          if (oldJournal && oldJournal.status !== "VOIDED") {
            const voidedJournal = oldJournal.void();
            const persistedJournal = await scope.journalEntries.updateStatus(
              voidedJournal,
              context.userId,
            );
            await scope.accountBalances.applyVoid(persistedJournal);
          }
        }

        return persistedPurchase;
      },
    );

    return { purchase: result, correlationId };
  }

  /**
   * Hard-deletes a DRAFT purchase. Mirrors legacy
   * `purchase.service.ts:1132-1143`. No UoW — operación single-row delete
   * sin cascade. Domain enforcea status === DRAFT vía
   * `Purchase.assertCanDelete()` (A1).
   */
  async delete(organizationId: string, purchaseId: string): Promise<void> {
    const purchase = await this.getById(organizationId, purchaseId);
    purchase.assertCanDelete();
    await this.deps.repo.deleteTx(organizationId, purchaseId);
  }

  /**
   * Regenerates the journal entry of a posted purchase when the IVA book
   * changes. Mirrors legacy `purchase.service.ts:1157-1278` (fidelidad
   * regla #1) WITHOUT `externalTx + correlationId` delegation (legacy
   * complexity §5.5 retired in POC #11.0c — caller invoca su propia UoW
   * si coordinated tx es needed). Espejo simétrico sale-hex
   * `regenerateJournalForIvaChange`.
   *
   * Flow: load purchase + period OPEN check + accounts + IVA snapshot +
   * entry lines OUTSIDE UoW; factory.regenerateForPurchaseEdit → applyVoid
   * old + applyPost new INSIDE. Purchase aggregate unchanged — solo el
   * journal mutates. Period check outside-UoW (paridad sale-hex; legacy
   * `:1238-1240` lo replica in-tx por race protection — replicación
   * estricta diferida POC #11.0c con IVA service real).
   *
   * **Period gate** — purchase-hex SÍ valida periodo inside (asimetría
   * deliberada con sale-hex que NO valida). IVA-hex consumer replica el
   * gate en su lado para uniformar ambos paths per D-A1#4 elevation lock —
   * ver `modules/iva-books/domain/ports/fiscal-period-reader.port.ts:8-26`.
   */
  async regenerateJournalForIvaChange(
    organizationId: string,
    purchaseId: string,
    userId: string,
  ): Promise<UpdatePurchaseResult> {
    const required = {
      uow: this.deps.uow,
      accountLookup: this.deps.accountLookup,
      orgSettings: this.deps.orgSettings,
      ivaBookReader: this.deps.ivaBookReader,
      fiscalPeriods: this.deps.fiscalPeriods,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) {
        throw new Error(
          `PurchaseService.regenerateJournalForIvaChange requires ${name}`,
        );
      }
    }

    const purchase = await this.getById(organizationId, purchaseId);
    if (!purchase.journalEntryId) {
      throw new NotFoundError("Asiento contable");
    }

    const period = await this.deps.fiscalPeriods!.getById(
      organizationId,
      purchase.periodId,
    );
    if (period.status === "CLOSED") {
      throw new PurchasePeriodClosed(purchase.periodId);
    }
    // I12 — date∈período antes de regenerar el journal entry asociado.
    if (!isDateWithinPeriod(purchase.date, period)) {
      throw new PurchaseDateOutsidePeriod(purchase.date, period.name);
    }

    const expenseAccountIds =
      purchase.purchaseType === "COMPRA_GENERAL" ||
      purchase.purchaseType === "SERVICIO"
        ? purchase.details
            .map((d) => d.expenseAccountId)
            .filter((id): id is string => !!id)
        : [];

    const accounts = await this.deps.accountLookup!.findManyByIds(
      organizationId,
      expenseAccountIds,
    );
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    for (const id of expenseAccountIds) {
      if (!accountById.has(id)) throw new PurchaseAccountNotFound(id);
    }

    const settings = await this.deps.orgSettings!.getOrCreate(organizationId);
    const settingsSnapshot = settings.toSnapshot();

    const ivaSnapshot = await this.deps.ivaBookReader!.getActiveBookForPurchase(
      organizationId,
      purchaseId,
    );
    const ivaBook: IvaBookForEntry | undefined = ivaSnapshot
      ? {
          baseIvaSujetoCf: ivaSnapshot.netAmount,
          dfCfIva: ivaSnapshot.ivaAmount,
          importeTotal: purchase.totalAmount.value,
          exentos: ivaSnapshot.exentos,
        }
      : undefined;

    const detailsForEntry: PurchaseDetailForEntry[] = purchase.details.map(
      (d) => ({
        lineAmount: d.lineAmount.value,
        expenseAccountCode: d.expenseAccountId
          ? accountById.get(d.expenseAccountId)?.code ?? null
          : null,
        description: d.description,
      }),
    );

    const entryLines = buildPurchaseEntryLines(
      purchase.purchaseType,
      purchase.totalAmount.value,
      detailsForEntry,
      {
        cxpAccountCode: settingsSnapshot.cxpAccountCode,
        fleteExpenseAccountCode: settingsSnapshot.fleteExpenseAccountCode,
        polloFaenadoCOGSAccountCode:
          settingsSnapshot.polloFaenadoCOGSAccountCode,
      },
      purchase.contactId,
      ivaBook,
    );

    const displayCode = `${TYPE_PREFIXES[purchase.purchaseType]}-${String(purchase.sequenceNumber).padStart(3, "0")}`;
    const journalDescription = purchase.notes
      ? `${displayCode} - ${purchase.description} | ${purchase.notes}`
      : `${displayCode} - ${purchase.description}`;

    const { correlationId } = await this.deps.uow!.run(
      { userId, organizationId },
      async (scope) => {
        const { old, new: newJournal } =
          await scope.journalEntryFactory.regenerateForPurchaseEdit(
            purchase.journalEntryId!,
            {
              organizationId,
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
            },
          );

        await scope.accountBalances.applyVoid(old);
        await scope.accountBalances.applyPost(newJournal);
      },
    );

    return { purchase, correlationId };
  }
}
