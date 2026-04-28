import type {
  AuditContext,
  BaseScope,
} from "@/modules/shared/domain/ports/unit-of-work";
import { FakeFiscalPeriodsTxRepo } from "@/modules/shared/application/__tests__/fakes/in-memory-unit-of-work";
import { Journal } from "../../../domain/journal.entity";
import type { AccountBalancesRepository } from "../../../domain/ports/account-balances.repo";
import type { JournalEntriesReadPort } from "../../../domain/ports/journal-entries-read.port";
import type { JournalEntriesRepository } from "../../../domain/ports/journal-entries.repo";
import type {
  AccountingScope,
  AccountingUnitOfWork,
} from "../../../domain/ports/unit-of-work";
import type {
  AccountReadDto,
  AccountsReadPort,
} from "../../../domain/ports/accounts-read.port";
import type { ContactsReadPort } from "../../../domain/ports/contacts-read.port";
import type {
  AccountingFiscalPeriod,
  FiscalPeriodsReadPort,
} from "../../../domain/ports/fiscal-periods-read.port";
import type {
  PermissionScope,
  PermissionsPort,
} from "../../../domain/ports/permissions.port";
import type {
  AccountingVoucherType,
  VoucherTypesReadPort,
} from "../../../domain/ports/voucher-types-read.port";

/**
 * In-memory write port for journal_entries. Records every persisted aggregate
 * so tests can assert against `created` directly. The auto-generated `number`
 * is simulated by a per-instance counter starting at 1.
 *
 * Real production behaviour (retry on VOUCHER_NUMBER_CONTENTION, P2002 →
 * REFERENCE_NUMBER_DUPLICATE) belongs to the Prisma adapter (C3); the fake
 * deliberately ignores those concerns — they are infra, not domain.
 */
export class InMemoryJournalEntriesRepository
  implements JournalEntriesRepository
{
  created: Journal[] = [];
  updateStatusCalls: { journal: Journal; userId: string }[] = [];
  updateCalls: Journal[] = [];
  private nextNumber = 1;

  async create(journal: Journal): Promise<Journal> {
    const snapshot = journal.toSnapshot();
    const hydrated = Journal.fromPersistence({
      id: snapshot.id,
      organizationId: snapshot.organizationId,
      status: snapshot.status,
      number: this.nextNumber++,
      referenceNumber: snapshot.referenceNumber,
      date: snapshot.date,
      description: snapshot.description,
      periodId: snapshot.periodId,
      voucherTypeId: snapshot.voucherTypeId,
      contactId: snapshot.contactId,
      sourceType: snapshot.sourceType,
      sourceId: snapshot.sourceId,
      aiOriginalText: snapshot.aiOriginalText,
      createdById: snapshot.createdById,
      updatedById: snapshot.updatedById,
      createdAt: snapshot.createdAt,
      updatedAt: snapshot.updatedAt,
      lines: journal.lines,
    });
    this.created.push(hydrated);
    return hydrated;
  }

  async updateStatus(journal: Journal, userId: string): Promise<Journal> {
    this.updateStatusCalls.push({ journal, userId });
    return journal;
  }

  async update(journal: Journal): Promise<Journal> {
    this.updateCalls.push(journal);
    return journal;
  }
}

/**
 * In-memory read port for journal entries. Tests prime `entriesById` with
 * `Journal` aggregates that should resolve from the read; `findById` returns
 * the aggregate or null when missing — null lets the use case surface
 * `NotFoundError("Asiento contable")` parity-true with legacy l558.
 *
 * Defaults to "no entries primed" so a test forgetting to prime the id fails
 * with a NotFound-style assertion instead of a phantom resolution.
 */
export class InMemoryJournalEntriesReadPort implements JournalEntriesReadPort {
  entriesById = new Map<string, Journal>();

  async findById(
    _organizationId: string,
    entryId: string,
  ): Promise<Journal | null> {
    return this.entriesById.get(entryId) ?? null;
  }
}

/**
 * In-memory read port for accounts. Tests prime `accountsById` with
 * `AccountReadDto` rows; `findById` returns the dto or null when missing.
 */
export class InMemoryAccountsReadPort implements AccountsReadPort {
  accountsById = new Map<string, AccountReadDto>();

  async findById(
    _organizationId: string,
    accountId: string,
  ): Promise<AccountReadDto | null> {
    return this.accountsById.get(accountId) ?? null;
  }
}

/**
 * In-memory read port for fiscal periods. Tests prime `periodsById`; `getById`
 * throws (parity with legacy `periodsService.getById`) when missing — the
 * application layer assumes the period either exists or surfaces NotFoundError.
 */
export class InMemoryFiscalPeriodsReadPort implements FiscalPeriodsReadPort {
  periodsById = new Map<string, AccountingFiscalPeriod>();

