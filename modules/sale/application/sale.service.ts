import { ForbiddenError, NotFoundError } from "@/features/shared/errors";
import type { ContactRepository } from "@/modules/contacts/domain/contact.repository";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";
import type { ReceivableRepository } from "@/modules/receivables/domain/receivable.repository";
import type { AccountLookupPort } from "@/modules/org-settings/domain/ports/account-lookup.port";
import type { FiscalPeriodsReadPort } from "@/modules/accounting/domain/ports/fiscal-periods-read.port";
import {
  Sale,
  type ApplySaleEditInput,
  type CreateSaleDraftDetailInput,
  type CreateSaleDraftInput,
} from "../domain/sale.entity";
import { SaleDetail } from "../domain/sale-detail.entity";
import { SaleVoidedImmutable } from "../domain/errors/sale-errors";
import type {
  SaleFilters,
  SaleRepository,
} from "../domain/ports/sale.repository";
import {
  computeTrimPlan,
  type TrimPreviewItem,
} from "../domain/compute-trim-plan";
import {
  buildSaleEntryLines,
  type IvaBookForEntry,
  type SaleEntryDetail,
} from "../domain/build-sale-entry-lines";
import type { OrgSettingsReaderPort } from "../domain/ports/org-settings-reader.port";
import type { IvaBookReaderPort } from "../domain/ports/iva-book-reader.port";
import type { SalePermissionsPort } from "../domain/ports/sale-permissions.port";
import type { JournalEntriesReadPort } from "@/modules/accounting/domain/ports/journal-entries-read.port";
import { MonetaryAmount } from "@/modules/shared/domain/value-objects/monetary-amount";
import {
  SaleAccountNotFound,
  SaleContactChangeWithAllocations,
  SaleContactInactive,
  SaleContactNotClient,
  SaleLockedEditMissingJustification,
  SalePeriodClosed,
  SalePostNotAllowedForRole,
} from "./errors/sale-orchestration-errors";
import type { SaleUnitOfWork } from "./sale-unit-of-work";

export interface EditPreview {
  trimPreview: TrimPreviewItem[];
}

export type CreateDraftInput = Omit<
  CreateSaleDraftInput,
  "organizationId" | "createdById"
>;

export interface CreateDraftResult {
  sale: Sale;
  correlationId: string;
}

export interface PostSaleResult {
  sale: Sale;
  correlationId: string;
}

export interface UpdateSaleInput extends ApplySaleEditInput {
  details?: CreateSaleDraftDetailInput[];
}

export interface UpdateSaleContext {
  userId: string;
  role?: string;
  justification?: string;
}

export interface UpdateSaleResult {
  sale: Sale;
  correlationId: string;
}

export interface SaleServiceDeps {
  repo: SaleRepository;
  receivables?: ReceivableRepository;
  contacts?: ContactRepository;
  uow?: SaleUnitOfWork;
  accountLookup?: AccountLookupPort;
  orgSettings?: OrgSettingsReaderPort;
  fiscalPeriods?: FiscalPeriodsReadPort;
  ivaBookReader?: IvaBookReaderPort;
  salePermissions?: SalePermissionsPort;
  journalEntriesRead?: JournalEntriesReadPort;
}

export class SaleService {
  constructor(private readonly deps: SaleServiceDeps) {}

  async list(
    organizationId: string,
    filters?: SaleFilters,
  ): Promise<Sale[]> {
    return this.deps.repo.findAll(organizationId, filters);
  }

  async getById(organizationId: string, id: string): Promise<Sale> {
    const found = await this.deps.repo.findById(organizationId, id);
    if (!found) throw new NotFoundError("Venta");
    return found;
  }

