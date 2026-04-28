import {
  ForbiddenError,
  NotFoundError,
  POST_NOT_ALLOWED_FOR_ROLE,
} from "@/features/shared/errors";
import { validateLockedEdit } from "@/features/accounting/server";
import {
  JournalAutoEntryVoidForbidden,
  JournalFiscalPeriodClosed,
} from "../domain/errors/journal-errors";
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
import type { PermissionsPort } from "../domain/ports/permissions.port";
import type { VoucherTypesReadPort } from "../domain/ports/voucher-types-read.port";

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
  ) {}

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
          const updated = await scope.journalEntries.update(mutated);
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
      async (scope) => scope.journalEntries.update(mutated),
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
      lines: mapLinesToDrafts(input.lines),
    });
  }
}