  async getById(
    _organizationId: string,
    periodId: string,
  ): Promise<AccountingFiscalPeriod> {
    const found = this.periodsById.get(periodId);
    if (!found) {
      throw new Error(`Fiscal period ${periodId} not found`);
    }
    return found;
  }
}

/**
 * In-memory read port for contacts. Tests prime `activeContactIds` with
 * the set of ids that should resolve as active. `getActiveById` throws (with
 * a generic Error placeholder until the test that exercises code parity
 * decides the exact ValidationError instance) when the id is missing or
 * inactive. The fake intentionally does NOT couple to the legacy
 * `CONTACT_NOT_FOUND` code — that translation is the adapter's job.
 */
export class InMemoryContactsReadPort implements ContactsReadPort {
  activeContactIds = new Set<string>();
  inactiveError: Error = new Error("Contact missing or inactive");

  async getActiveById(
    _organizationId: string,
    contactId: string,
  ): Promise<void> {
    if (!this.activeContactIds.has(contactId)) {
      throw this.inactiveError;
    }
  }
}

/**
 * In-memory read port for voucher types. Tests prime `voucherTypesById`;
 * `getById` throws when missing (parity with legacy
 * `voucherTypesService.getById`).
 */
export class InMemoryVoucherTypesReadPort implements VoucherTypesReadPort {
  voucherTypesById = new Map<string, AccountingVoucherType>();

  async getById(
    _organizationId: string,
    voucherTypeId: string,
  ): Promise<AccountingVoucherType> {
    const found = this.voucherTypesById.get(voucherTypeId);
    if (!found) {
      throw new Error(`Voucher type ${voucherTypeId} not found`);
    }
    return found;
  }
}

/**
 * In-memory RBAC port. Tests prime `allowedKeys` with
 * `${role}:${scope}:${organizationId}` tuples that should resolve as allowed.
 * `canPost` returns `true` iff the tuple is present, `false` otherwise.
 *
 * Defaults to deny-all so a test forgetting to prime the role fails closed
 * (matches legacy `canPost` semantics: missing matrix entry → denied).
 */
export class InMemoryPermissionsPort implements PermissionsPort {
  allowedKeys = new Set<string>();

  async canPost(
    role: string,
    scope: PermissionScope,
    organizationId: string,
  ): Promise<boolean> {
    return this.allowedKeys.has(`${role}:${scope}:${organizationId}`);
  }
}

/**
 * In-memory write port for account_balances. Records every `applyPost`
 * invocation so tests can assert that balances were applied for a given
 * Journal aggregate. Real production semantics (debit/credit math against
 * AccountBalance aggregates, sign rules) live in the Prisma adapter (C3) —
 * the fake intentionally only records, mirroring the precedent set by
 * `InMemoryJournalEntriesRepository` for `create`.
 */
export class InMemoryAccountBalancesRepository
  implements AccountBalancesRepository
{
  applyPostCalls: Journal[] = [];
  applyVoidCalls: Journal[] = [];

  async applyPost(entry: Journal): Promise<void> {
    this.applyPostCalls.push(entry);
  }

  async applyVoid(entry: Journal): Promise<void> {
    this.applyVoidCalls.push(entry);
  }
}

/**
 * In-memory `AccountingUnitOfWork` used by application-layer tests.
 *
 * Mirrors the contract of `InMemoryUnitOfWork` from shared — generates
 * `correlationId` BEFORE invoking fn, does NOT simulate a real DB tx — but
 * exposes the accounting-specific scope (`journalEntries` + `accountBalances`
 * repos).
 *
 * NOTE: this does NOT replace the integration test against Postgres — the
 * SET LOCAL + audit trigger semantics are exercised by the Prisma adapter
 * tests in C5.
 */
export class InMemoryAccountingUnitOfWork implements AccountingUnitOfWork {
  lastCtx: AuditContext | null = null;
  lastCorrelationId: string | null = null;
  runCount = 0;

  fiscalPeriods = new FakeFiscalPeriodsTxRepo();
  journalEntries = new InMemoryJournalEntriesRepository();
  accountBalances = new InMemoryAccountBalancesRepository();

  async run<T>(
    ctx: AuditContext,
    fn: (scope: AccountingScope) => Promise<T>,
  ): Promise<{ result: T; correlationId: string }> {
    this.runCount++;
    this.lastCtx = ctx;
    const correlationId = crypto.randomUUID();
    this.lastCorrelationId = correlationId;
    const scope: AccountingScope & BaseScope = {
      correlationId,
      fiscalPeriods: this.fiscalPeriods,
      journalEntries: this.journalEntries,
      accountBalances: this.accountBalances,
    };
    const result = await fn(scope);
    return { result, correlationId };
  }
}