  /**
   * Simulates the LIFO trim plan for an `editPosted` operation that would
   * lower the sale's total to `newTotal`. Read-only — no DB writes. Mirrors
   * legacy `sale.service.ts:525-560` (fidelidad regla #1).
   */
  async getEditPreview(
    organizationId: string,
    saleId: string,
    newTotal: number,
  ): Promise<EditPreview> {
    if (!this.deps.receivables) {
      throw new Error(
        "SaleService.getEditPreview requires ReceivableRepository — inject in constructor",
      );
    }

    const sale = await this.getById(organizationId, saleId);
    if (!sale.receivableId) {
      return { trimPreview: [] };
    }

    const receivable = await this.deps.receivables.findById(
      organizationId,
      sale.receivableId,
    );
    const rawPaid = receivable ? Number(receivable.paid.value) : 0;

    if (newTotal >= rawPaid) {
      return { trimPreview: [] };
    }

    const allocations =
      await this.deps.receivables.findAllocationsForReceivable(
        organizationId,
        sale.receivableId,
      );

    return { trimPreview: computeTrimPlan(allocations, rawPaid - newTotal) };
  }

  /**
   * Creates a sale in DRAFT status. Mirrors legacy `sale.service.ts:212-247`
   * (fidelidad regla #1) — validates contact existence, active status, and
   * `CLIENTE` type before delegating to `Sale.createDraft` (which enforces
   * detail-line invariants intrinsically). Persists inside the UoW so the
   * audit context is set on the Postgres session for trigger-driven audit.
   */
  async createDraft(
    organizationId: string,
    input: CreateDraftInput,
    userId: string,
  ): Promise<CreateDraftResult> {
    if (!this.deps.contacts) {
      throw new Error("SaleService.createDraft requires ContactRepository");
    }
    if (!this.deps.uow) {
      throw new Error("SaleService.createDraft requires SaleUnitOfWork");
    }

    const contact = await this.deps.contacts.findById(
      organizationId,
      input.contactId,
    );
    if (!contact) throw new ContactNotFound();
    if (!contact.isActive) throw new SaleContactInactive(input.contactId);
    if (contact.type !== "CLIENTE") {
      throw new SaleContactNotClient(contact.type);
    }

    const sale = Sale.createDraft({
      ...input,
      organizationId,
      createdById: userId,
    });

    const { result, correlationId } = await this.deps.uow.run(
      { userId, organizationId },
      (scope) => scope.sales.saveTx(sale),
    );

    return { sale: result, correlationId };
  }

  /**
   * Posts a sale (DRAFT → POSTED). Mirrors legacy `sale.service.ts:251-373`
   * (fidelidad regla #1). Resolves period + accounts + IVA book OUTSIDE the
   * UoW; opens the tx to allocate sequence, generate journal entry, apply
   * balances, create receivable, link the sale, and persist.
   */
  async post(
    organizationId: string,
    saleId: string,
    userId: string,
  ): Promise<PostSaleResult> {
    const required = {
      contacts: this.deps.contacts,
      uow: this.deps.uow,
      accountLookup: this.deps.accountLookup,
      orgSettings: this.deps.orgSettings,
      fiscalPeriods: this.deps.fiscalPeriods,
      ivaBookReader: this.deps.ivaBookReader,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) throw new Error(`SaleService.post requires ${name}`);
    }

    const sale = await this.getById(organizationId, saleId);

    const period = await this.deps.fiscalPeriods!.getById(
      organizationId,
      sale.periodId,
    );
    if (period.status === "CLOSED") {
      throw new SalePeriodClosed(sale.periodId);
    }

    const posted = sale.post();

    const incomeAccountIds = posted.details.map((d) => d.incomeAccountId);
    const accounts = await this.deps.accountLookup!.findManyByIds(
      organizationId,
      incomeAccountIds,
    );
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    for (const id of incomeAccountIds) {
      if (!accountById.has(id)) throw new SaleAccountNotFound(id);
    }

    const settings = await this.deps.orgSettings!.getOrCreate(organizationId);
    const settingsSnapshot = settings.toSnapshot();

