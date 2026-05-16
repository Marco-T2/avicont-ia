import {
  ForbiddenError,
  NotFoundError,
  POST_NOT_ALLOWED_FOR_ROLE,
} from "@/features/shared/errors";
import { validateLockedEdit } from "../domain/document-lifecycle";
import type { OrgProfileService } from "@/modules/org-profile/presentation/server";
import type { DocumentSignatureConfigService } from "@/modules/document-signature-config/presentation/server";
import type { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";
import { buildVoucherPdfInput } from "../infrastructure/exporters/voucher-pdf.composer";
import { exportVoucherPdf as renderVoucherPdf } from "../infrastructure/exporters/voucher-pdf.exporter";
import { fetchLogoAsDataUrl } from "../infrastructure/exporters/logo-fetcher";
import type { ExportVoucherOpts } from "../infrastructure/exporters/voucher-pdf.types";
import {
  JournalAutoEntryVoidForbidden,
  JournalDateOutsidePeriod,
  JournalFiscalPeriodClosed,
} from "../domain/errors/journal-errors";
import { isDateWithinPeriod } from "@/modules/fiscal-periods/domain/date-period-check";
import { Journal } from "../domain/journal.entity";
import {
  type JournalLineRawInput,
  mapLinesToDrafts,
  validateLineRules,
} from "../domain/journal-line-rules";
import { validateLinesAgainstPorts } from "./journal-line-port-checks";
import type { AccountingUnitOfWork } from "../domain/ports/unit-of-work";
import type { AccountsReadPort } from "../domain/ports/accounts-read.port";
import type { ContactsReadPort } from "../domain/ports/contacts-read.port";
import type { FiscalPeriodsReadPort } from "../domain/ports/fiscal-periods-read.port";
import type { JournalEntriesReadPort } from "../domain/ports/journal-entries-read.port";
import type { JournalLedgerQueryPort } from "../domain/ports/journal-ledger-query.port";
import type { PermissionsPort } from "../domain/ports/permissions.port";
import type { VoucherTypesReadPort } from "../domain/ports/voucher-types-read.port";
import type {
  CorrelationAuditFilters,
  CorrelationAuditResult,
  CorrelationGap,
  JournalEntryWithLines,
  JournalFilters,
} from "../presentation/dto/journal.types";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";

// Alias kept for API ergonomics — the use case names its line input
// `CreateJournalEntryLineInput` to mirror the legacy public surface, but
// structurally it IS the domain `JournalLineRawInput`. Single shared shape.
export type CreateJournalEntryLineInput = JournalLineRawInput;

export interface CreateJournalEntryInput {
  date: Date;
  description: string;
  periodId: string;
  voucherTypeId: string;
  createdById: string;
  contactId?: string | null;
  referenceNumber?: number | null;
  // AI-origin marking. Threaded straight through to the `Journal` aggregate
  // (immutable post-creation, I9). `sourceType` drives the "Generado por IA"
  // Origen column; `aiOriginalText` keeps the user's raw prompt. The normal
  // "+ Nuevo Asiento" form omits both → they default to null. Folded in at
  // C5 B2a — the aggregate (`journal.entity.ts:72-74`), the DTO
  // (`journal.types.ts:30-42`) and the Prisma repo already threaded them;
  // this use-case input contract was the only gap.
  sourceType?: string | null;
  aiOriginalText?: string | null;
  lines: CreateJournalEntryLineInput[];
}

export interface UpdateJournalEntryInput {
  date?: Date;
  description?: string;
  contactId?: string | null;
  referenceNumber?: number | null;
  updatedById: string;
  lines?: CreateJournalEntryLineInput[];
}

export interface AuditUserContext {
  userId: string;
}

/**
 * Application-layer use cases for the journal/accounting module. Orchestrates
 * the `Journal` aggregate against tx-aware repos (held in the UoW scope) and
 * read-only cross-feature ports.
 *
 * In C2 the service exposes the four legacy entry points migrated to
 * hexagonal: createEntry, createAndPost, transitionStatus, updateEntry.
 * Strict TDD per-test — methods land one failing case at a time.
 *
 * POC #7 OLEADA 6 — C1: the 5 read/utility use cases fold in from legacy
 * `journal.service.ts` — list, getById, getCorrelationAudit,
 * getLastReferenceNumber, getNextNumber. They are projection/reporting
 * paths driven by `JournalLedgerQueryPort` (the legacy methods reached
 * `JournalRepository` directly; the hex stays port-driven).
 *
 * POC #7 OLEADA 6 — C3: the 6th legacy read, `exportVoucherPdf`, folds in
 * coupled to the `exporters/` git-mv. Unlike the C1 reads it is NOT
 * port-driven: it composes the voucher PDF from the `OrgProfileService`,
 * `DocumentSignatureConfigService` and the full `FiscalPeriodsService`
 * (the C1 `FiscalPeriodsReadPort` only carries `{id,status}` — the PDF
 * needs `period.name` for the gestión field). These three are injected
 * via the composition-root ctor, mirroring legacy `journal.service.ts:67-87`
 * (resolved open question — NO new ports for this reporting path).
 */
export class JournalsService {
  constructor(
    private readonly uow: AccountingUnitOfWork,
    private readonly accounts: AccountsReadPort,
    private readonly contacts: ContactsReadPort,
    private readonly periods: FiscalPeriodsReadPort,
    private readonly voucherTypes: VoucherTypesReadPort,
    private readonly permissions: PermissionsPort,
    private readonly journalEntriesRead: JournalEntriesReadPort,
    private readonly journalLedgerQuery: JournalLedgerQueryPort,
    private readonly orgProfile: OrgProfileService,
    private readonly sigConfig: DocumentSignatureConfigService,
    private readonly fiscalPeriods: ReturnType<typeof makeFiscalPeriodsService>,
  ) {}

  // ── Read use cases (C1) — folded from legacy journal.service.ts ──

  /**
   * Lists journal entries for an org, optionally filtered. Parity legacy
   * `journal.service.ts:90-95` — thin delegation to the query port.
   */
  async list(
    organizationId: string,
    filters?: JournalFilters,
  ): Promise<JournalEntryWithLines[]> {
    return this.journalLedgerQuery.list(organizationId, filters);
  }

  /**
   * Paginated list — thin delegation to the query port's `findPaginated`.
   * ADDITIVE alongside legacy `list` (dual-method transitional). §13/dual-
   * method-additive-transitional 4ta evidencia matures.
   */
  async listPaginated(
    organizationId: string,
    filters?: JournalFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<JournalEntryWithLines>> {
    return this.journalLedgerQuery.findPaginated(
      organizationId,
      filters,
      pagination,
    );
  }

  /**
   * Fetches a single journal entry by id. Throws `NotFoundError("Asiento
   * contable")` when missing — parity legacy `journal.service.ts:99-103`.
   */
  async getById(
    organizationId: string,
    id: string,
  ): Promise<JournalEntryWithLines> {
    const entry = await this.journalLedgerQuery.findById(organizationId, id);
    if (!entry) throw new NotFoundError("Asiento contable");
    return entry;
  }

  /**
   * Returns the highest existing `referenceNumber` for a voucher type, or
   * null. Validates the voucher type belongs to the org first (getById
   * throws 404 otherwise). Parity legacy `journal.service.ts:492-498`.
   */
  async getLastReferenceNumber(
    organizationId: string,
    voucherTypeId: string,
  ): Promise<number | null> {
    await this.voucherTypes.getById(organizationId, voucherTypeId);
    return this.journalLedgerQuery.getLastReferenceNumber(
      organizationId,
      voucherTypeId,
    );
  }

  /**
   * Returns the next sequential `number` for {org, voucherType, period}.
   * Validates the voucher type belongs to the org first. Parity legacy
   * `journal.service.ts:500-507`.
   */
  async getNextNumber(
    organizationId: string,
    voucherTypeId: string,
    periodId: string,
  ): Promise<number> {
    await this.voucherTypes.getById(organizationId, voucherTypeId);
    return this.journalLedgerQuery.getNextNumber(
      organizationId,
      voucherTypeId,
      periodId,
    );
  }

  /**
   * Correlation audit — detects gaps in the `referenceNumber` sequence for a
   * voucher type. Validates the voucher type belongs to the org first. The
   * gap-detection loop is ported VERBATIM from legacy
   * `journal.service.ts:511-544` (the query port supplies the sorted
   * reference-numbered entries + un-referenced count; the gap arithmetic
   * stays in the use case).
   */
  async getCorrelationAudit(
    organizationId: string,
    filters: CorrelationAuditFilters,
  ): Promise<CorrelationAuditResult> {
    await this.voucherTypes.getById(organizationId, filters.voucherTypeId);

    const { withReference, withoutReferenceCount } =
      await this.journalLedgerQuery.findForCorrelationAudit(
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

  /**
   * Renders a journal entry as a voucher PDF. Parity legacy
   * `journal.service.ts:641-661` — resolves the entry via `getById`, pulls the
   * org profile + signature config + fiscal period (for the gestión name),
   * composes the typed PDF input and delegates to the pure pdfmake renderer.
   * The composer + renderer + logo-fetcher were git-mv'd to
   * `infrastructure/exporters/` in C3 (history preserved).
   */
  async exportVoucherPdf(
    organizationId: string,
    entryId: string,
    opts: ExportVoucherOpts,
  ): Promise<Buffer> {
    const entry = await this.getById(organizationId, entryId);
    const profile = await this.orgProfile.getOrCreate(organizationId);
    const sigConfig = await this.sigConfig.getOrDefault(
      organizationId,
      "COMPROBANTE",
    );
    const logoDataUrl = await fetchLogoAsDataUrl(profile.logoUrl);
    const period = await this.fiscalPeriods.getById(
      organizationId,
      entry.periodId,
    );

    const input = buildVoucherPdfInput(entry, profile, sigConfig, logoDataUrl, {
      exchangeRate: opts.exchangeRate,
      ufvRate: opts.ufvRate,
      gestion: period.name,
      locality: profile.ciudad ?? "",
    });

    return renderVoucherPdf(input);
  }

  async createEntry(
    organizationId: string,
    input: CreateJournalEntryInput,
    audit: AuditUserContext,
  ): Promise<Journal> {
    const journal = await this.validateAndCreateDraft(organizationId, input);

    const { result } = await this.uow.run(
      { userId: audit.userId, organizationId },
      async (scope) => scope.journalEntries.create(journal),
    );
    return result;
  }

  async createAndPost(
    organizationId: string,
    input: CreateJournalEntryInput,
    context: { userId: string; role: string },
  ): Promise<{ journal: Journal; correlationId: string }> {
    if (
      !(await this.permissions.canPost(
        context.role,
        "journal",
        organizationId,
      ))
    ) {
      throw new ForbiddenError(
        "Tu rol no tiene permiso para contabilizar asientos",
        POST_NOT_ALLOWED_FOR_ROLE,
      );
    }

    const draft = await this.validateAndCreateDraft(organizationId, input);
    const posted = draft.post();

    const { result, correlationId } = await this.uow.run(
      { userId: context.userId, organizationId },
      async (scope) => {
        const persisted = await scope.journalEntries.create(posted);
        await scope.accountBalances.applyPost(persisted);
        return persisted;
      },
    );

    return { journal: result, correlationId };
  }

  async transitionStatus(
    organizationId: string,
    entryId: string,
    target: "POSTED" | "LOCKED" | "VOIDED",
    context: { userId: string; role: string; justification?: string },
  ): Promise<{ journal: Journal; correlationId: string }> {
    const current = await this.journalEntriesRead.findById(
      organizationId,
      entryId,
    );
    if (!current) {
      throw new NotFoundError("Asiento contable");
    }
    if (target === "VOIDED" && current.sourceType !== null) {
      throw new JournalAutoEntryVoidForbidden();
    }
    if (current.status === "LOCKED" && target === "VOIDED") {
      const period = await this.periods.getById(
        organizationId,
        current.periodId,
      );
      validateLockedEdit(
        current.status,
        context.role,
        period.status,
        context.justification,
      );
    }
    if (target === "POSTED") {
      const period = await this.periods.getById(
        organizationId,
        current.periodId,
      );
      if (period.status !== "OPEN") {
        throw new JournalFiscalPeriodClosed();
      }
    }
    const transitioned =
      target === "POSTED"
        ? current.post()
        : target === "LOCKED"
          ? current.lock()
          : current.void();

    const { result, correlationId } = await this.uow.run(
      { userId: context.userId, organizationId },
      async (scope) => {
        const persisted = await scope.journalEntries.updateStatus(
          transitioned,
          context.userId,
        );
        if (target === "POSTED") {
          await scope.accountBalances.applyPost(persisted);
        } else if (target === "VOIDED") {
          await scope.accountBalances.applyVoid(persisted);
        }
        return persisted;
      },
    );

    return { journal: result, correlationId };
  }

  async updateEntry(
    organizationId: string,
    entryId: string,
    input: UpdateJournalEntryInput,
    context: { userId: string; role?: string; justification?: string },
  ): Promise<{ journal: Journal; correlationId: string }> {
    const current = await this.journalEntriesRead.findById(
      organizationId,
      entryId,
    );
    if (!current) {
      throw new NotFoundError("Asiento contable");
    }

    // POSTED branch — revert-rewrite-reapply (parity legacy
    // `journal.service.ts:441-465` updatePostedManualEntryTx). 3 writes
    // intra-tx: applyVoid(current) → update(mutated) → applyPost(updated).
    //
    // Auto-entry rejection (sourceType !== null) delegada al aggregate I9
    // vía `current.update` → `assertMutable` (`journal.entity.ts:281-282`)
    // que tira JournalAutoGeneratedImmutable con code
    // ENTRY_SYSTEM_GENERATED_IMMUTABLE — parity legacy l340-345 por error
    // class + code, sin guard pre-tx en el use case (legacy lo tenía
    // porque no tiene aggregate; el hexagonal sí). Period check deferred
    // to B3.
    if (current.status === "POSTED") {
      let mutated = current.update(input);

      // I6 — período debe estar OPEN. Orden parity legacy l340-349:
      // sourceType (I9, manejado por aggregate vía assertMutable arriba)
      // → period OPEN (acá) → balance (manejado por aggregate
      // replaceLines POSTED si input.lines !== undefined).
      const period = await this.periods.getById(
        organizationId,
        current.periodId,
      );
      if (period.status !== "OPEN") {
        throw new JournalFiscalPeriodClosed();
      }
      // I12 — si la fecha cambió, la nueva debe seguir cayendo en el período
      // del entry (periodId NO es mutable en update). Si el contador necesita
      // mover el asiento a otro mes, debe anular y crear uno nuevo.
      if (input.date !== undefined) {
        assertDateWithinPeriod(input.date, period);
      }

      if (input.lines !== undefined) {
        validateLineRules(input.lines);
        await validateLinesAgainstPorts(
          organizationId,
          input.lines,
          this.accounts,
          this.contacts,
        );
        mutated = mutated.replaceLines(mapLinesToDrafts(input.lines));
      }

      const { result, correlationId } = await this.uow.run(
        { userId: context.userId, organizationId },
        async (scope) => {
          await scope.accountBalances.applyVoid(current);
          const updated = await scope.journalEntries.update(mutated, {
            replaceLines: input.lines !== undefined,
          });
          await scope.accountBalances.applyPost(updated);
          return updated;
        },
      );

      return { journal: result, correlationId };
    }

    if (current.status === "LOCKED") {
      const period = await this.periods.getById(
        organizationId,
        current.periodId,
      );
      validateLockedEdit(
        current.status,
        context.role ?? "",
        period.status,
        context.justification,
      );
      // I12 — si la fecha cambia en LOCKED-editable, debe caer en el período del entry.
      if (input.date !== undefined) {
        assertDateWithinPeriod(input.date, period);
      }
    } else if (input.date !== undefined) {
      // I12 — DRAFT update: si la fecha cambia, también debe caer en el período del entry.
      const period = await this.periods.getById(
        organizationId,
        current.periodId,
      );
      assertDateWithinPeriod(input.date, period);
    }
    let mutated = current.update(input);
    if (input.lines !== undefined) {
      validateLineRules(input.lines);
      await validateLinesAgainstPorts(
        organizationId,
        input.lines,
        this.accounts,
        this.contacts,
      );
      mutated = mutated.replaceLines(mapLinesToDrafts(input.lines));
    }

    const { result, correlationId } = await this.uow.run(
      { userId: context.userId, organizationId },
      async (scope) =>
        scope.journalEntries.update(mutated, {
          replaceLines: input.lines !== undefined,
        }),
    );

    return { journal: result, correlationId };
  }

  // Cross-feature validation + DRAFT aggregate construction shared by
  // createEntry and createAndPost. Order is parity-locked with legacy
  // `journal.service.ts` (period → voucherType → line pre-loop → accounts/
  // contacts loop → map + Journal.create). Aggregate-intrinsic invariants (I2
  // ≥ 2 lines via Journal.create, I10 zero-amount via LineSide constructors)
  // are enforced inside the aggregate; this helper covers only what the
  // application layer can assert against ports.
  private async validateAndCreateDraft(
    organizationId: string,
    input: CreateJournalEntryInput,
  ): Promise<Journal> {
    const period = await this.periods.getById(organizationId, input.periodId);
    if (period.status !== "OPEN") {
      throw new JournalFiscalPeriodClosed();
    }
    assertDateWithinPeriod(input.date, period);
    await this.voucherTypes.getById(organizationId, input.voucherTypeId);

    validateLineRules(input.lines);
    await validateLinesAgainstPorts(
      organizationId,
      input.lines,
      this.accounts,
      this.contacts,
    );

    return Journal.create({
      organizationId,
      date: input.date,
      description: input.description,
      periodId: input.periodId,
      voucherTypeId: input.voucherTypeId,
      createdById: input.createdById,
      contactId: input.contactId ?? null,
      referenceNumber: input.referenceNumber ?? null,
      sourceType: input.sourceType ?? null,
      aiOriginalText: input.aiOriginalText ?? null,
      lines: mapLinesToDrafts(input.lines),
    });
  }
}

/**
 * I12 — la fecha del asiento DEBE caer dentro del rango [startDate, endDate]
 * del período. Delegado al helper compartido `isDateWithinPeriod` (consumido
 * también por sale/purchase services con sus propias error classes).
 */
function assertDateWithinPeriod(
  date: Date,
  period: { name: string; startDate: Date; endDate: Date },
): void {
  if (!isDateWithinPeriod(date, period)) {
    throw new JournalDateOutsidePeriod(date, period.name);
  }
}
