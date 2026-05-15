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
  JournalLedgerQueryPort,
  LedgerAggregateRow,
  LedgerLineRow,
} from "../../../domain/ports/journal-ledger-query.port";
import type {
  CorrelationAuditFilters,
  CorrelationAuditResult,
  JournalEntryWithLines,
  JournalFilters,
} from "../../../presentation/dto/journal.types";
import type { DateRangeFilter } from "../../../presentation/dto/ledger.types";
import type {
  PaginatedResult,
  PaginationOptions,
} from "@/modules/shared/domain/value-objects/pagination";
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
import type { OrgProfileService } from "@/modules/org-profile/presentation/server";
import type { DocumentSignatureConfigService } from "@/modules/document-signature-config/presentation/server";
import type { makeFiscalPeriodsService } from "@/modules/fiscal-periods/presentation/server";

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
  updateCalls: { journal: Journal; options: { replaceLines: boolean } }[] = [];
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

  async update(
    journal: Journal,
    options: { replaceLines: boolean },
  ): Promise<Journal> {
    this.updateCalls.push({ journal, options });
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
 * In-memory `JournalLedgerQueryPort` for the C1 read use cases. Tests prime
 * the row-shaped collections directly (`listRows`, `entriesById`,
 * `lastReferenceNumber`, `nextNumber`, `correlationAudit`, `linesByAccount`,
 * `aggregateByAccount`). Defaults are deliberately "empty / null" so a test
 * that forgets to prime fails on the assertion instead of a phantom value.
 *
 * This is a pure projection port — no money math here (DEV-1 / R-money: the
 * float `Number()` accumulation lives in `LedgerService`).
 */
export class InMemoryJournalLedgerQueryPort implements JournalLedgerQueryPort {
  listRows: JournalEntryWithLines[] = [];
  entriesById = new Map<string, JournalEntryWithLines>();
  lastReferenceNumber: number | null = null;
  nextNumber = 1;
  correlationAudit: {
    withReference: CorrelationAuditResult["entries"];
    withoutReferenceCount: number;
  } = { withReference: [], withoutReferenceCount: 0 };
  linesByAccount: LedgerLineRow[] = [];
  aggregate: LedgerAggregateRow = { _sum: { debit: null, credit: null } };

  async list(
    _organizationId: string,
    _filters?: JournalFilters,
  ): Promise<JournalEntryWithLines[]> {
    return this.listRows;
  }

  async findPaginated(
    _organizationId: string,
    _filters?: JournalFilters,
    pagination?: PaginationOptions,
  ): Promise<PaginatedResult<JournalEntryWithLines>> {
    const page = pagination?.page ?? 1;
    const pageSize = pagination?.pageSize ?? 25;
    const skip = (page - 1) * pageSize;
    const items = this.listRows.slice(skip, skip + pageSize);
    const total = this.listRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    return { items, total, page, pageSize, totalPages };
  }

  async findById(
    _organizationId: string,
    id: string,
  ): Promise<JournalEntryWithLines | null> {
    return this.entriesById.get(id) ?? null;
  }

  async getLastReferenceNumber(
    _organizationId: string,
    _voucherTypeId: string,
  ): Promise<number | null> {
    return this.lastReferenceNumber;
  }

  async getNextNumber(
    _organizationId: string,
    _voucherTypeId: string,
    _periodId: string,
  ): Promise<number> {
    return this.nextNumber;
  }

  async findForCorrelationAudit(
    _organizationId: string,
    _voucherTypeId: string,
    _filters?: Pick<CorrelationAuditFilters, "dateFrom" | "dateTo">,
  ): Promise<{
    withReference: CorrelationAuditResult["entries"];
    withoutReferenceCount: number;
  }> {
    return this.correlationAudit;
  }

  async findLinesByAccount(
    _organizationId: string,
    _accountId: string,
    _filters?: { dateRange?: DateRangeFilter; periodId?: string },
  ): Promise<LedgerLineRow[]> {
    return this.linesByAccount;
  }

  async aggregateByAccount(
    _organizationId: string,
    _accountId: string,
    _periodId: string,
  ): Promise<LedgerAggregateRow> {
    return this.aggregate;
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
 * Lightweight fakes for the three concrete services injected into
 * `JournalsService` for the C3 `exportVoucherPdf` use case. Unlike the C1
 * reads these are NOT ports — `exportVoucherPdf` mirrors legacy
 * `journal.service.ts:67-87` and takes the real `OrgProfileService` /
 * `DocumentSignatureConfigService` / `FiscalPeriodsService` classes. The
 * fakes implement only the methods `exportVoucherPdf` calls and are cast to
 * the nominal service types via `asExportDeps()` — the 4 write + 5 read use
 * cases never touch them, so a structural stub is safe.
 */
export class FakeOrgProfileService {
  // Minimal OrgProfileSnapshot — only the fields the voucher composer reads.
  snapshot = {
    organizationId: "org-1",
    razonSocial: "ACME SRL",
    nit: "123456789",
    ciudad: "La Paz",
    direccion: "Av. Siempre Viva 742",
    telefono: "",
    email: "",
    logoUrl: null as string | null,
  };

  async getOrCreate(_organizationId: string) {
    return this.snapshot;
  }
}

export class FakeDocumentSignatureConfigService {
  view = {
    documentType: "COMPROBANTE" as const,
    labels: [] as string[],
    showReceiverRow: false,
  };

  // Records every `getOrDefault` call so `exportVoucherPdf` tests can assert
  // the use case requests the COMPROBANTE signature config (test-cementación
  // port from the retired legacy `journal.service.exportVoucherPdf.test.ts`).
  getOrDefaultCalls: { organizationId: string; documentType: string }[] = [];

  async getOrDefault(organizationId: string, documentType: string) {
    this.getOrDefaultCalls.push({ organizationId, documentType });
    return this.view;
  }
}

export class FakeFiscalPeriodsService {
  periodsById = new Map<string, { id: string; name: string }>();

  async getById(_organizationId: string, periodId: string) {
    const found = this.periodsById.get(periodId);
    if (!found) {
      throw new Error(`Fiscal period ${periodId} not found`);
    }
    return found;
  }
}

/**
 * Bundles the three export-use-case fakes, cast to the nominal service types
 * the `JournalsService` ctor expects. Tests that exercise `exportVoucherPdf`
 * hold the fake refs to prime data; the 10 other use cases pass the bundle
 * unused.
 */
export function makeExportDepsFakes() {
  const orgProfile = new FakeOrgProfileService();
  const sigConfig = new FakeDocumentSignatureConfigService();
  const fiscalPeriods = new FakeFiscalPeriodsService();
  return {
    orgProfile,
    sigConfig,
    fiscalPeriods,
    asCtorArgs: () =>
      [
        orgProfile as unknown as OrgProfileService,
        sigConfig as unknown as DocumentSignatureConfigService,
        fiscalPeriods as unknown as ReturnType<typeof makeFiscalPeriodsService>,
      ] as const,
  };
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
