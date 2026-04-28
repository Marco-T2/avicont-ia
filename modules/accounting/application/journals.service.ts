import { NotFoundError } from "@/features/shared/errors";
import { Money } from "@/modules/shared/domain/value-objects/money";
import {
  JournalAccountInactive,
  JournalAccountNotPostable,
  JournalContactRequiredForAccount,
  JournalFiscalPeriodClosed,
  JournalLineBothSides,
  JournalLineZeroAmount,
} from "../domain/errors/journal-errors";
import { Journal, type JournalLineDraft } from "../domain/journal.entity";
import { LineSide } from "../domain/value-objects/line-side";
import type { AccountingUnitOfWork } from "../domain/ports/unit-of-work";
import type { AccountsReadPort } from "../domain/ports/accounts-read.port";
import type { ContactsReadPort } from "../domain/ports/contacts-read.port";
import type { FiscalPeriodsReadPort } from "../domain/ports/fiscal-periods-read.port";
import type { VoucherTypesReadPort } from "../domain/ports/voucher-types-read.port";

export interface CreateJournalEntryLineInput {
  accountId: string;
  debit: number;
  credit: number;
  description?: string | null;
  contactId?: string | null;
}

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
  ) {}

  async createEntry(
    organizationId: string,
    input: CreateJournalEntryInput,
    audit: AuditUserContext,
  ): Promise<Journal> {
    const period = await this.periods.getById(organizationId, input.periodId);
    if (period.status !== "OPEN") {
      throw new JournalFiscalPeriodClosed();
    }
    await this.voucherTypes.getById(organizationId, input.voucherTypeId);

    for (const line of input.lines) {
      if (line.debit > 0 && line.credit > 0) {
        throw new JournalLineBothSides();
      }
      if (line.debit === 0 && line.credit === 0) {
        throw new JournalLineZeroAmount();
      }
    }

    for (const line of input.lines) {
      const account = await this.accounts.findById(
        organizationId,
        line.accountId,
      );
      if (!account) {
        throw new NotFoundError(`Cuenta ${line.accountId}`);
      }
      if (!account.isActive) {
        throw new JournalAccountInactive(account.name);
      }
      if (!account.isDetail) {
        throw new JournalAccountNotPostable();
      }
      if (account.requiresContact) {
        if (!line.contactId) {
          throw new JournalContactRequiredForAccount(account.name);
        }
        await this.contacts.getActiveById(organizationId, line.contactId);
      }
    }

    const drafts: JournalLineDraft[] = input.lines.map((line) => ({
      accountId: line.accountId,
      side:
        line.debit > 0
          ? LineSide.debit(Money.of(line.debit))
          : LineSide.credit(Money.of(line.credit)),
      description: line.description ?? null,
      contactId: line.contactId ?? null,
    }));

    const journal = Journal.create({
      organizationId,
      date: input.date,
      description: input.description,
      periodId: input.periodId,
      voucherTypeId: input.voucherTypeId,
      createdById: input.createdById,
      contactId: input.contactId ?? null,
      referenceNumber: input.referenceNumber ?? null,
      lines: drafts,
    });

    const { result } = await this.uow.run(
      { userId: audit.userId, organizationId },
      async (scope) => scope.journalEntries.create(journal),
    );
    return result;
  }
}
