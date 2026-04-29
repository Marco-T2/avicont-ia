import { NotFoundError } from "@/features/shared/errors";
import type { ContactRepository } from "@/modules/contacts/domain/contact.repository";
import { ContactNotFound } from "@/modules/contacts/domain/errors/contact-errors";
import type { ReceivableRepository } from "@/modules/receivables/domain/receivable.repository";
import type { AccountLookupPort } from "@/modules/org-settings/domain/ports/account-lookup.port";
import type { FiscalPeriodsReadPort } from "@/modules/accounting/domain/ports/fiscal-periods-read.port";
import {
  Sale,
  type CreateSaleDraftInput,
} from "../domain/sale.entity";
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
import type { JournalEntryFactoryPort } from "../domain/ports/journal-entry-factory.port";
import type { SalePermissionsPort } from "../domain/ports/sale-permissions.port";
import {
  SaleAccountNotFound,
  SaleContactInactive,
  SaleContactNotClient,
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

export interface SaleServiceDeps {
  repo: SaleRepository;
  receivables?: ReceivableRepository;
  contacts?: ContactRepository;
  uow?: SaleUnitOfWork;
  accountLookup?: AccountLookupPort;
  orgSettings?: OrgSettingsReaderPort;
  fiscalPeriods?: FiscalPeriodsReadPort;
  ivaBookReader?: IvaBookReaderPort;
  journalEntryFactory?: JournalEntryFactoryPort;
  salePermissions?: SalePermissionsPort;
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
      journalEntryFactory: this.deps.journalEntryFactory,
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

        const journal = await this.deps.journalEntryFactory!.generateForSale({
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
      journalEntryFactory: this.deps.journalEntryFactory,
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

        const journal = await this.deps.journalEntryFactory!.generateForSale({
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
}