    const ivaSnapshot = await this.deps.ivaBookReader!.getActiveBookForSale(
      organizationId,
      saleId,
    );
    const ivaBook: IvaBookForEntry | undefined = ivaSnapshot
      ? {
          baseIvaSujetoCf: ivaSnapshot.netAmount,
          dfCfIva: ivaSnapshot.ivaAmount,
          importeTotal: posted.totalAmount.value,
          exentos: ivaSnapshot.exentos,
        }
      : undefined;

    const detailsForEntry: SaleEntryDetail[] = posted.details.map((d) => ({
      lineAmount: d.lineAmount.value,
      incomeAccountCode: accountById.get(d.incomeAccountId)!.code,
      description: d.description,
    }));

    const entryLines = buildSaleEntryLines(
      posted.totalAmount.value,
      detailsForEntry,
      {
        cxcAccountCode: settingsSnapshot.cxcAccountCode,
        itExpenseAccountCode: settingsSnapshot.itExpenseAccountCode,
        itPayableAccountCode: settingsSnapshot.itPayableAccountCode,
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
        const seq = await scope.sales.getNextSequenceNumberTx(organizationId);
        const numbered = posted.assignSequenceNumber(seq);

        const displayCode = `VG-${String(seq).padStart(3, "0")}`;
        const journalDescription = numbered.notes
          ? `${displayCode} - ${numbered.description} | ${numbered.notes}`
          : `${displayCode} - ${numbered.description}`;

        const journal = await scope.journalEntryFactory.generateForSale({
          organizationId,
          contactId: numbered.contactId,
          date: numbered.date,
          periodId: numbered.periodId,
          description: journalDescription,
          sourceType: "sale",
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
        const receivable = await scope.receivables.createTx(undefined, {
          organizationId,
          contactId: numbered.contactId,
          description: journalDescription,
          amount: numbered.totalAmount.value,
          dueDate,
          sourceType: "sale",
          sourceId: numbered.id,
          journalEntryId: journal.id,
        });

        const linked = numbered.linkJournal(journal.id).linkReceivable(receivable.id);
        return scope.sales.updateTx(linked, { replaceDetails: false });
      },
    );

    return { sale: result, correlationId };
  }

  /**
   * Updates a sale. Mirrors legacy `sale.service.ts:564-654` (fidelidad regla
   * #1) for DRAFT + LOCKED branches; POSTED branch lands in Ciclo 6b.
   *
   * - DRAFT: header + optional details replace.
   * - LOCKED: header only (details ignored, legacy parity). Gates role
   *   (`owner`/`admin`) + period status (CLOSED → 50 char justification min;
   *   OPEN → 10 char min).
   * - VOIDED: rejected via `SaleVoidedImmutable` (domain).
   */
  async update(
    organizationId: string,
    saleId: string,
    input: UpdateSaleInput,
    context: UpdateSaleContext,
  ): Promise<UpdateSaleResult> {
    if (!this.deps.contacts) {
      throw new Error("SaleService.update requires ContactRepository");
    }
    if (!this.deps.uow) {
      throw new Error("SaleService.update requires SaleUnitOfWork");
    }

    const sale = await this.getById(organizationId, saleId);

    if (sale.status === "VOIDED") throw new SaleVoidedImmutable();

    if (sale.status === "POSTED") {
      return this.updatePosted(organizationId, sale, input, context);
    }

    if (sale.status === "LOCKED") {
      if (!this.deps.fiscalPeriods) {
        throw new Error("SaleService.update LOCKED branch requires FiscalPeriodsReadPort");
      }
      if (context.role !== "owner" && context.role !== "admin") {
        throw new ForbiddenError(
          "Solo administradores pueden modificar documentos bloqueados",
        );
      }
      const period = await this.deps.fiscalPeriods.getById(
        organizationId,
        sale.periodId,
      );
      const requiredMin = period.status === "CLOSED" ? 50 : 10;
      if (
        !context.justification ||
        context.justification.trim().length < requiredMin
      ) {
        throw new SaleLockedEditMissingJustification(requiredMin);
      }
    }

    if (input.contactId !== undefined) {
      const contact = await this.deps.contacts.findById(
        organizationId,
        input.contactId,
      );
      if (!contact) throw new ContactNotFound();
      if (!contact.isActive) throw new SaleContactInactive(input.contactId);
      if (contact.type !== "CLIENTE") {
        throw new SaleContactNotClient(contact.type);
      }
    }

    let edited = sale.applyEdit({
      date: input.date,
      description: input.description,
      contactId: input.contactId,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
    });

    const replaceDetails =
      sale.status === "DRAFT" && input.details !== undefined;

    if (replaceDetails) {
      const newDetails = input.details!.map((d, idx) =>
        SaleDetail.create({
          saleId: edited.id,
          description: d.description,
          lineAmount: d.lineAmount,
          order: d.order ?? idx,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          incomeAccountId: d.incomeAccountId,
        }),
      );
      edited = edited.replaceDetails(newDetails);
    }

    const auditContext =
      sale.status === "LOCKED"
        ? {
            userId: context.userId,
            organizationId,
            justification: context.justification,
          }
        : { userId: context.userId, organizationId };

    const { result, correlationId } = await this.deps.uow.run(
      auditContext,
      (scope) => scope.sales.updateTx(edited, { replaceDetails }),
    );

    return { sale: result, correlationId };
  }

  /**
   * POSTED edit flow. Mirrors legacy `sale.service.ts:611-614 + editPosted
   * 658-940` (fidelidad regla #1). Atomic revert-modify-reapply cascade:
   * IVA recompute → load+regenerate journal → applyVoid old + applyPost new
   * → receivable amount mutate → LIFO trim allocations.
   */
  private async updatePosted(
    organizationId: string,
    sale: Sale,
    input: UpdateSaleInput,
    context: UpdateSaleContext,
  ): Promise<UpdateSaleResult> {
    const required = {
      uow: this.deps.uow,
      contacts: this.deps.contacts,
      accountLookup: this.deps.accountLookup,
      orgSettings: this.deps.orgSettings,
      fiscalPeriods: this.deps.fiscalPeriods,
      receivables: this.deps.receivables,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) {
        throw new Error(`SaleService.update POSTED branch requires ${name}`);
      }
    }

    const period = await this.deps.fiscalPeriods!.getById(
      organizationId,
      sale.periodId,
    );
    if (period.status === "CLOSED") {
      throw new SalePeriodClosed(sale.periodId);
    }

    if (
      input.contactId !== undefined &&
      input.contactId !== sale.contactId &&
      sale.receivableId
    ) {
      const allocations =
        await this.deps.receivables!.findAllocationsForReceivable(
          organizationId,
          sale.receivableId,
        );
      if (allocations.length > 0) {
        throw new SaleContactChangeWithAllocations();
      }
    }

    if (input.contactId !== undefined) {
      const contact = await this.deps.contacts!.findById(
        organizationId,
        input.contactId,
      );
      if (!contact) throw new ContactNotFound();
      if (!contact.isActive) throw new SaleContactInactive(input.contactId);
      if (contact.type !== "CLIENTE") {
        throw new SaleContactNotClient(contact.type);
      }
    }

    let edited = sale.applyEdit({
      date: input.date,
      description: input.description,
      contactId: input.contactId,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
    });
    const replaceDetails = input.details !== undefined;
    if (replaceDetails) {
      const newDetails = input.details!.map((d, idx) =>
        SaleDetail.create({
          saleId: edited.id,
          description: d.description,
          lineAmount: d.lineAmount,
          order: d.order ?? idx,
          quantity: d.quantity,
          unitPrice: d.unitPrice,
          incomeAccountId: d.incomeAccountId,
        }),
      );
      edited = edited.replaceDetails(newDetails);
    }

    const incomeAccountIds = edited.details.map((d) => d.incomeAccountId);
    const accounts = await this.deps.accountLookup!.findManyByIds(
      organizationId,
      incomeAccountIds,
    );
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    for (const id of incomeAccountIds) {
      if (!accountById.has(id)) throw new SaleAccountNotFound(id);
    }

    const settings = await this.deps.orgSettings!.getOrCreate(organizationId);
    const settingsSnapshot = settings.toSnapshot();

    const detailsForEntry: SaleEntryDetail[] = edited.details.map((d) => ({
      lineAmount: d.lineAmount.value,
      incomeAccountCode: accountById.get(d.incomeAccountId)!.code,
      description: d.description,
    }));

    const { result, correlationId } = await this.deps.uow!.run(
      { userId: context.userId, organizationId },
      async (scope) => {
        const newIvaBook = await scope.ivaBookRegenNotifier.recomputeFromSale(
          organizationId,
          edited.id,
          edited.totalAmount.value,
        );

        const entryLines = buildSaleEntryLines(
          edited.totalAmount.value,
          detailsForEntry,
          {
            cxcAccountCode: settingsSnapshot.cxcAccountCode,
            itExpenseAccountCode: settingsSnapshot.itExpenseAccountCode,
            itPayableAccountCode: settingsSnapshot.itPayableAccountCode,
          },
          edited.contactId,
          newIvaBook ?? undefined,
        );

        const displayCode = `VG-${String(edited.sequenceNumber).padStart(3, "0")}`;
        const journalDescription = edited.notes
          ? `${displayCode} - ${edited.description} | ${edited.notes}`
          : `${displayCode} - ${edited.description}`;

        const { old, new: newJournal } =
          await scope.journalEntryFactory.regenerateForSaleEdit(
            edited.journalEntryId!,
            {
              organizationId,
              contactId: edited.contactId,
              date: edited.date,
              periodId: edited.periodId,
              description: journalDescription,
              sourceType: "sale",
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
        const persistedSale = await scope.sales.updateTx(edited, { replaceDetails });
        await scope.accountBalances.applyPost(newJournal);

        if (edited.receivableId) {
          const receivable = await scope.receivables.findById(
            organizationId,
            edited.receivableId,
          );
          if (receivable && receivable.status !== "VOIDED") {
            let updatedReceivable = receivable.recomputeForSaleEdit(
              edited.totalAmount,
            );
            if (receivable.contactId !== edited.contactId) {
              updatedReceivable = updatedReceivable.changeContact(
                edited.contactId,
              );
            }
            await scope.receivables.update(updatedReceivable);

            if (receivable.paid.value > edited.totalAmount.value) {
              const allocations =
                await scope.receivables.findAllocationsForReceivable(
                  organizationId,
                  edited.receivableId,
                );
              const excess = receivable.paid.value - edited.totalAmount.value;
              const trimPlan = computeTrimPlan(allocations, excess);
              const trimItems = trimPlan.map((p) => ({
                allocationId: p.allocationId,
                newAmount: parseFloat(p.trimmedTo),
              }));
              await scope.receivables.applyTrimPlanTx(
                undefined,
                organizationId,
                edited.receivableId,
                trimItems,
              );
            }
          }
        }

        return persistedSale;
      },
    );

    return { sale: result, correlationId };
  }

  /**
   * Atomic create + post — DRAFT and POSTED in one tx. Mirrors legacy
   * `sale.service.ts:377-515` (fidelidad regla #1). RBAC `canPost("sales")`
   * runs BEFORE entering the UoW (legacy parity: denied requests never open
   * a Postgres tx). NO IVA snapshot lookup — only `post()` consults the IVA
   * book (createAndPost is a fast path for non-IVA sales).
   */
  async createAndPost(
    organizationId: string,
    input: CreateDraftInput,
    context: { userId: string; role: string },
  ): Promise<PostSaleResult> {
    const required = {
      contacts: this.deps.contacts,
      uow: this.deps.uow,
      accountLookup: this.deps.accountLookup,
      orgSettings: this.deps.orgSettings,
      fiscalPeriods: this.deps.fiscalPeriods,
      salePermissions: this.deps.salePermissions,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) throw new Error(`SaleService.createAndPost requires ${name}`);
    }

    const allowed = await this.deps.salePermissions!.canPost(
      context.role,
      "sales",
      organizationId,
    );
    if (!allowed) throw new SalePostNotAllowedForRole(context.role);

    const contact = await this.deps.contacts!.findById(
      organizationId,
      input.contactId,
    );
    if (!contact) throw new ContactNotFound();
    if (!contact.isActive) throw new SaleContactInactive(input.contactId);
    if (contact.type !== "CLIENTE") {
      throw new SaleContactNotClient(contact.type);
    }

    const period = await this.deps.fiscalPeriods!.getById(
      organizationId,
      input.periodId,
    );
    if (period.status === "CLOSED") {
      throw new SalePeriodClosed(input.periodId);
    }

    const posted = Sale.createDraft({
      ...input,
      organizationId,
      createdById: context.userId,
    }).post();

    const incomeAccountIds = posted.details.map((d) => d.incomeAccountId);
    const accounts = await this.deps.accountLookup!.findManyByIds(
      organizationId,
      incomeAccountIds,
    );
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    for (const id of incomeAccountIds) {
      if (!accountById.has(id)) throw new SaleAccountNotFound(id);
    }

    const settings = await this.deps.orgSettings!.getOrCreate(organizationId);
    const settingsSnapshot = settings.toSnapshot();

    const detailsForEntry: SaleEntryDetail[] = posted.details.map((d) => ({
      lineAmount: d.lineAmount.value,
      incomeAccountCode: accountById.get(d.incomeAccountId)!.code,
      description: d.description,
    }));

    const entryLines = buildSaleEntryLines(
      posted.totalAmount.value,
      detailsForEntry,
      {
        cxcAccountCode: settingsSnapshot.cxcAccountCode,
        itExpenseAccountCode: settingsSnapshot.itExpenseAccountCode,
        itPayableAccountCode: settingsSnapshot.itPayableAccountCode,
      },
      posted.contactId,
    );

    const paymentTermsDays = contact.paymentTermsDays;

    const { result, correlationId } = await this.deps.uow!.run(
      { userId: context.userId, organizationId },
      async (scope) => {
        const seq = await scope.sales.getNextSequenceNumberTx(organizationId);
        const numbered = posted.assignSequenceNumber(seq);

        const displayCode = `VG-${String(seq).padStart(3, "0")}`;
        const journalDescription = numbered.notes
          ? `${displayCode} - ${numbered.description} | ${numbered.notes}`
          : `${displayCode} - ${numbered.description}`;

        const journal = await scope.journalEntryFactory.generateForSale({
          organizationId,
          contactId: numbered.contactId,
          date: numbered.date,
          periodId: numbered.periodId,
          description: journalDescription,
          sourceType: "sale",
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
        const receivable = await scope.receivables.createTx(undefined, {
          organizationId,
          contactId: numbered.contactId,
          description: journalDescription,
          amount: numbered.totalAmount.value,
          dueDate,
          sourceType: "sale",
          sourceId: numbered.id,
          journalEntryId: journal.id,
        });

        const linked = numbered
          .linkJournal(journal.id)
          .linkReceivable(receivable.id);
        return scope.sales.saveTx(linked);
      },
    );

    return { sale: result, correlationId };
  }

  /**
   * Voids a sale (DRAFT/POSTED/LOCKED → VOIDED). Mirrors legacy
   * `sale.service.ts:944-977 + voidCascadeTx 1149-1242` (fidelidad regla #1).
   * LOCKED gate replicates `validateLockedEdit` (role + period + justification
   * 10/50). Cascade: revert receivable allocations → trim allocations to zero
   * → void receivable → persist sale VOIDED → IVA book void → journal void
   * + balances applyVoid.
   */
  async void(
    organizationId: string,
    saleId: string,
    context: UpdateSaleContext,
  ): Promise<UpdateSaleResult> {
    const required = {
      uow: this.deps.uow,
      fiscalPeriods: this.deps.fiscalPeriods,
      journalEntriesRead: this.deps.journalEntriesRead,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) throw new Error(`SaleService.void requires ${name}`);
    }

    const sale = await this.getById(organizationId, saleId);

    if (sale.status === "LOCKED") {
      if (context.role !== "owner" && context.role !== "admin") {
        throw new ForbiddenError(
          "Solo administradores pueden modificar documentos bloqueados",
        );
      }
      const period = await this.deps.fiscalPeriods!.getById(
        organizationId,
        sale.periodId,
      );
      const requiredMin = period.status === "CLOSED" ? 50 : 10;
      if (
        !context.justification ||
        context.justification.trim().length < requiredMin
      ) {
        throw new SaleLockedEditMissingJustification(requiredMin);
      }
    }

    const voided = sale.void();

    const auditContext =
      sale.status === "LOCKED"
        ? {
            userId: context.userId,
            organizationId,
            justification: context.justification,
          }
        : { userId: context.userId, organizationId };

    const { result, correlationId } = await this.deps.uow!.run(
      auditContext,
      async (scope) => {
        if (sale.receivableId) {
          const allocations =
            await scope.receivables.findAllocationsForReceivable(
              organizationId,
              sale.receivableId,
            );
          const active = allocations.filter((a) => a.amount > 0);

          if (active.length > 0) {
            const trimItems = active.map((a) => ({
              allocationId: a.id,
              newAmount: 0,
            }));
            await scope.receivables.applyTrimPlanTx(
              undefined,
              organizationId,
              sale.receivableId,
              trimItems,
            );

            const receivable = await scope.receivables.findById(
              organizationId,
              sale.receivableId,
            );
            if (receivable && receivable.status !== "VOIDED") {
              const totalReverted = active.reduce(
                (sum, a) => sum + a.amount,
                0,
              );
              const reverted = receivable.revertAllocations(
                MonetaryAmount.of(totalReverted),
              );
              const finalReceivable = reverted.void();
              await scope.receivables.update(finalReceivable);
            }
          } else {
            const receivable = await scope.receivables.findById(
              organizationId,
              sale.receivableId,
            );
            if (receivable && receivable.status !== "VOIDED") {
              await scope.receivables.update(receivable.void());
            }
          }
        }

        const persistedSale = await scope.sales.updateTx(voided, {
          replaceDetails: false,
        });

        await scope.ivaBookVoidCascade.markVoidedFromSale(
          organizationId,
          saleId,
        );

        if (sale.journalEntryId) {
          const oldJournal = await this.deps.journalEntriesRead!.findById(
            organizationId,
            sale.journalEntryId,
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

        return persistedSale;
      },
    );

    return { sale: result, correlationId };
  }

  /**
   * Hard-deletes a DRAFT sale. Mirrors legacy `sale.service.ts:981-992`. No
   * UoW — operation is single-row delete with no cascade. Domain enforces
   * status === DRAFT via `Sale.assertCanDelete()` (A1).
   */
  async delete(organizationId: string, saleId: string): Promise<void> {
    const sale = await this.getById(organizationId, saleId);
    sale.assertCanDelete();
    await this.deps.repo.deleteTx(organizationId, saleId);
  }

  /**
   * Regenerates the journal entry of a posted sale when the IVA book changes.
   * Mirrors legacy `sale.service.ts:1006-1145` (fidelidad regla #1) WITHOUT
   * `externalTx + correlationId` delegation (legacy complexity §5.5 retired
   * in POC #11.0c — caller invokes its own UoW if coordinated tx is needed).
   *
   * Flow: load sale + accounts + IVA snapshot + entry lines OUTSIDE UoW;
   * factory.regenerateForSaleEdit → applyVoid old + applyPost new INSIDE.
   * Sale aggregate unchanged — only the journal mutates.
   *
   * **Period gate** — sale-hex NO valida periodo aquí (asimetría deliberada
   * con purchase-hex que SÍ valida inside). El gate vive en el consumer
   * IVA-hex per D-A1#4 elevation lock — ver
   * `modules/iva-books/domain/ports/fiscal-period-reader.port.ts:8-26`.
   */
  async regenerateJournalForIvaChange(
    organizationId: string,
    saleId: string,
    userId: string,
  ): Promise<UpdateSaleResult> {
    const required = {
      uow: this.deps.uow,
      accountLookup: this.deps.accountLookup,
      orgSettings: this.deps.orgSettings,
      ivaBookReader: this.deps.ivaBookReader,
    };
    for (const [name, dep] of Object.entries(required)) {
      if (!dep) {
        throw new Error(`SaleService.regenerateJournalForIvaChange requires ${name}`);
      }
    }

    const sale = await this.getById(organizationId, saleId);
    if (!sale.journalEntryId) {
      throw new NotFoundError("Asiento contable");
    }

    const incomeAccountIds = sale.details.map((d) => d.incomeAccountId);
    const accounts = await this.deps.accountLookup!.findManyByIds(
      organizationId,
      incomeAccountIds,
    );
    const accountById = new Map(accounts.map((a) => [a.id, a]));
    for (const id of incomeAccountIds) {
      if (!accountById.has(id)) throw new SaleAccountNotFound(id);
    }

    const settings = await this.deps.orgSettings!.getOrCreate(organizationId);
    const settingsSnapshot = settings.toSnapshot();

    const ivaSnapshot = await this.deps.ivaBookReader!.getActiveBookForSale(
      organizationId,
      saleId,
    );
    const ivaBook: IvaBookForEntry | undefined = ivaSnapshot
      ? {
          baseIvaSujetoCf: ivaSnapshot.netAmount,
          dfCfIva: ivaSnapshot.ivaAmount,
          importeTotal: sale.totalAmount.value,
          exentos: ivaSnapshot.exentos,
        }
      : undefined;

    const detailsForEntry: SaleEntryDetail[] = sale.details.map((d) => ({
      lineAmount: d.lineAmount.value,
      incomeAccountCode: accountById.get(d.incomeAccountId)!.code,
      description: d.description,
    }));

    const entryLines = buildSaleEntryLines(
      sale.totalAmount.value,
      detailsForEntry,
      {
        cxcAccountCode: settingsSnapshot.cxcAccountCode,
        itExpenseAccountCode: settingsSnapshot.itExpenseAccountCode,
        itPayableAccountCode: settingsSnapshot.itPayableAccountCode,
      },
      sale.contactId,
      ivaBook,
    );

    const displayCode = `VG-${String(sale.sequenceNumber).padStart(3, "0")}`;
    const journalDescription = sale.notes
      ? `${displayCode} - ${sale.description} | ${sale.notes}`
      : `${displayCode} - ${sale.description}`;

    const { correlationId } = await this.deps.uow!.run(
      { userId, organizationId },
      async (scope) => {
        const { old, new: newJournal } =
          await scope.journalEntryFactory.regenerateForSaleEdit(
            sale.journalEntryId!,
            {
              organizationId,
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
            },
          );

        await scope.accountBalances.applyVoid(old);
        await scope.accountBalances.applyPost(newJournal);
      },
    );

    return { sale, correlationId };
  }
}
