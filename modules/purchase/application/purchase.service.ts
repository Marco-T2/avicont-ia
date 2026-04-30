import { NotFoundError } from "@/features/shared/errors";
import type { ContactRepository } from "@/modules/contacts/domain/contact.repository";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";
import type { AccountLookupPort } from "@/modules/org-settings/domain/ports/account-lookup.port";
import type { FiscalPeriodsReadPort } from "@/modules/accounting/domain/ports/fiscal-periods-read.port";
import type { OrgSettingsReaderPort } from "@/modules/sale/domain/ports/org-settings-reader.port";
import {
  Purchase,
  type CreatePurchaseDraftInput,
  type PurchaseType,
} from "../domain/purchase.entity";
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
  PurchaseContactInactive,
  PurchaseContactNotProvider,
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

export class PurchaseService {
  constructor(private readonly deps: PurchaseServiceDeps) {}

  async list(
    organizationId: string,
    filters?: PurchaseFilters,
  ): Promise<Purchase[]> {
    return this.deps.repo.findAll(organizationId, filters);
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
        const seq = await scope.purchases.getNextSequenceNumberTx(organizationId);
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
        const seq = await scope.purchases.getNextSequenceNumberTx(organizationId);
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
}
